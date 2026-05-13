import { Router, Response, NextFunction } from 'express';
import { authenticate, AuthRequest } from '../../middleware/auth';
import prisma from '../../prisma/client';
import type { Prisma } from '@prisma/client';
import { webhookService } from '../settings/webhook.service';
import { notificationService } from '../notifications/notification.service';
import type { NotificationType } from '../../types/enums';

const router = Router();
router.use(authenticate);

// ── Transition matrix ──────────────────────────────────────
// from          → to              minRoleLevel
// RECEIVED      → UNDER_REVIEW    4 (SUPERVISOR+)
// UNDER_REVIEW  → POSTED          3 (MANAGER+)
// UNDER_REVIEW  → RETURNED        4 (SUPERVISOR+) + comment required
// POSTED        → RETURNED        3 (MANAGER+)    + comment required
// RETURNED      → UNDER_REVIEW    4 (SUPERVISOR+)

const TRANSITIONS: Record<string, { to: string; maxLevel: number; commentRequired?: boolean }[]> = {
  RECEIVED:     [{ to: 'UNDER_REVIEW', maxLevel: 4 }],
  UNDER_REVIEW: [{ to: 'POSTED', maxLevel: 3 }, { to: 'RETURNED', maxLevel: 4, commentRequired: true }],
  POSTED:       [{ to: 'RETURNED', maxLevel: 3, commentRequired: true }],
  RETURNED:     [{ to: 'UNDER_REVIEW', maxLevel: 4 }],
};

const INCLUDE: Prisma.TaskExtractInclude = {
  contractor: true,
  project:    true,
  task:       { select: { id: true, taskCode: true, title: true, titleAr: true } },
  createdBy:  { select: { id: true, fullName: true, fullNameAr: true } },
  comments:   { where: { isReturnNote: true }, orderBy: { commentDate: 'desc' } },
};

async function syncTaskProgress(taskId: number, actorId?: number): Promise<void> {
  // جلب كل المستخلصات المرتبطة بالمهمة
  const extracts = await prisma.taskExtract.findMany({
    where:  { taskId },
    select: { status: true },
  });

  if (extracts.length === 0) return;

  const total       = extracts.length;
  const posted      = extracts.filter(e => e.status === 'POSTED').length;
  const underReview = extracts.filter(e => e.status === 'UNDER_REVIEW').length;
  const returned    = extracts.filter(e => e.status === 'RETURNED').length;
  const received    = extracts.filter(e => e.status === 'RECEIVED').length;

  // ─── منطق التقدم والحالة ───────────────────────────────────
  // allPosted    → 100%   COMPLETED
  // allReturned  → 0%     IN_PROGRESS  (كل المستخلصات مُرجَعة)
  // غير ذلك     → posted/total%  IN_PROGRESS
  const allPosted   = posted   === total;
  const allReturned = returned === total;

  const progress: number = allPosted   ? 100
                         : allReturned ? 0
                         : Math.round((posted / total) * 100);

  const newStatus = allPosted ? 'COMPLETED' : 'IN_PROGRESS';

  // جلب حالة المهمة الحالية
  const task = await prisma.task.findUnique({
    where:  { id: taskId },
    select: { status: true, createdById: true },
  });
  if (!task || task.status === 'CANCELLED') return;

  // تحديث المهمة دائماً (قد يتغير التقدم دون تغيير الحالة)
  await prisma.task.update({
    where: { id: taskId },
    data: {
      progressPercent: progress,
      status:          newStatus,
      completedDate:   newStatus === 'COMPLETED' ? new Date() : null,
    },
  });

  // تسجيل في السجل عند تغيير الحالة فقط
  if (task.status !== newStatus) {
    const changedById = actorId ?? task.createdById;
    let note: string;
    if (allPosted) {
      note = `✅ اكتمال تلقائي: كل المستخلصات (${total}/${total}) أُدرجت`;
    } else if (allReturned) {
      note = `⚠️ تحديث تلقائي: كل المستخلصات (${total}/${total}) مُرجَعة — التقدم يعود إلى 0%`;
    } else {
      const parts: string[] = [];
      if (posted)      parts.push(`${posted} مُدرج`);
      if (underReview) parts.push(`${underReview} مراجعة`);
      if (returned)    parts.push(`${returned} مُرجَع`);
      if (received)    parts.push(`${received} مستلم`);
      note = `🔄 تحديث تلقائي: ${parts.join(' | ')} من أصل ${total} مستخلص`;
    }
    await prisma.taskStatusHistory.create({
      data: { taskId, fromStatus: task.status, toStatus: newStatus, changedById, note },
    });
  }
}

// ── Extract notification helper ────────────────────────────
// Sends in-app + Web-Push notifications to all relevant parties
// when an extract changes status. Fire-and-forget — never throws.
async function notifyExtractTransition(opts: {
  extract: any;          // full extract with contractor, project, task, createdBy
  newStatus: string;
  actorId: number;
  returnComment?: string;
}): Promise<void> {
  const { extract, newStatus, actorId, returnComment } = opts;

  const contractorName = extract.contractor?.name ?? 'المقاول';
  const projectName    = extract.project?.name    ?? 'المشروع';
  const extractNum     = extract.extractNumber;
  const taskId         = extract.task?.id  ?? null;
  const taskCode       = extract.task?.taskCode ?? '';
  const createdById    = extract.createdBy?.id ?? extract.createdById;
  const taskAssigneeId = taskId
    ? (await prisma.task.findUnique({ where: { id: taskId }, select: { assignedToId: true } }))?.assignedToId
    : null;
  const taskCreatorId  = taskId
    ? (await prisma.task.findUnique({ where: { id: taskId }, select: { createdById: true } }))?.createdById
    : null;

  // Helper: deduplicated recipients (skip the actor)
  const send = (receiverId: number | null | undefined, type: NotificationType, titleAr: string, title: string, msgAr: string, msg: string) => {
    if (!receiverId || receiverId === actorId) return Promise.resolve();
    return notificationService.create({
      receiverId, senderId: actorId, taskId: taskId ?? undefined,
      type, titleAr, title, messageAr: msgAr, message: msg,
    }).catch(() => {}); // fire-and-forget
  };

  const ref = taskCode ? ` (${taskCode})` : '';

  if (newStatus === 'UNDER_REVIEW') {
    // Case A: RECEIVED → UNDER_REVIEW  (submitted for review)
    // Case B: RETURNED  → UNDER_REVIEW  (resubmitted after return)
    const type: NotificationType = extract.status === 'RETURNED' ? 'EXTRACT_RESUBMITTED' : 'EXTRACT_UNDER_REVIEW';
    const [titleAr, title] = extract.status === 'RETURNED'
      ? ['إعادة تقديم مستخلص', 'Extract Resubmitted']
      : ['مستخلص تحت المراجعة', 'Extract Under Review'];
    const msgAr = `مستخلص #${extractNum} للمقاول "${contractorName}" – "${projectName}"${ref} أُرسل للمراجعة.`;
    const msg   = `Extract #${extractNum} for "${contractorName}" – "${projectName}"${ref} sent for review.`;
    // Notify task creator (manager) so they know to review
    await Promise.all([
      send(taskCreatorId,  type, titleAr, title, msgAr, msg),
      send(createdById,    type, titleAr, title, msgAr, msg),
    ]);

  } else if (newStatus === 'POSTED') {
    // UNDER_REVIEW → POSTED  (approved)
    const msgAr = `✅ مستخلص #${extractNum} للمقاول "${contractorName}" – "${projectName}"${ref} تم إدراجه بنجاح.`;
    const msg   = `✅ Extract #${extractNum} for "${contractorName}" – "${projectName}"${ref} has been posted.`;
    await Promise.all([
      send(createdById,    'EXTRACT_POSTED', 'تم إدراج المستخلص', 'Extract Posted', msgAr, msg),
      send(taskAssigneeId, 'EXTRACT_POSTED', 'تم إدراج المستخلص', 'Extract Posted', msgAr, msg),
    ]);

  } else if (newStatus === 'RETURNED') {
    // UNDER_REVIEW | POSTED → RETURNED  (rejected with comment)
    const commentPart = returnComment ? `\nالسبب: ${returnComment}` : '';
    const msgAr = `⚠️ مستخلص #${extractNum} للمقاول "${contractorName}" – "${projectName}"${ref} تم إرجاعه.${commentPart}`;
    const msg   = `⚠️ Extract #${extractNum} for "${contractorName}" – "${projectName}"${ref} was returned.${returnComment ? `\nReason: ${returnComment}` : ''}`;
    await Promise.all([
      send(createdById,    'EXTRACT_RETURNED', 'تم إرجاع المستخلص', 'Extract Returned', msgAr, msg),
      send(taskAssigneeId, 'EXTRACT_RETURNED', 'تم إرجاع المستخلص', 'Extract Returned', msgAr, msg),
    ]);
  }
}

// GET all extracts (filtered + paginated)
router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const {
      projectId, contractorId, status, search,
      dateFrom, dateTo, page = '1', limit = '20',
    } = req.query as Record<string, string>;

    const where: any = {};
    if (projectId)    where.projectId    = +projectId;
    if (contractorId) where.contractorId = +contractorId;
    if (status)       where.status       = status;
    if (dateFrom || dateTo) {
      where.receivedAt = {};
      if (dateFrom) where.receivedAt.gte = new Date(dateFrom);
      if (dateTo)   where.receivedAt.lte = new Date(dateTo);
    }
    if (search) {
      where.OR = [
        { contractor: { name: { contains: search, mode: 'insensitive' } } },
        { project:    { name: { contains: search, mode: 'insensitive' } } },
      ];
      if (!isNaN(+search)) where.OR.push({ extractNumber: +search });
    }

    const skip = (+page - 1) * +limit;
    const [extracts, total, summary] = await Promise.all([
      prisma.taskExtract.findMany({ where, include: INCLUDE, orderBy: { receivedAt: 'desc' }, skip, take: +limit }),
      prisma.taskExtract.count({ where }),
      prisma.taskExtract.groupBy({ by: ['status'], _count: { id: true } }),
    ]);

    res.json({ success: true, data: { extracts, total, page: +page, summary } });
  } catch (e) { next(e); }
});

// GET /financial-summary — إجماليات مالية مجمّعة حسب الحالة والعملة
router.get('/financial-summary', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { projectId, contractorId, dateFrom, dateTo } = req.query as Record<string, string>;
    const where: any = { amount: { not: null } };
    if (projectId)    where.projectId    = +projectId;
    if (contractorId) where.contractorId = +contractorId;
    if (dateFrom || dateTo) {
      where.receivedAt = {};
      if (dateFrom) where.receivedAt.gte = new Date(dateFrom);
      if (dateTo)   where.receivedAt.lte = new Date(dateTo);
    }

    const agg = await prisma.taskExtract.groupBy({
      by: ['currency', 'status'],
      where,
      _sum:   { amount: true },
      _count: { id: true },
    });

    const currenciesMap: Record<string, {
      currency: string;
      byStatus: { status: string; total: number; count: number }[];
      grandTotal: number;
      grandCount: number;
    }> = {};

    const statuses = ['RECEIVED', 'UNDER_REVIEW', 'POSTED', 'RETURNED'];

    agg.forEach(a => {
      const cur = a.currency || 'EGP';
      if (!currenciesMap[cur]) {
        currenciesMap[cur] = {
          currency: cur,
          byStatus: statuses.map(s => ({ status: s, total: 0, count: 0 })),
          grandTotal: 0,
          grandCount: 0
        };
      }
      
      const st = a.status;
      const statusObj = currenciesMap[cur].byStatus.find(s => s.status === st);
      const total = Number(a._sum.amount ?? 0);
      const count = a._count.id;
      
      if (statusObj) {
        statusObj.total = total;
        statusObj.count = count;
      }
      
      currenciesMap[cur].grandTotal += total;
      currenciesMap[cur].grandCount += count;
    });

    res.json({
      success: true,
      data: Object.values(currenciesMap),
    });
  } catch (e) { next(e); }
});

// GET single extract
router.get('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const extract = await prisma.taskExtract.findUnique({ where: { id: +req.params.id }, include: INCLUDE });
    if (!extract) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: extract });
  } catch (e) { next(e); }
});

// POST create extract (SUPERVISOR+)
router.post('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if ((req.user!.roleLevel ?? 99) > 4) return res.status(403).json({ success: false, message: 'Forbidden' });
    const { extractNumber, taskId, contractorId, projectId, notes, amount, currency } = req.body;
    if (!extractNumber || !contractorId || !projectId)
      return res.status(400).json({ success: false, message: 'extractNumber, contractorId, projectId required' });

    const existing = await prisma.taskExtract.findFirst({
      where: {
        extractNumber: +extractNumber,
        contractorId: +contractorId,
        projectId: +projectId
      }
    });

    if (existing) {
      const statusMap: any = { RECEIVED:'استلام', UNDER_REVIEW:'تحت المراجعة', POSTED:'مُدرج', RETURNED:'مُرجَع' };
      const statusAr = statusMap[existing.status] || existing.status;
      const amountStr = existing.amount ? `${existing.amount} ${existing.currency}` : 'غير محدد';
      const dateStr = new Date(existing.receivedAt).toLocaleDateString('ar-EG');
      return res.status(400).json({ 
        success: false, 
        message: `هذا المستخلص مسجل بالفعل! قيمته ${amountStr} بتاريخ ${dateStr} وحالته الحالية "${statusAr}".` 
      });
    }

    const extract = await prisma.taskExtract.create({
      data: {
        extractNumber: +extractNumber,
        taskId:        taskId ? +taskId : null,
        contractorId:  +contractorId,
        projectId:     +projectId,
        notes,
        amount:        amount ? +amount : null,
        currency:      currency || 'EGP',
        createdById:   req.user!.id,
      },
      include: INCLUDE,
    });
    if (extract.taskId) await syncTaskProgress(extract.taskId, req.user!.id);

    // Notify task assignee that a new extract was linked to their task
    if (extract.taskId) {
      const linkedTask = await prisma.task.findUnique({
        where: { id: extract.taskId },
        select: { assignedToId: true, createdById: true, taskCode: true },
      });
      if (linkedTask) {
        const msgAr = `📄 مستخلص جديد #${extract.extractNumber} تم ربطه بمهمتك (${linkedTask.taskCode}).`;
        const msg   = `📄 New extract #${extract.extractNumber} was linked to your task (${linkedTask.taskCode}).`;
        const notifBase = { senderId: req.user!.id, taskId: extract.taskId, type: 'EXTRACT_CREATED' as const, titleAr: 'مستخلص جديد', title: 'New Extract', messageAr: msgAr, message: msg };
        const targets = [...new Set([linkedTask.assignedToId, linkedTask.createdById])].filter(id => id !== req.user!.id);
        await Promise.all(targets.map(receiverId => notificationService.create({ ...notifBase, receiverId }).catch(() => {})));
      }
    }

    webhookService.dispatch('EXTRACT_CREATED', extract);
    res.status(201).json({ success: true, data: extract });
  } catch (e) { next(e); }
});

// PATCH /:id/status — status transition
router.patch('/:id/status', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { status: newStatus, returnComment } = req.body;
    const extract = await prisma.taskExtract.findUnique({ where: { id: +req.params.id } });
    if (!extract) return res.status(404).json({ success: false, message: 'Extract not found' });

    const allowed = TRANSITIONS[extract.status] ?? [];
    const rule    = allowed.find(r => r.to === newStatus);
    if (!rule) return res.status(400).json({ success: false, message: `Invalid transition: ${extract.status} → ${newStatus}` });

    const level = req.user!.roleLevel ?? 99;
    if (level > rule.maxLevel) return res.status(403).json({ success: false, message: 'Insufficient role' });

    if (rule.commentRequired && (!returnComment || returnComment.trim().length < 10))
      return res.status(400).json({ success: false, message: 'Return comment required (min 10 chars)' });

    // Perform update + optional comment in a transaction
    const updated = await prisma.$transaction(async (tx) => {
      const upd = await tx.taskExtract.update({
        where: { id: extract.id },
        data:  { status: newStatus },
        include: INCLUDE,
      });

      if (rule.commentRequired && returnComment && extract.taskId) {
        await tx.taskComment.create({
          data: {
            taskId:        extract.taskId,
            userId:        req.user!.id,
            commentText:   returnComment.trim(),
            isManagerNote: true,
            isReturnNote:  true,
            extractId:     extract.id,
          },
        });
      }
      return upd;
    });

    if (updated.taskId) await syncTaskProgress(updated.taskId, req.user!.id);

    // Fire notifications (non-blocking)
    notifyExtractTransition({
      extract:       updated,
      newStatus,
      actorId:       req.user!.id,
      returnComment: returnComment?.trim(),
    }).catch(() => {});

    webhookService.dispatch('EXTRACT_STATUS_CHANGED', updated);
    res.json({ success: true, data: updated });
  } catch (e) { next(e); }
});

// PATCH /:id — Edit extract data (amount, notes, taskId) — not allowed once POSTED
// SUPERVISOR+ can edit; MANAGER+ can edit any non-POSTED extract
router.patch('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const level = req.user!.roleLevel ?? 99;
    if (level > 4) return res.status(403).json({ success: false, message: 'Forbidden' });

    const extract = await prisma.taskExtract.findUnique({ where: { id: +req.params.id } });
    if (!extract) return res.status(404).json({ success: false, message: 'Extract not found' });

    // Block editing once POSTED — only ADMIN+ can override
    if (extract.status === 'POSTED' && level > 2) {
      return res.status(400).json({
        success: false,
        message: 'لا يمكن تعديل مستخلص مُدرج. يجب إرجاعه أولاً.',
      });
    }

    const { amount, currency, notes, taskId, extractNumber } = req.body;

    // Check if extractNumber is being edited and level is <= 2
    if (extractNumber !== undefined && Number(extractNumber) !== extract.extractNumber) {
      if (level > 2) {
        return res.status(403).json({ success: false, message: 'لا تملك صلاحية تعديل رقم المستخلص.' });
      }
      // Check for duplicates
      const dup = await prisma.taskExtract.findFirst({
        where: {
          contractorId: extract.contractorId,
          projectId: extract.projectId,
          extractNumber: +extractNumber,
          id: { not: extract.id },
        },
      });
      if (dup) {
        return res.status(400).json({ 
          success: false, 
          message: `هذا المستخلص (${extractNumber}) مسجل بالفعل لنفس المقاول والمشروع.` 
        });
      }
    }

    // Build update payload (only provided fields)
    const data: any = {};
    if (amount    !== undefined) data.amount   = amount !== null ? +amount : null;
    if (currency  !== undefined) data.currency = currency;
    if (notes     !== undefined) data.notes    = notes;
    if (taskId    !== undefined) data.taskId   = taskId !== null ? +taskId : null;
    if (extractNumber !== undefined && level <= 2) data.extractNumber = +extractNumber;

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ success: false, message: 'لم يتم تحديد أي حقل للتعديل' });
    }

    const updated = await prisma.taskExtract.update({
      where: { id: extract.id },
      data,
      include: INCLUDE,
    });

    // Re-sync both old and new taskId (if taskId changed)
    const oldTaskId = extract.taskId;
    const newTaskId = updated.taskId;
    if (oldTaskId && oldTaskId !== newTaskId) await syncTaskProgress(oldTaskId, req.user!.id);
    if (newTaskId) await syncTaskProgress(newTaskId, req.user!.id);

    res.json({ success: true, data: updated });
  } catch (e) { next(e); }
});

// DELETE (ADMIN+ only)
router.delete('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if ((req.user!.roleLevel ?? 99) > 2) return res.status(403).json({ success: false, message: 'Forbidden' });
    const extract = await prisma.taskExtract.delete({ where: { id: +req.params.id } });
    if (extract.taskId) await syncTaskProgress(extract.taskId, req.user!.id);
    res.json({ success: true, message: 'Deleted' });
  } catch (e) { next(e); }
});

export default router;

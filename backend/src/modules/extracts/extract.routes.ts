import { Router, Response, NextFunction } from 'express';
import { authenticate, AuthRequest } from '../../middleware/auth';
import prisma from '../../prisma/client';
import type { Prisma } from '@prisma/client';
import { webhookService } from '../settings/webhook.service';

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

  const total   = extracts.length;
  const posted  = extracts.filter(e => e.status === 'POSTED').length;
  const active  = extracts.filter(e => ['UNDER_REVIEW', 'POSTED'].includes(e.status)).length;

  // نسبة التنفيذ بناءً على المُدرَج فعلاً
  const progress = Math.round((posted / total) * 100);

  // تحديد الحالة الجديدة للمهمة
  const newStatus = posted === total ? 'COMPLETED'
                  : active > 0      ? 'IN_PROGRESS'
                  :                   'IN_PROGRESS';

  // جلب حالة المهمة الحالية
  const task = await prisma.task.findUnique({
    where:  { id: taskId },
    select: { status: true, createdById: true },
  });
  if (!task || task.status === 'CANCELLED') return;

  // تحديث المهمة
  await prisma.task.update({
    where: { id: taskId },
    data: {
      progressPercent: progress,
      status:          newStatus,
      completedDate:   newStatus === 'COMPLETED' ? new Date() : null,
    },
  });

  // تسجيل في السجل فقط لو تغيرت الحالة
  if (task.status !== newStatus) {
    const changedById = actorId ?? task.createdById;
    const note = newStatus === 'COMPLETED'
      ? `✅ اكتمال تلقائي: كل المستخلصات (${total}/${total}) أُدرجت`
      : `🔄 تحديث تلقائي من المستخلصات: ${posted}/${total} مُدرج`;
    await prisma.taskStatusHistory.create({
      data: { taskId, fromStatus: task.status, toStatus: newStatus, changedById, note },
    });
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

    // مجموع لكل حالة
    const statuses = ['RECEIVED', 'UNDER_REVIEW', 'POSTED', 'RETURNED'];
    const byStatus = await Promise.all(
      statuses.map(async (s) => {
        const agg = await prisma.taskExtract.aggregate({
          where: { ...where, status: s },
          _sum:   { amount: true },
          _count: { id: true },
        });
        return { status: s, total: Number(agg._sum.amount ?? 0), count: agg._count.id };
      })
    );

    // إجمالي كل العملات
    const grandTotal = await prisma.taskExtract.aggregate({
      where,
      _sum:   { amount: true },
      _count: { id: true },
    });

    res.json({
      success: true,
      data: {
        byStatus,
        grandTotal:  Number(grandTotal._sum.amount ?? 0),
        grandCount:  grandTotal._count.id,
      },
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
    webhookService.dispatch('EXTRACT_STATUS_CHANGED', updated);
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

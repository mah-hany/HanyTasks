import { Router, Response, NextFunction } from 'express';
import { authenticate, AuthRequest } from '../../middleware/auth';
import prisma from '../../prisma/client';

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

const INCLUDE = {
  contractor: true,
  project:    true,
  task:       { select: { id: true, taskCode: true, title: true, titleAr: true } },
  createdBy:  { select: { id: true, fullName: true, fullNameAr: true } },
  comments:   { where: { isReturnNote: true }, orderBy: { commentDate: 'desc' as const } },
};

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
    const { extractNumber, taskId, contractorId, projectId, notes } = req.body;
    if (!extractNumber || !contractorId || !projectId)
      return res.status(400).json({ success: false, message: 'extractNumber, contractorId, projectId required' });

    const extract = await prisma.taskExtract.create({
      data: {
        extractNumber: +extractNumber,
        taskId:        taskId ? +taskId : null,
        contractorId:  +contractorId,
        projectId:     +projectId,
        notes,
        createdById:   req.user!.id,
      },
      include: INCLUDE,
    });
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

    res.json({ success: true, data: updated });
  } catch (e) { next(e); }
});

// DELETE (ADMIN+ only)
router.delete('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if ((req.user!.roleLevel ?? 99) > 2) return res.status(403).json({ success: false, message: 'Forbidden' });
    await prisma.taskExtract.delete({ where: { id: +req.params.id } });
    res.json({ success: true, message: 'Deleted' });
  } catch (e) { next(e); }
});

export default router;

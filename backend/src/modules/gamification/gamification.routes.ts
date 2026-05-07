import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { AuthRequest } from '../../middleware/auth';
import { Response, NextFunction } from 'express';
import prisma from '../../prisma/client';

const router = Router();
router.use(authenticate);

// GET leaderboard (top performers by points)
router.get('/leaderboard', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { period = 'month' } = req.query as { period?: string };
    const now = new Date();
    let from: Date;

    if (period === 'week')  from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
    else if (period === 'year') from = new Date(now.getFullYear(), 0, 1);
    else from = new Date(now.getFullYear(), now.getMonth(), 1); // month

    // Aggregate points per user
    const pointsAgg = await prisma.userPoint.groupBy({
      by: ['userId'],
      where: { createdAt: { gte: from } },
      _sum: { points: true },
      orderBy: { _sum: { points: 'desc' } },
      take: 20,
    });

    const userIds = pointsAgg.map(p => p.userId);
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      include: {
        role: { select: { name: true, nameAr: true } },
        department: { select: { name: true, nameAr: true } },
      },
    });

    const userMap = new Map(users.map((u: any) => [u.id, u]));

    // Add task stats per user
    const leaderboard = await Promise.all(
      pointsAgg.map(async (p, idx) => {
        const user = userMap.get(p.userId);
        const [completed, total, onTime] = await Promise.all([
          prisma.task.count({ where: { assignedToId: p.userId, status: 'COMPLETED', completedDate: { gte: from } } }),
          prisma.task.count({ where: { assignedToId: p.userId, createdAt: { gte: from } } }),
          prisma.task.count({
            where: {
              assignedToId: p.userId, status: 'COMPLETED', completedDate: { gte: from },
              AND: [{ completedDate: { not: null } }, { dueDate: { not: null } }],
            },
          }),
        ]);
        return {
          rank: idx + 1,
          user,
          totalPoints: p._sum.points || 0,
          completedTasks: completed,
          totalTasks: total,
          completionRate: total > 0 ? Math.round(completed / total * 100) : 0,
          onTimeRate: completed > 0 ? Math.round(onTime / completed * 100) : 0,
        };
      })
    );

    res.json({ success: true, data: leaderboard, period, from });
  } catch (e) { next(e); }
});

// GET user's own points + badges
router.get('/me', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [totalPoints, monthPoints, entries, completedTotal] = await Promise.all([
      prisma.userPoint.aggregate({ where: { userId }, _sum: { points: true } }),
      prisma.userPoint.aggregate({ where: { userId, createdAt: { gte: monthStart } }, _sum: { points: true } }),
      prisma.userPoint.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 10 }),
      prisma.task.count({ where: { assignedToId: userId, status: 'COMPLETED' } }),
    ]);

    const badges = computeBadges(totalPoints._sum.points || 0, completedTotal);

    res.json({
      success: true,
      data: {
        totalPoints: totalPoints._sum.points || 0,
        monthPoints: monthPoints._sum.points || 0,
        recentEntries: entries,
        badges,
        level: getLevel(totalPoints._sum.points || 0),
      },
    });
  } catch (e) { next(e); }
});

// POST award points (internal - called by task service)
router.post('/award', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { userId, points, reason, taskId } = req.body;
    const entry = await prisma.userPoint.create({ data: { userId, points, reason, taskId } });
    res.json({ success: true, data: entry });
  } catch (e) { next(e); }
});

// ── Helpers ──────────────────────────────────────────────────
function computeBadges(points: number, completed: number): string[] {
  const badges: string[] = [];
  if (completed >= 1)   badges.push('🏆 First Task');
  if (completed >= 10)  badges.push('⭐ Task Master');
  if (completed >= 50)  badges.push('🚀 Productivity Pro');
  if (completed >= 100) badges.push('👑 Legend');
  if (points >= 100)    badges.push('💎 Point Hunter');
  if (points >= 500)    badges.push('🔥 On Fire');
  if (points >= 1000)   badges.push('🌟 Elite');
  return badges;
}

function getLevel(points: number): { level: number; name: string; nameAr: string; nextLevelAt: number } {
  if (points < 100)  return { level: 1, name: 'Beginner',      nameAr: 'مبتدئ',       nextLevelAt: 100 };
  if (points < 300)  return { level: 2, name: 'Contributor',   nameAr: 'مساهم',       nextLevelAt: 300 };
  if (points < 600)  return { level: 3, name: 'Achiever',      nameAr: 'منجز',        nextLevelAt: 600 };
  if (points < 1000) return { level: 4, name: 'Expert',        nameAr: 'خبير',        nextLevelAt: 1000 };
  if (points < 2000) return { level: 5, name: 'Master',        nameAr: 'متمكن',       nextLevelAt: 2000 };
  return              { level: 6, name: 'Legend',        nameAr: 'أسطورة',      nextLevelAt: 99999 };
}

export default router;

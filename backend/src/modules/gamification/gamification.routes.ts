import { Router } from 'express';
import { authenticate, authorizeLevel, AuthRequest } from '../../middleware/auth';
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

// GET user's own points + badges + streak + challenges + team comparison
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

    // Calculate Streak
    const pointsDates = await prisma.userPoint.findMany({
      where: { userId },
      select: { createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
    const activeDates = [...new Set(pointsDates.map(p => {
      const d = new Date(p.createdAt);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }))];

    let currentStreak = 0;
    const today = new Date();
    for (let i = 0; i < 365; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (activeDates.includes(dateStr)) {
        currentStreak++;
      } else {
        if (i === 0) continue; // if today is missing, allow yesterday
        break;
      }
    }

    // Weekly Challenges
    const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
    const tasksCompletedThisWeek = await prisma.task.count({
      where: { assignedToId: userId, status: 'COMPLETED', completedDate: { gte: startOfWeek } }
    });
    
    const weeklyChallenges = [
      { id: 1, title: 'Speed Demon', titleAr: 'بطل السرعة', target: 5, current: tasksCompletedThisWeek, completed: tasksCompletedThisWeek >= 5, reward: 50 },
      { id: 2, title: 'Consistent', titleAr: 'المثابر', target: 3, current: Math.min(currentStreak, 3), completed: currentStreak >= 3, reward: 20 },
      { id: 3, title: 'Point Hunter', titleAr: 'صائد النقاط', target: 100, current: monthPoints._sum.points || 0, completed: (monthPoints._sum.points || 0) >= 100, reward: 30 }
    ];

    // Team comparison data (Last 7 Days)
    const userInfo = await prisma.user.findUnique({ where: { id: userId }, select: { departmentId: true } });
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      d.setHours(0, 0, 0, 0);
      return d;
    }).reverse();

    const chartData = [];
    if (userInfo?.departmentId) {
      for (const d of last7Days) {
        const nextDay = new Date(d);
        nextDay.setDate(d.getDate() + 1);

        const uPoints = await prisma.userPoint.aggregate({
          where: { userId, createdAt: { gte: d, lt: nextDay } },
          _sum: { points: true }
        });

        const tPoints = await prisma.userPoint.aggregate({
          where: { user: { departmentId: userInfo.departmentId }, createdAt: { gte: d, lt: nextDay } },
          _sum: { points: true }
        });

        const membersCount = await prisma.user.count({ where: { departmentId: userInfo.departmentId } });
        const avgTeamPoints = membersCount > 0 ? (tPoints._sum.points || 0) / membersCount : 0;

        chartData.push({
          date: `${d.getDate()}/${d.getMonth() + 1}`,
          user: uPoints._sum.points || 0,
          teamAvg: Math.round(avgTeamPoints)
        });
      }
    }

    const badges = computeBadges(totalPoints._sum.points || 0, completedTotal);

    res.json({
      success: true,
      data: {
        totalPoints: totalPoints._sum.points || 0,
        monthPoints: monthPoints._sum.points || 0,
        recentEntries: entries,
        badges,
        level: getLevel(totalPoints._sum.points || 0),
        streak: currentStreak,
        challenges: weeklyChallenges,
        teamChart: chartData
      },
    });
  } catch (e) { next(e); }
});

// POST award points (internal - called by task service)
router.post('/award', authorizeLevel(1), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { userId, points, reason, taskId } = req.body;
    const entry = await prisma.userPoint.create({ data: { userId, points, reason, taskId } });
    res.json({ success: true, data: entry });
  } catch (e) { next(e); }
});

// ── Helpers ──────────────────────────────────────────────────
function computeBadges(points: number, completed: number): any[] {
  const badges: any[] = [];
  if (completed >= 1)   badges.push({ name: 'First Task', nameAr: 'أول مهمة', icon: 'flag', color: '#3b82f6' });
  if (completed >= 10)  badges.push({ name: 'Task Master', nameAr: 'سيد المهام', icon: 'military_tech', color: '#8b5cf6' });
  if (completed >= 50)  badges.push({ name: 'Productivity Pro', nameAr: 'محترف', icon: 'rocket_launch', color: '#ec4899' });
  if (points >= 100)    badges.push({ name: 'Point Hunter', nameAr: 'صائد النقاط', icon: 'ads_click', color: '#f59e0b' });
  if (points >= 500)    badges.push({ name: 'On Fire', nameAr: 'شعلة نشاط', icon: 'local_fire_department', color: '#ef4444' });
  if (points >= 1000)   badges.push({ name: 'Elite', nameAr: 'النخبة', icon: 'workspace_premium', color: '#eab308' });
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

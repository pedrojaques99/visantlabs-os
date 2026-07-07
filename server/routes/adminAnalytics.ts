import express, { Response } from 'express';
import { ObjectId } from 'mongodb';
import { rateLimit } from 'express-rate-limit';
import { prisma } from '../db/prisma.js';
import { connectToMongoDB, getDb } from '../db/mongodb.js';
import { validateAdmin } from '../middleware/adminAuth.js';
import { AuthRequest } from '../middleware/auth.js';
import { ensureString } from '../utils/validation.js';
import { redisClient } from '../lib/redis.js';
import { CACHE_TTL, CacheKey } from '../lib/cache-utils.js';

const router = express.Router();

// Same posture as adminUsersLimiter in admin.ts — this endpoint fans out many aggregations
const analyticsLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'Too many requests for analytics data, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Prisma-managed collections store userId as ObjectId; raw collections
// (usage_records, mcp_tool_calls) store it as a string — do not mix.
const FEATURE_COLLECTIONS = [
  { key: 'brandings', collection: 'branding_projects' },
  { key: 'guidelines', collection: 'brand_guidelines' },
  { key: 'campaigns', collection: 'campaigns' },
  { key: 'creativeProjects', collection: 'creative_projects' },
  { key: 'canvasProjects', collection: 'canvas_projects' },
  { key: 'budgets', collection: 'budget_projects' },
  { key: 'mockups', collection: 'mockups' },
] as const;

type FeatureKey = (typeof FEATURE_COLLECTIONS)[number]['key'];

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const value = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  return Math.round(value * 10) / 10;
}

function toObjectIds(ids: string[]): ObjectId[] {
  const out: ObjectId[] = [];
  for (const id of ids) {
    if (ObjectId.isValid(id)) out.push(new ObjectId(id));
  }
  return out;
}

router.get(
  '/analytics',
  analyticsLimiter,
  validateAdmin,
  async (req: AuthRequest, res: Response) => {
    try {
      const days = Math.min(
        Math.max(parseInt(ensureString(req.query.days) || '30', 10) || 30, 1),
        365
      );
      const refresh = req.query.refresh === '1' || req.query.refresh === 'true';
      const cacheKey = CacheKey.adminAnalytics(days);

      if (!refresh) {
        try {
          const cached = await redisClient.get(cacheKey);
          if (cached) {
            return res.json({ ...JSON.parse(cached), cached: true });
          }
        } catch (err) {
          console.warn('[admin-analytics] Redis GET failed, skipping cache:', (err as Error).message);
        }
      }

      const now = new Date();
      const since = new Date();
      since.setDate(since.getDate() - days);

      await connectToMongoDB();
      const db = getDb();

      // ── A. Feature adoption (windowed byDay + totals + per-user sets) ──────
      const featurePromise = Promise.all(
        FEATURE_COLLECTIONS.map(async ({ key, collection }) => {
          const col = db.collection(collection);
          const [facet] = await col
            .aggregate([
              { $match: { createdAt: { $gte: since } } },
              {
                $facet: {
                  byDay: [
                    {
                      $group: {
                        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                        count: { $sum: 1 },
                      },
                    },
                    { $sort: { _id: 1 } },
                    { $project: { _id: 0, date: '$_id', count: 1 } },
                  ],
                  totals: [
                    {
                      $group: {
                        _id: null,
                        total: { $sum: 1 },
                        users: { $addToSet: '$userId' },
                      },
                    },
                    { $project: { _id: 0, total: 1, distinctUsers: { $size: '$users' } } },
                  ],
                  byUser: [{ $group: { _id: '$userId' } }],
                },
              },
            ])
            .toArray();

          const allTime = await col.countDocuments({});
          const totals = facet?.totals?.[0] || { total: 0, distinctUsers: 0 };
          const userIds: string[] = (facet?.byUser || [])
            .map((u: any) => (u._id != null ? String(u._id) : null))
            .filter(Boolean);

          return {
            key,
            total: totals.total,
            allTime,
            distinctUsers: totals.distinctUsers,
            byDay: facet?.byDay || [],
            userIds,
          };
        })
      );

      // ── B. MCP adoption ─────────────────────────────────────────────────
      const mcpPromise = Promise.all([
        prisma.apiKey.findMany({ where: { active: true }, select: { userId: true } }),
        prisma.oAuthRefreshToken.findMany({
          where: { expiresAt: { gt: now } },
          select: { userId: true, clientId: true },
        }),
        prisma.oAuthClient.findMany({ select: { clientId: true, clientName: true } }),
        db.collection('mcp_tool_calls').distinct('userId', { createdAt: { $gte: since } }),
      ]);

      // ── C. Activation funnel (cohort = users created in window) ─────────
      const cohortPromise = prisma.user.findMany({
        where: { createdAt: { gte: since } },
        select: { id: true, createdAt: true, subscriptionTier: true },
      });

      // ── E. Retention proxies from usage_records (userId is a string) ────
      const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const usageCol = db.collection('usage_records');
      const retentionPromise = Promise.all([
        usageCol.distinct('userId', { timestamp: { $gte: dayAgo } }),
        usageCol.distinct('userId', { timestamp: { $gte: weekAgo } }),
        usageCol.distinct('userId', { timestamp: { $gte: monthAgo } }),
        usageCol
          .aggregate([
            { $match: { timestamp: { $gte: since } } },
            {
              $group: {
                _id: { $dateToString: { format: '%G-W%V', date: '$timestamp' } },
                users: { $addToSet: '$userId' },
              },
            },
            { $sort: { _id: 1 } },
            { $project: { _id: 0, week: '$_id', users: { $size: '$users' } } },
          ])
          .toArray(),
      ]);

      // ── F. Naming Machine adoption (naming_events) ──────────────────────
      const namingCol = db.collection('naming_events');
      const namingPromise = namingCol
        .aggregate([
          { $match: { createdAt: { $gte: since } } },
          {
            $facet: {
              generate: [
                { $match: { type: 'generate' } },
                {
                  $group: {
                    _id: null,
                    batches: { $sum: 1 },
                    namesGenerated: { $sum: { $ifNull: ['$returned', 0] } },
                    tokensSpent: { $sum: { $ifNull: ['$tokens', 0] } },
                    users: { $addToSet: '$userId' },
                  },
                },
                {
                  $project: {
                    _id: 0,
                    batches: 1,
                    namesGenerated: 1,
                    tokensSpent: 1,
                    uniqueUsers: { $size: '$users' },
                  },
                },
              ],
              byModel: [
                { $match: { type: 'generate' } },
                {
                  $group: {
                    _id: '$model',
                    batches: { $sum: 1 },
                    tokens: { $sum: { $ifNull: ['$tokens', 0] } },
                  },
                },
                { $sort: { batches: -1 } },
                { $project: { _id: 0, model: '$_id', batches: 1, tokens: 1 } },
              ],
              swipes: [
                { $match: { type: 'swipe' } },
                { $group: { _id: '$verdict', count: { $sum: 1 } } },
              ],
            },
          },
        ])
        .toArray();

      const [features, [activeKeys, refreshTokens, oauthClients, mcpCallerIds], cohort, [dauIds, wauIds, mauIds, weeklyActive], [namingFacet]] =
        await Promise.all([featurePromise, mcpPromise, cohortPromise, retentionPromise, namingPromise]);

      // MCP sets
      const apiKeyUsers = new Set(activeKeys.map((k) => k.userId));
      const oauthUsers = new Set(refreshTokens.map((t) => t.userId));
      const callerUsers = new Set((mcpCallerIds as any[]).filter(Boolean).map(String));
      const enabledUsers = new Set([...apiKeyUsers, ...oauthUsers, ...callerUsers]);
      const enabledAndActive = [...callerUsers].filter(
        (id) => apiKeyUsers.has(id) || oauthUsers.has(id)
      ).length;

      const clientNameMap = new Map(oauthClients.map((c) => [c.clientId, c.clientName]));
      const byClientMap = new Map<string, Set<string>>();
      for (const t of refreshTokens) {
        const name = clientNameMap.get(t.clientId) || t.clientId;
        if (!byClientMap.has(name)) byClientMap.set(name, new Set());
        byClientMap.get(name)!.add(t.userId);
      }
      const byClient = [...byClientMap.entries()]
        .map(([clientName, users]) => ({ clientName, users: users.size }))
        .sort((a, b) => b.users - a.users);

      // ── Funnel milestones for the cohort ────────────────────────────────
      const cohortIds = cohort.map((u) => u.id);
      const cohortObjectIds = toObjectIds(cohortIds);
      const createdAtMap = new Map(cohort.map((u) => [u.id, u.createdAt]));

      const firstByUser = async (collection: string) => {
        if (cohortObjectIds.length === 0) return new Map<string, Date>();
        const rows = await db
          .collection(collection)
          .aggregate([
            { $match: { userId: { $in: cohortObjectIds } } },
            { $group: { _id: '$userId', first: { $min: '$createdAt' } } },
          ])
          .toArray();
        return new Map<string, Date>(rows.map((r: any) => [String(r._id), r.first]));
      };

      const [firstGuideline, firstBranding, firstGenRows, cohortTransactions] = await Promise.all([
        firstByUser('brand_guidelines'),
        firstByUser('branding_projects'),
        cohortIds.length > 0
          ? usageCol
              .aggregate([
                { $match: { userId: { $in: cohortIds } } },
                {
                  $group: {
                    _id: '$userId',
                    first: { $min: { $ifNull: ['$timestamp', '$createdAt'] } },
                  },
                },
              ])
              .toArray()
          : Promise.resolve([]),
        cohortIds.length > 0
          ? prisma.transaction.findMany({
              where: { userId: { in: cohortIds }, status: 'completed' },
              select: { userId: true, createdAt: true },
              orderBy: { createdAt: 'asc' },
            })
          : Promise.resolve([]),
      ]);

      const firstBrand = new Map<string, Date>();
      for (const [id, date] of [...firstGuideline, ...firstBranding]) {
        const existing = firstBrand.get(id);
        if (!existing || date < existing) firstBrand.set(id, date);
      }
      const firstGeneration = new Map<string, Date>(
        firstGenRows.map((r: any) => [String(r._id), r.first])
      );
      const firstPayment = new Map<string, Date>();
      for (const t of cohortTransactions) {
        if (!firstPayment.has(t.userId)) firstPayment.set(t.userId, t.createdAt);
      }

      const hoursToStep = (milestones: Map<string, Date>) => {
        const hours: number[] = [];
        for (const [id, date] of milestones) {
          const created = createdAtMap.get(id);
          if (created && date) hours.push((date.getTime() - created.getTime()) / 3_600_000);
        }
        return median(hours);
      };

      const funnelCounts = [
        { key: 'signedUp', count: cohort.length, medianHoursToStep: null as number | null },
        { key: 'createdBrand', count: firstBrand.size, medianHoursToStep: hoursToStep(firstBrand) },
        {
          key: 'firstGeneration',
          count: firstGeneration.size,
          medianHoursToStep: hoursToStep(firstGeneration),
        },
        { key: 'paying', count: firstPayment.size, medianHoursToStep: hoursToStep(firstPayment) },
      ];
      const steps = funnelCounts.map((step, i) => ({
        ...step,
        pctOfPrev:
          i === 0
            ? 100
            : Math.round((step.count / Math.max(funnelCounts[i - 1].count, 1)) * 1000) / 10,
      }));

      // ── D. ICP segmentation (window-scoped feature usage) ───────────────
      const featureByUser = new Map<string, Set<FeatureKey>>();
      for (const f of features) {
        for (const id of f.userIds) {
          if (!featureByUser.has(id)) featureByUser.set(id, new Set());
          featureByUser.get(id)!.add(f.key);
        }
      }
      const activeUserIds = [...featureByUser.keys()].slice(0, 10000);
      const activeUsers =
        activeUserIds.length > 0
          ? await prisma.user.findMany({
              where: { id: { in: activeUserIds } },
              select: { id: true, email: true, subscriptionTier: true, userCategory: true },
            })
          : [];
      const userInfoMap = new Map(activeUsers.map((u) => [u.id, u]));

      const tierMatrix = new Map<string, Record<string, number>>();
      for (const [id, featureSet] of featureByUser) {
        const tier = userInfoMap.get(id)?.subscriptionTier || 'unknown';
        if (!tierMatrix.has(tier)) tierMatrix.set(tier, {});
        const row = tierMatrix.get(tier)!;
        for (const f of featureSet) row[f] = (row[f] || 0) + 1;
      }
      const tierFeatureMatrix = [...tierMatrix.entries()].map(([tier, featuresCount]) => ({
        tier,
        features: featuresCount,
      }));

      const powerUsers = [...featureByUser.entries()]
        .sort((a, b) => b[1].size - a[1].size)
        .slice(0, 20)
        .map(([id, featureSet]) => ({
          userId: id,
          email: userInfoMap.get(id)?.email || 'unknown',
          tier: userInfoMap.get(id)?.subscriptionTier || 'unknown',
          featureCount: featureSet.size,
          features: [...featureSet],
        }));

      const categoryGroups = await prisma.user.groupBy({
        by: ['userCategory'],
        _count: { _all: true },
      });
      const userCategories = categoryGroups
        .map((g) => ({ category: g.userCategory || 'none', count: g._count._all }))
        .sort((a, b) => b.count - a.count);

      const namingGenerate = namingFacet?.generate?.[0] || {
        batches: 0,
        namesGenerated: 0,
        tokensSpent: 0,
        uniqueUsers: 0,
      };
      const swipeCounts: Record<string, number> = { nope: 0, like: 0, superlike: 0 };
      for (const s of namingFacet?.swipes || []) {
        if (s?._id && swipeCounts[s._id] !== undefined) swipeCounts[s._id] = s.count;
      }
      const totalSwipes = swipeCounts.nope + swipeCounts.like + swipeCounts.superlike;
      const likeRate =
        totalSwipes > 0 ? Math.round(((swipeCounts.like + swipeCounts.superlike) / totalSwipes) * 1000) / 1000 : 0;

      const payload = {
        days,
        generatedAt: now.toISOString(),
        cached: false,
        naming: {
          batches: namingGenerate.batches || 0,
          namesGenerated: namingGenerate.namesGenerated || 0,
          tokensSpent: namingGenerate.tokensSpent || 0,
          uniqueUsers: namingGenerate.uniqueUsers || 0,
          swipes: swipeCounts,
          likeRate,
          byModel: namingFacet?.byModel || [],
        },
        features: Object.fromEntries(
          features.map((f) => [
            f.key,
            {
              total: f.total,
              allTime: f.allTime,
              distinctUsers: f.distinctUsers,
              byDay: f.byDay,
            },
          ])
        ),
        mcp: {
          activeApiKeyUsers: apiKeyUsers.size,
          oauthUsers: oauthUsers.size,
          activeCallers: callerUsers.size,
          totalEnabled: enabledUsers.size,
          enabledAndActive,
          byClient,
        },
        funnel: { cohortDays: days, steps },
        icp: { tierFeatureMatrix, powerUsers, userCategories },
        retention: {
          dau: dauIds.length,
          wau: wauIds.length,
          mau: mauIds.length,
          weeklyActive,
        },
      };

      try {
        await redisClient.setex(cacheKey, CACHE_TTL.ADMIN_ANALYTICS, JSON.stringify(payload));
      } catch (err) {
        console.warn('[admin-analytics] Redis SET failed:', (err as Error).message);
      }

      return res.json(payload);
    } catch (error: any) {
      console.error('[admin-analytics] error:', error);
      return res.status(500).json({ error: 'Failed to fetch product analytics' });
    }
  }
);

export default router;

import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';

export async function trendingKeywords({ limit = 8 } = {}) {
  const take = Math.min(Math.max(Number(limit) || 8, 1), 20);
  const tags = await prisma.$queryRaw(Prisma.sql`
    SELECT t.name, t.slug, COUNT(DISTINCT r.id)::int AS count
    FROM tags t
    JOIN recipe_tags rt ON rt."tagId" = t.id
    JOIN recipes r ON r.id = rt."recipeId"
    JOIN users u ON u.id = r."authorId"
    WHERE r.status = 'PUBLISHED'
      AND r.visibility = 'PUBLIC'
      AND r."deletedAt" IS NULL
      AND r."hiddenAt" IS NULL
      AND u.status = 'ACTIVE'
      AND u."deletedAt" IS NULL
      AND r."publishedAt" >= now() - interval '30 days'
    GROUP BY t.id, t.name, t.slug
    ORDER BY count DESC, t.name ASC
    LIMIT ${take}
  `);
  return tags.map((tag) => ({ keyword: tag.name, slug: tag.slug, count: tag.count, type: 'TAG' }));
}

import crypto from 'node:crypto';
import { prisma } from '../lib/prisma.js';
import { readableRecipeWhere } from '../utils/recipeAccess.js';

function notFound() {
  const error = new Error('Recipe not found');
  error.statusCode = 404;
  error.code = 'RECIPE_NOT_FOUND';
  return error;
}

function buildViewerKey(userId, ip, userAgent) {
  const identity = userId ? `user:${userId}` : `guest:${ip || 'unknown'}:${userAgent || 'unknown'}`;
  const day = new Date().toISOString().slice(0, 10);
  return crypto.createHash('sha256').update(`${identity}|${day}`).digest('hex').slice(0, 120);
}

export async function recordRecipeView(recipeId, { userId, ip, userAgent } = {}) {
  const recipe = await prisma.recipe.findFirst({
    where: { id: recipeId, ...readableRecipeWhere },
    select: { id: true, viewCount: true },
  });
  if (!recipe) throw notFound();

  const viewerKey = buildViewerKey(userId, ip, userAgent);

  return prisma.$transaction(async (transaction) => {
    const inserted = await transaction.recipeView.createMany({
      data: [{ recipeId, viewerKey }],
      skipDuplicates: true,
    });

    if (!inserted.count) {
      const current = await transaction.recipe.findUnique({ where: { id: recipeId }, select: { viewCount: true } });
      return { recorded: false, viewCount: current?.viewCount ?? recipe.viewCount };
    }

    const updated = await transaction.recipe.update({
      where: { id: recipeId },
      data: { viewCount: { increment: 1 } },
      select: { viewCount: true },
    });
    return { recorded: true, viewCount: updated.viewCount };
  });
}

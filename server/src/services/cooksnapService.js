import { prisma } from '../lib/prisma.js';
import { createNotification } from './notificationService.js';

function error(message, code, statusCode) { const result = new Error(message); result.code = code; result.statusCode = statusCode; return result; }
const authorSelect = { id: true, username: true, profile: { select: { displayName: true, avatarUrl: true } } };

export async function listCooksnaps(recipeId) {
  const recipe = await prisma.recipe.findFirst({ where: { id: recipeId, status: 'PUBLISHED', visibility: 'PUBLIC', deletedAt: null, hiddenAt: null, author: { status: 'ACTIVE', deletedAt: null } }, select: { id: true } });
  if (!recipe) throw error('Recipe not found', 'RECIPE_NOT_FOUND', 404);
  return prisma.cooksnap.findMany({ where: { recipeId, status: 'ACTIVE', deletedAt: null, author: { status: 'ACTIVE', deletedAt: null } }, orderBy: { createdAt: 'desc' }, include: { author: { select: authorSelect } } });
}

export async function createCooksnap(authorId, recipeId, input) {
  const recipe = await prisma.recipe.findFirst({ where: { id: recipeId, status: 'PUBLISHED', visibility: 'PUBLIC', deletedAt: null, hiddenAt: null, author: { status: 'ACTIVE', deletedAt: null } }, select: { id: true, title: true, slug: true, authorId: true } });
  if (!recipe) throw error('Recipe not found', 'RECIPE_NOT_FOUND', 404);
  return prisma.$transaction(async (transaction) => {
    let imageUrl = input.imageUrl;
    if (input.mediaAssetId) {
      const asset = await transaction.mediaAsset.findFirst({ where: { id: input.mediaAssetId, ownerId: authorId, status: 'UPLOADED', attachedAt: null } });
      if (!asset) throw error('Media asset is unavailable or does not belong to this user', 'MEDIA_ASSET_FORBIDDEN', 403);
      imageUrl = asset.secureUrl;
    }
    const cooksnap = await transaction.cooksnap.create({ data: { recipeId, authorId, imageUrl, mediaAssetId: input.mediaAssetId || null, caption: input.caption }, include: { author: { select: authorSelect } } });
    if (input.mediaAssetId) await transaction.mediaAsset.update({ where: { id: input.mediaAssetId }, data: { status: 'ATTACHED', attachedAt: new Date() } });
    await transaction.recipe.update({ where: { id: recipeId }, data: { cookSnapCount: { increment: 1 } } });
    if (recipe.authorId !== authorId) {
      const actorName = cooksnap.author.profile?.displayName || cooksnap.author.username;
      await createNotification(transaction, {
        userId: recipe.authorId,
        type: 'RECIPE_COOKSNAP',
        title: 'Cooksnap mới',
        message: `${actorName} đã nấu thử công thức "${recipe.title}".`,
        actionUrl: `/cong-thuc/${recipe.slug}`,
      });
    }
    return cooksnap;
  });
}

export async function updateCooksnap(authorId, id, input) {
  const cooksnap = await prisma.cooksnap.findUnique({ where: { id }, select: { id: true, authorId: true, status: true, mediaAssetId: true } });
  if (!cooksnap || cooksnap.status === 'DELETED') throw error('Cooksnap not found', 'COOKSNAP_NOT_FOUND', 404);
  if (cooksnap.authorId !== authorId) throw error('You do not have permission to edit this cooksnap', 'FORBIDDEN', 403);
  return prisma.$transaction(async (transaction) => {
    let imageUrl;
    if (input.mediaAssetId) {
      const asset = await transaction.mediaAsset.findFirst({ where: { id: input.mediaAssetId, ownerId: authorId, status: { in: ['UPLOADED', 'ATTACHED'] } } });
      if (!asset?.secureUrl) throw error('Media asset is unavailable or does not belong to this user', 'MEDIA_ASSET_FORBIDDEN', 403);
      if (input.mediaAssetId !== cooksnap.mediaAssetId) {
        imageUrl = asset.secureUrl;
        await transaction.mediaAsset.update({ where: { id: input.mediaAssetId }, data: { status: 'ATTACHED', attachedAt: new Date() } });
      }
    }
    return transaction.cooksnap.update({
      where: { id },
      data: {
        ...(input.caption !== undefined ? { caption: input.caption } : {}),
        ...(imageUrl ? { imageUrl, mediaAssetId: input.mediaAssetId } : {}),
      },
      include: { author: { select: authorSelect } },
    });
  });
}

export async function deleteCooksnap(authorId, id, role) {
  const cooksnap = await prisma.cooksnap.findUnique({ where: { id }, select: { id: true, authorId: true, recipeId: true, status: true, deletedAt: true } });
  if (!cooksnap || cooksnap.status === 'DELETED') throw error('Cooksnap not found', 'COOKSNAP_NOT_FOUND', 404);
  if (cooksnap.authorId !== authorId && !['MODERATOR', 'ADMIN'].includes(role)) throw error('You do not have permission to delete this cooksnap', 'FORBIDDEN', 403);
  const wasActive = cooksnap.status === 'ACTIVE' && !cooksnap.deletedAt;
  return prisma.$transaction(async (transaction) => {
    await transaction.cooksnap.update({ where: { id }, data: { status: 'DELETED', deletedAt: new Date() } });
    if (wasActive) {
      await transaction.recipe.updateMany({ where: { id: cooksnap.recipeId, cookSnapCount: { gt: 0 } }, data: { cookSnapCount: { decrement: 1 } } });
    }
  });
}

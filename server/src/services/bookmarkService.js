import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';

function serviceError(message, code, statusCode) {
  const error = new Error(message); error.code = code; error.statusCode = statusCode; return error;
}

const recipeSelect = {
  id: true, title: true, slug: true, description: true, coverImageId: true,
  status: true, visibility: true, category: { select: { name: true, slug: true } },
};

export async function listBookmarks(userId) {
  return prisma.bookmark.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, include: { recipe: { select: recipeSelect }, collection: { select: { id: true, name: true } } } });
}

export async function addBookmark(userId, recipeId, collectionId) {
  const recipe = await prisma.recipe.findFirst({ where: { id: recipeId, status: 'PUBLISHED', visibility: 'PUBLIC', deletedAt: null, hiddenAt: null, author: { status: 'ACTIVE', deletedAt: null } }, select: { id: true } });
  if (!recipe) throw serviceError('Recipe not found', 'RECIPE_NOT_FOUND', 404);
  if (collectionId) {
    const collection = await prisma.collection.findFirst({ where: { id: collectionId, ownerId: userId }, select: { id: true } });
    if (!collection) throw serviceError('Collection not found', 'COLLECTION_NOT_FOUND', 404);
  }
  try {
    return await prisma.$transaction(async (transaction) => {
      const existing = await transaction.bookmark.findUnique({ where: { userId_recipeId: { userId, recipeId } }, select: { userId: true } });
      const bookmark = await transaction.bookmark.upsert({ where: { userId_recipeId: { userId, recipeId } }, create: { userId, recipeId, collectionId: collectionId || null }, update: { collectionId: collectionId || null }, include: { recipe: { select: recipeSelect }, collection: { select: { id: true, name: true } } } });
      if (!existing) await transaction.recipe.update({ where: { id: recipeId }, data: { saveCount: { increment: 1 } } });
      return bookmark;
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') throw serviceError('Recipe or collection not found', 'REFERENCE_NOT_FOUND', 404);
    throw error;
  }
}

export async function removeBookmark(userId, recipeId) {
  const deleted = await prisma.bookmark.deleteMany({ where: { userId, recipeId } });
  if (!deleted.count) throw serviceError('Bookmark not found', 'BOOKMARK_NOT_FOUND', 404);
}

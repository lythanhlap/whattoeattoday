import { prisma } from '../lib/prisma.js';
import { createNotification } from './notificationService.js';

function failure(message, code, statusCode) { const error = new Error(message); error.code = code; error.statusCode = statusCode; return error; }
const author = { id: true, username: true, profile: { select: { displayName: true, avatarUrl: true } } };

async function publicRecipe(recipeId) {
  const recipe = await prisma.recipe.findFirst({ where: { id: recipeId, status: 'PUBLISHED', visibility: 'PUBLIC', deletedAt: null, hiddenAt: null, author: { status: 'ACTIVE', deletedAt: null } }, select: { id: true, title: true, slug: true, authorId: true } });
  if (!recipe) throw failure('Recipe not found', 'RECIPE_NOT_FOUND', 404);
  return recipe;
}

export async function listComments(recipeId) { await publicRecipe(recipeId); return prisma.comment.findMany({ where: { recipeId, status: 'ACTIVE', deletedAt: null, author: { status: 'ACTIVE', deletedAt: null } }, orderBy: { createdAt: 'asc' }, include: { author: { select: author } } }); }

export async function createComment(authorId, recipeId, input) {
  const recipe = await publicRecipe(recipeId);
  return prisma.$transaction(async (transaction) => {
    const comment = await transaction.comment.create({ data: { authorId, recipeId, content: input.content }, include: { author: { select: author } } });
    if (recipe.authorId !== authorId) {
      const actorName = comment.author.profile?.displayName || comment.author.username;
      await createNotification(transaction, {
        userId: recipe.authorId,
        type: 'RECIPE_COMMENT',
        title: 'Bình luận mới',
        message: `${actorName} đã bình luận công thức "${recipe.title}".`,
        actionUrl: `/cong-thuc/${recipe.slug}`,
      });
    }
    return comment;
  });
}
export async function deleteComment(actorId, id, role) {
  const comment = await prisma.comment.findUnique({ where: { id }, select: { authorId: true, status: true } });
  if (!comment || comment.status === 'DELETED') throw failure('Comment not found', 'COMMENT_NOT_FOUND', 404);
  if (comment.authorId !== actorId && !['MODERATOR', 'ADMIN'].includes(role)) throw failure('You do not have permission to delete this comment', 'FORBIDDEN', 403);
  await prisma.comment.update({ where: { id }, data: { status: ['MODERATOR', 'ADMIN'].includes(role) && comment.authorId !== actorId ? 'HIDDEN' : 'DELETED', deletedAt: new Date() } });
}

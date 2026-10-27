import { prisma } from '../lib/prisma.js';

function failure(message, code, statusCode) { const error = new Error(message); error.code = code; error.statusCode = statusCode; return error; }
const author = { id: true, username: true, profile: { select: { displayName: true, avatarUrl: true } } };

async function publicRecipe(recipeId) {
  const recipe = await prisma.recipe.findFirst({ where: { id: recipeId, status: 'PUBLISHED', visibility: 'PUBLIC', deletedAt: null, hiddenAt: null, author: { status: 'ACTIVE', deletedAt: null } }, select: { id: true } });
  if (!recipe) throw failure('Recipe not found', 'RECIPE_NOT_FOUND', 404);
}

export async function listComments(recipeId) { await publicRecipe(recipeId); return prisma.comment.findMany({ where: { recipeId, status: 'ACTIVE', deletedAt: null, author: { status: 'ACTIVE', deletedAt: null } }, orderBy: { createdAt: 'asc' }, include: { author: { select: author } } }); }
export async function createComment(authorId, recipeId, input) { await publicRecipe(recipeId); return prisma.comment.create({ data: { authorId, recipeId, content: input.content }, include: { author: { select: author } } }); }
export async function deleteComment(actorId, id, role) {
  const comment = await prisma.comment.findUnique({ where: { id }, select: { authorId: true, status: true } });
  if (!comment || comment.status === 'DELETED') throw failure('Comment not found', 'COMMENT_NOT_FOUND', 404);
  if (comment.authorId !== actorId && !['MODERATOR', 'ADMIN'].includes(role)) throw failure('You do not have permission to delete this comment', 'FORBIDDEN', 403);
  await prisma.comment.update({ where: { id }, data: { status: ['MODERATOR', 'ADMIN'].includes(role) && comment.authorId !== actorId ? 'HIDDEN' : 'DELETED', deletedAt: new Date() } });
}

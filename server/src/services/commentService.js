import { prisma } from '../lib/prisma.js';
import { createNotification } from './notificationService.js';

function failure(message, code, statusCode) { const error = new Error(message); error.code = code; error.statusCode = statusCode; return error; }
const author = { id: true, username: true, profile: { select: { displayName: true, avatarUrl: true } } };

async function publicRecipe(recipeId) {
  const recipe = await prisma.recipe.findFirst({ where: { id: recipeId, status: 'PUBLISHED', visibility: 'PUBLIC', deletedAt: null, hiddenAt: null, author: { status: 'ACTIVE', deletedAt: null } }, select: { id: true, title: true, slug: true, authorId: true } });
  if (!recipe) throw failure('Recipe not found', 'RECIPE_NOT_FOUND', 404);
  return recipe;
}

async function activeParent(recipeId, parentId) {
  const parent = await prisma.comment.findFirst({
    where: { id: parentId, recipeId, status: 'ACTIVE', deletedAt: null, author: { status: 'ACTIVE', deletedAt: null } },
    select: { id: true, parentId: true, authorId: true },
  });
  if (!parent) throw failure('Parent comment not found', 'COMMENT_PARENT_NOT_FOUND', 404);
  if (parent.parentId) throw failure('Replies to replies are not supported', 'COMMENT_REPLY_DEPTH_NOT_SUPPORTED', 422);
  return parent;
}

export async function listComments(recipeId) {
  await publicRecipe(recipeId);
  const comments = await prisma.comment.findMany({
    where: { recipeId, status: 'ACTIVE', deletedAt: null, author: { status: 'ACTIVE', deletedAt: null } },
    orderBy: { createdAt: 'asc' },
    include: { author: { select: author } },
  });
  const repliesByParent = new Map();
  for (const comment of comments) {
    if (!comment.parentId) continue;
    const bucket = repliesByParent.get(comment.parentId) ?? [];
    bucket.push(comment);
    repliesByParent.set(comment.parentId, bucket);
  }
  return comments
    .filter((comment) => !comment.parentId)
    .map((comment) => ({ ...comment, replies: repliesByParent.get(comment.id) ?? [] }));
}

export async function createComment(authorId, recipeId, input) {
  const recipe = await publicRecipe(recipeId);
  const parent = input.parentId ? await activeParent(recipeId, input.parentId) : null;
  return prisma.$transaction(async (transaction) => {
    const comment = await transaction.comment.create({ data: { authorId, recipeId, parentId: parent?.id ?? null, content: input.content }, include: { author: { select: author } } });
    const actorName = comment.author.profile?.displayName || comment.author.username;

    if (parent && parent.authorId !== authorId) {
      await createNotification(transaction, {
        userId: parent.authorId,
        type: 'COMMENT_REPLY',
        title: 'Phản hồi mới',
        message: `${actorName} đã trả lời bình luận của bạn trong công thức "${recipe.title}".`,
        actionUrl: `/cong-thuc/${recipe.slug}#binh-luan-${comment.id}`,
      });
    }

    if (recipe.authorId !== authorId && recipe.authorId !== parent?.authorId) {
      await createNotification(transaction, {
        userId: recipe.authorId,
        type: 'RECIPE_COMMENT',
        title: 'Bình luận mới',
        message: parent
          ? `${actorName} đã trả lời một bình luận trong công thức "${recipe.title}".`
          : `${actorName} đã bình luận công thức "${recipe.title}".`,
        actionUrl: `/cong-thuc/${recipe.slug}`,
      });
    }
    return comment;
  });
}

export async function deleteComment(actorId, id, role) {
  const comment = await prisma.comment.findUnique({ where: { id }, select: { authorId: true, parentId: true, status: true, deletedAt: true } });
  if (!comment || comment.status === 'DELETED' || comment.deletedAt) throw failure('Comment not found', 'COMMENT_NOT_FOUND', 404);
  const canModerate = ['MODERATOR', 'ADMIN'].includes(role);
  if (comment.authorId !== actorId && !canModerate) throw failure('You do not have permission to delete this comment', 'FORBIDDEN', 403);

  if (comment.authorId !== actorId) {
    await prisma.comment.update({ where: { id }, data: { status: 'HIDDEN' } });
    return;
  }

  const deletedAt = new Date();
  await prisma.$transaction(async (transaction) => {
    await transaction.comment.update({ where: { id }, data: { status: 'DELETED', deletedAt } });
    if (!comment.parentId) {
      await transaction.comment.updateMany({ where: { parentId: id, deletedAt: null }, data: { status: 'DELETED', deletedAt } });
    }
  });
}

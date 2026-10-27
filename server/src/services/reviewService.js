import { prisma } from '../lib/prisma.js';

const reviewInclude = {
  author: { select: { id: true, username: true, profile: { select: { displayName: true, avatarUrl: true } } } },
  category: true,
  coverImage: { select: { id: true, secureUrl: true } },
  ingredients: { orderBy: { sortOrder: 'asc' } },
  steps: { orderBy: { stepNumber: 'asc' } },
  tags: { include: { tag: true } },
  _count: { select: { cooksnaps: { where: { status: 'ACTIVE', deletedAt: null } }, comments: { where: { status: 'ACTIVE', deletedAt: null } } } },
};

const REVIEW_ACTIONS = {
  APPROVE: { status: 'PUBLISHED', visibility: 'PUBLIC', type: 'RECIPE_APPROVED', audit: 'RECIPE_APPROVED', title: 'Công thức đã được duyệt' },
  REJECT: { status: 'REJECTED', visibility: 'PRIVATE', type: 'RECIPE_REJECTED', audit: 'RECIPE_REJECTED', title: 'Công thức bị từ chối' },
  REQUEST_CHANGES: { status: 'DRAFT', visibility: 'PRIVATE', type: 'RECIPE_CHANGES_REQUESTED', audit: 'RECIPE_CHANGES_REQUESTED', title: 'Công thức cần chỉnh sửa' },
};

function fail(message, code, statusCode = 422) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  return error;
}

function serialize(recipe) {
  return {
    ...recipe,
    cooksnapCount: recipe._count?.cooksnaps ?? 0,
    commentCount: recipe._count?.comments ?? 0,
    _count: undefined,
  };
}

export async function listReviewQueue({ page = 1, limit = 20, status = 'PENDING_REVIEW' } = {}) {
  const take = Math.min(Math.max(Number(limit) || 20, 1), 50);
  const currentPage = Math.max(Number(page) || 1, 1);
  const skip = (currentPage - 1) * take;
  const where = { deletedAt: null, hiddenAt: null, status };
  const [items, total] = await prisma.$transaction([
    prisma.recipe.findMany({ where, skip, take, orderBy: { updatedAt: 'asc' }, include: reviewInclude }),
    prisma.recipe.count({ where }),
  ]);
  return { items: items.map(serialize), meta: { page: currentPage, limit: take, total, totalPages: Math.ceil(total / take) } };
}

export async function reviewRecipe(actorId, actorRole, recipeId, input) {
  if (!['EDITOR', 'ADMIN'].includes(actorRole)) {
    throw fail('Only editors and admins can review recipes', 'FORBIDDEN', 403);
  }
  const action = REVIEW_ACTIONS[input.action];
  if (!action) throw fail('Review action is invalid', 'REVIEW_ACTION_INVALID');

  const recipe = await prisma.recipe.findUnique({
    where: { id: recipeId },
    include: { author: { select: { id: true } }, ingredients: { select: { id: true } }, steps: { select: { id: true } } },
  });
  if (!recipe || recipe.deletedAt) throw fail('Recipe not found', 'RECIPE_NOT_FOUND', 404);
  if (!['PENDING_REVIEW', 'REJECTED', 'DRAFT'].includes(recipe.status)) {
    throw fail('Recipe is not waiting for editorial review', 'RECIPE_REVIEW_INVALID_STATE', 409);
  }
  if (input.action === 'APPROVE') {
    const complete = recipe.coverImageId && recipe.ingredients.length > 0 && recipe.steps.length > 0;
    if (!complete) throw fail('Recipe needs a cover image, ingredients and steps before approval', 'RECIPE_INCOMPLETE');
  }

  const now = new Date();
  const note = input.note?.trim() || null;
  const visibility = input.action === 'APPROVE'
    ? (recipe.visibility === 'UNLISTED' ? 'UNLISTED' : 'PUBLIC')
    : action.visibility;
  const updated = await prisma.$transaction(async (transaction) => {
    const saved = await transaction.recipe.update({
      where: { id: recipeId },
      data: {
        status: action.status,
        visibility,
        publishedAt: input.action === 'APPROVE' ? now : null,
        reviewedAt: now,
        reviewNote: note,
      },
      include: reviewInclude,
    });
    const notification = await transaction.notification.create({
      data: {
        userId: recipe.authorId,
        type: action.type,
        title: action.title,
        message: note
          ? `${saved.title}: ${note}`
          : `Công thức "${saved.title}" đã được xử lý bởi biên tập viên.`,
      },
    });
    await transaction.auditLog.create({
      data: {
        actorId,
        action: action.audit,
        targetType: 'RECIPE',
        targetId: recipeId,
        details: { note, notificationId: notification.id, previousStatus: recipe.status },
      },
    });
    return saved;
  });

  return serialize(updated);
}

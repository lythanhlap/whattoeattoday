import { prisma } from '../lib/prisma.js';

const roles = new Set(['USER', 'EDITOR', 'MODERATOR', 'ADMIN']);
const statuses = new Set(['PENDING', 'ACTIVE', 'SUSPENDED', 'DELETED']);

const contentModels = {
  recipes: {
    targetType: 'RECIPE',
    select: { id: true, authorId: true, title: true, hiddenAt: true, deletedAt: true, status: true, visibility: true },
    label: (item) => item.title,
  },
  comments: {
    targetType: 'COMMENT',
    select: { id: true, authorId: true, content: true, status: true, deletedAt: true, recipeId: true },
    label: (item) => item.content.slice(0, 80),
  },
  cooksnaps: {
    targetType: 'COOKSNAP',
    select: { id: true, authorId: true, status: true, deletedAt: true, recipeId: true },
    label: () => 'ảnh cooksnap',
  },
};

function invalid(message, code = 'VALIDATION_ERROR') { const error = new Error(message); error.statusCode = 422; error.code = code; return error; }
function notFound() { const error = new Error('User not found'); error.statusCode = 404; error.code = 'USER_NOT_FOUND'; return error; }
function contentNotFound() { const error = new Error('Content not found'); error.statusCode = 404; error.code = 'CONTENT_NOT_FOUND'; return error; }
function conflict(message, code) { const error = new Error(message); error.statusCode = 409; error.code = code; return error; }

export async function listUsers({ page = 1, limit = 25, q, status, role }) {
  const take = Math.min(Math.max(Number(limit) || 25, 1), 100); const skip = (Math.max(Number(page) || 1, 1) - 1) * take;
  const where = { ...(status && statuses.has(status) ? { status } : {}), ...(role && roles.has(role) ? { role } : {}), ...(q ? { OR: [{ username: { contains: q, mode: 'insensitive' } }, { email: { contains: q, mode: 'insensitive' } }, { profile: { displayName: { contains: q, mode: 'insensitive' } } }] } : {}) };
  const [items, total] = await prisma.$transaction([
    prisma.user.findMany({ where, skip, take, orderBy: { createdAt: 'desc' }, select: { id: true, email: true, username: true, role: true, status: true, createdAt: true, lastLoginAt: true, suspendedUntil: true, profile: { select: { displayName: true, avatarUrl: true } } } }),
    prisma.user.count({ where }),
  ]);
  return { items, meta: { page: Math.floor(skip / take) + 1, limit: take, total, totalPages: Math.ceil(total / take) } };
}

export async function updateUser(actorId, userId, input) {
  if (actorId === userId && (input.role === 'USER' || input.status === 'SUSPENDED' || input.status === 'DELETED')) throw invalid('Admin cannot remove own administrative access', 'SELF_ADMIN_LOCKOUT');
  if (input.role !== undefined && !roles.has(input.role)) throw invalid('Role is invalid');
  if (input.status !== undefined && !statuses.has(input.status)) throw invalid('Status is invalid');
  const current = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true, status: true } });
  if (!current) throw notFound();
  return prisma.$transaction(async (transaction) => {
    const user = await transaction.user.update({
      where: { id: userId },
      data: {
        ...(input.role ? { role: input.role } : {}),
        ...(input.status ? {
          status: input.status,
          ...(input.status === 'DELETED' ? { deletedAt: new Date(), suspendedUntil: null, suspensionReason: null } : {}),
          ...(input.status === 'ACTIVE' ? { deletedAt: null, suspendedUntil: null, suspensionReason: null } : {}),
        } : {}),
      },
      select: { id: true, email: true, username: true, role: true, status: true, createdAt: true, lastLoginAt: true, suspendedUntil: true, profile: { select: { displayName: true, avatarUrl: true } } },
    });
    await transaction.auditLog.create({ data: { actorId, action: 'USER_UPDATED', targetType: 'USER', targetId: userId, details: { before: current, after: { role: user.role, status: user.status } } } });
    if (input.status === 'SUSPENDED' || input.status === 'DELETED') await transaction.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
    return user;
  });
}

export function validateUserUpdate(input) {
  if (!input || (input.role === undefined && input.status === undefined)) throw invalid('Role or status is required');
  return input;
}

export async function warnUser(actorId, userId, message) {
  if (typeof message !== 'string' || message.trim().length < 1 || message.length > 1000) throw invalid('Warning message must be 1 to 1000 characters');
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) throw notFound();
  return prisma.$transaction(async (transaction) => {
    const notification = await transaction.notification.create({ data: { userId, type: 'MODERATION_WARNING', title: 'Cảnh báo nội dung', message: message.trim() } });
    await transaction.auditLog.create({ data: { actorId, action: 'USER_WARNED', targetType: 'USER', targetId: userId, details: { notificationId: notification.id } } });
    return notification;
  });
}

export async function suspendUser(actorId, actorRole, userId, input) {
  if (actorId === userId) throw invalid('You cannot suspend your own account', 'SELF_SUSPENSION_FORBIDDEN');
  const target = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true, status: true, deletedAt: true } });
  if (!target || target.deletedAt) throw notFound();
  if (actorRole !== 'ADMIN' && ['ADMIN', 'EDITOR'].includes(target.role)) {
    const error = new Error('Moderators can only suspend member accounts');
    error.statusCode = 403;
    error.code = 'SUSPENSION_FORBIDDEN';
    throw error;
  }
  if (target.role === 'ADMIN') throw invalid('Admin accounts cannot be suspended from moderation', 'SUSPENSION_FORBIDDEN');
  const suspendedUntil = new Date(Date.now() + input.durationDays * 24 * 60 * 60 * 1000);
  return prisma.$transaction(async (transaction) => {
    const user = await transaction.user.update({
      where: { id: userId },
      data: { status: 'SUSPENDED', suspendedUntil, suspensionReason: input.reason },
      select: { id: true, username: true, status: true, suspendedUntil: true, suspensionReason: true },
    });
    await transaction.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
    const notification = await transaction.notification.create({
      data: {
        userId,
        type: 'ACCOUNT_SUSPENDED',
        title: 'Tài khoản bị khóa tạm thời',
        message: `Tài khoản của bạn bị khóa đến ${suspendedUntil.toLocaleDateString('vi-VN')}. Lý do: ${input.reason}`,
      },
    });
    await transaction.auditLog.create({
      data: { actorId, action: 'USER_SUSPENDED', targetType: 'USER', targetId: userId, details: { durationDays: input.durationDays, suspendedUntil, reason: input.reason, notificationId: notification.id } },
    });
    return user;
  });
}

export async function contentStats() {
  const [recipes, comments, cooksnaps, openReports] = await prisma.$transaction([
    prisma.recipe.count({ where: { deletedAt: null } }),
    prisma.comment.count({ where: { deletedAt: null, status: 'ACTIVE' } }),
    prisma.cooksnap.count({ where: { deletedAt: null, status: 'ACTIVE' } }),
    prisma.report.count({ where: { status: 'OPEN' } }),
  ]);
  return { recipes, comments, cooksnaps, openReports };
}

function contentWhere(type, { q, state }) {
  const hiddenState = state === 'hidden';
  if (type === 'recipes') {
    return {
      ...(hiddenState
        ? { OR: [{ hiddenAt: { not: null } }, { deletedAt: { not: null } }] }
        : state === 'visible' ? { hiddenAt: null, deletedAt: null } : {}),
      ...(q ? { title: { contains: q, mode: 'insensitive' } } : {}),
    };
  }
  if (type === 'comments') {
    return {
      ...(hiddenState
        ? { OR: [{ status: { not: 'ACTIVE' } }, { deletedAt: { not: null } }] }
        : state === 'visible' ? { status: 'ACTIVE', deletedAt: null } : {}),
      ...(q ? { content: { contains: q, mode: 'insensitive' } } : {}),
    };
  }
  const conditions = [];
  if (hiddenState) conditions.push({ OR: [{ status: { not: 'ACTIVE' } }, { deletedAt: { not: null } }] });
  else if (state === 'visible') conditions.push({ status: 'ACTIVE', deletedAt: null });
  if (q) conditions.push({ OR: [{ caption: { contains: q, mode: 'insensitive' } }, { recipe: { title: { contains: q, mode: 'insensitive' } } }] });
  return conditions.length ? { AND: conditions } : {};
}

const contentSelect = {
  recipes: {
    id: true, title: true, slug: true, status: true, visibility: true, hiddenAt: true, hiddenReason: true,
    deletedAt: true, featuredAt: true, createdAt: true, coverImage: { select: { secureUrl: true } },
    author: { select: { id: true, username: true, profile: { select: { displayName: true } } } },
  },
  comments: {
    id: true, content: true, status: true, deletedAt: true, createdAt: true,
    author: { select: { id: true, username: true, profile: { select: { displayName: true } } } },
    recipe: { select: { id: true, title: true, slug: true } },
  },
  cooksnaps: {
    id: true, imageUrl: true, caption: true, status: true, deletedAt: true, createdAt: true,
    author: { select: { id: true, username: true, profile: { select: { displayName: true } } } },
    recipe: { select: { id: true, title: true, slug: true } },
  },
};

export async function listContent({ page = 1, limit = 20, type, state, q }) {
  const take = Math.min(Math.max(Number(limit) || 20, 1), 50);
  const skip = (Math.max(Number(page) || 1, 1) - 1) * take;
  const where = contentWhere(type, { q, state });
  const model = prisma[type === 'recipes' ? 'recipe' : type === 'comments' ? 'comment' : 'cooksnap'];
  const [items, total] = await prisma.$transaction([
    model.findMany({ where, skip, take, orderBy: { createdAt: 'desc' }, select: contentSelect[type] }),
    model.count({ where }),
  ]);
  return { items, meta: { page: Math.floor(skip / take) + 1, limit: take, total, totalPages: Math.ceil(total / take), type, state } };
}

export async function contentDashboard() {
  const [recipes, comments, cooksnaps, reports] = await prisma.$transaction([
    prisma.recipe.findMany({ where: { deletedAt: null }, take: 20, orderBy: { createdAt: 'desc' }, select: contentSelect.recipes }),
    prisma.comment.findMany({ where: { deletedAt: null }, take: 20, orderBy: { createdAt: 'desc' }, select: contentSelect.comments }),
    prisma.cooksnap.findMany({ where: { deletedAt: null }, take: 20, orderBy: { createdAt: 'desc' }, select: contentSelect.cooksnaps }),
    prisma.report.findMany({ where: { status: 'OPEN' }, take: 50, orderBy: { createdAt: 'asc' }, select: { id: true, reason: true, status: true, recipeId: true, commentId: true, cooksnapId: true, createdAt: true } }),
  ]);
  return { recipes, comments, cooksnaps, reports };
}

async function applyContentActionCore(transaction, actorId, type, id, input) {
  const model = contentModels[type];
  if (!model) throw invalid('Content type is invalid');
  const target = await transaction[type === 'recipes' ? 'recipe' : type === 'comments' ? 'comment' : 'cooksnap'].findUnique({ where: { id }, select: model.select });
  if (!target) throw contentNotFound();

  const now = new Date();
  let changed = true;
  let updateData;
  let notificationTitle;
  let notificationMessage;

  if (type === 'recipes') {
    if (input.action === 'HIDE') {
      if (target.deletedAt) throw conflict('Deleted content cannot be hidden', 'CONTENT_DELETED');
      if (target.hiddenAt) changed = false;
      updateData = { hiddenAt: now, hiddenReason: input.note };
      notificationTitle = 'Công thức đã bị ẩn';
      notificationMessage = `Công thức "${target.title}" đã bị ẩn bởi quản trị viên.${input.note ? ` Lý do: ${input.note}` : ''}`;
    } else if (input.action === 'RESTORE') {
      if (!target.hiddenAt && !target.deletedAt) changed = false;
      updateData = { hiddenAt: null, hiddenReason: null, ...(target.deletedAt ? { deletedAt: null, status: 'DRAFT', visibility: 'PRIVATE' } : {}) };
      notificationTitle = 'Công thức đã được khôi phục';
      notificationMessage = `Công thức "${target.title}" đã được khôi phục.`;
    } else {
      if (target.deletedAt) changed = false;
      updateData = { deletedAt: now, status: 'ARCHIVED', visibility: 'PRIVATE', hiddenAt: null, hiddenReason: null };
      notificationTitle = 'Công thức đã bị xóa';
      notificationMessage = `Công thức "${target.title}" đã bị xóa bởi quản trị viên.${input.note ? ` Lý do: ${input.note}` : ''}`;
    }
  } else {
    const wasActive = target.status === 'ACTIVE' && !target.deletedAt;
    if (input.action === 'HIDE') {
      if (target.deletedAt) throw conflict('Deleted content cannot be hidden', 'CONTENT_DELETED');
      if (target.status === 'HIDDEN') changed = false;
      updateData = { status: 'HIDDEN' };
      notificationTitle = type === 'comments' ? 'Bình luận đã bị ẩn' : 'Ảnh cooksnap đã bị ẩn';
      notificationMessage = `Nội dung của bạn đã bị ẩn bởi quản trị viên.${input.note ? ` Lý do: ${input.note}` : ''}`;
    } else if (input.action === 'RESTORE') {
      if (target.status === 'ACTIVE' && !target.deletedAt) changed = false;
      updateData = { status: 'ACTIVE', deletedAt: null };
      notificationTitle = type === 'comments' ? 'Bình luận đã được khôi phục' : 'Ảnh cooksnap đã được khôi phục';
      notificationMessage = 'Nội dung của bạn đã được khôi phục.';
    } else {
      if (target.status === 'DELETED') changed = false;
      updateData = { status: 'DELETED', deletedAt: now };
      notificationTitle = type === 'comments' ? 'Bình luận đã bị xóa' : 'Ảnh cooksnap đã bị xóa';
      notificationMessage = `Nội dung của bạn đã bị xóa bởi quản trị viên.${input.note ? ` Lý do: ${input.note}` : ''}`;
    }
    if (type === 'cooksnaps' && changed && wasActive && input.action !== 'RESTORE') {
      await transaction.recipe.updateMany({ where: { id: target.recipeId, cookSnapCount: { gt: 0 } }, data: { cookSnapCount: { decrement: 1 } } });
    }
    if (type === 'cooksnaps' && changed && !wasActive && input.action === 'RESTORE') {
      await transaction.recipe.update({ where: { id: target.recipeId }, data: { cookSnapCount: { increment: 1 } } });
    }
  }

  const updated = changed
    ? await transaction[type === 'recipes' ? 'recipe' : type === 'comments' ? 'comment' : 'cooksnap'].update({ where: { id }, data: updateData, select: contentSelect[type] })
    : target;

  if (changed) {
    await transaction.auditLog.create({
      data: {
        actorId,
        action: `CONTENT_${input.action}`,
        targetType: model.targetType,
        targetId: id,
        details: { note: input.note, before: { hiddenAt: target.hiddenAt ?? null, deletedAt: target.deletedAt ?? null, status: target.status ?? null }, after: { hiddenAt: updated.hiddenAt ?? null, deletedAt: updated.deletedAt ?? null, status: updated.status ?? null } },
      },
    });
    if (target.authorId !== actorId) {
      await transaction.notification.create({ data: { userId: target.authorId, type: `CONTENT_${input.action}`, title: notificationTitle, message: notificationMessage } });
    }
  }

  return { type, id, changed, item: updated, label: model.label(target) };
}

export async function applyContentAction(actorId, type, id, input) {
  return prisma.$transaction((transaction) => applyContentActionCore(transaction, actorId, type, id, input));
}

export async function bulkContentAction(actorId, { type, ids, action, note }) {
  return prisma.$transaction(async (transaction) => {
    const results = [];
    for (const id of ids) results.push(await applyContentActionCore(transaction, actorId, type, id, { action, note }));
    return { type, action, results, changed: results.filter((result) => result.changed).length };
  });
}

export async function setRecipeFeatured(actorId, recipeId, featured) {
  const recipe = await prisma.recipe.findUnique({ where: { id: recipeId }, select: { id: true } });
  if (!recipe) { const error = new Error('Recipe not found'); error.statusCode = 404; error.code = 'RECIPE_NOT_FOUND'; throw error; }
  const updated = await prisma.recipe.update({ where: { id: recipeId }, data: { featuredAt: featured ? new Date() : null }, select: { id: true, featuredAt: true } });
  await prisma.auditLog.create({ data: { actorId, action: featured ? 'RECIPE_FEATURED' : 'RECIPE_UNFEATURED', targetType: 'RECIPE', targetId: recipeId } });
  return updated;
}

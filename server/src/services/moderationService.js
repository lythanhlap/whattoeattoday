import { prisma } from '../lib/prisma.js';

function forbidden() { const error = new Error('You cannot resolve your own report'); error.statusCode = 403; error.code = 'REPORT_SELF_RESOLUTION_FORBIDDEN'; return error; }
function notFound() { const error = new Error('Report not found'); error.statusCode = 404; error.code = 'REPORT_NOT_FOUND'; return error; }

const reportTargetSelect = {
  recipe: { select: { id: true, title: true, slug: true, authorId: true, status: true, visibility: true, hiddenAt: true, author: { select: { id: true, username: true } } } },
  comment: { select: { id: true, content: true, authorId: true, status: true, deletedAt: true, author: { select: { id: true, username: true } } } },
  cooksnap: { select: { id: true, imageUrl: true, authorId: true, status: true, deletedAt: true, recipeId: true, author: { select: { id: true, username: true } } } },
};

export async function createRecipeReport(reporterId, recipeId, input) {
  const recipe = await prisma.recipe.findFirst({ where: { id: recipeId, deletedAt: null }, select: { id: true } });
  if (!recipe) { const error = new Error('Recipe not found'); error.statusCode = 404; error.code = 'RECIPE_NOT_FOUND'; throw error; }
  return prisma.report.create({ data: { reporterId, recipeId, reason: input.reason, description: input.description?.trim() || null }, select: { id: true, reason: true, status: true, createdAt: true } });
}

export async function listReports({ status = 'OPEN', page = 1, limit = 25 }) {
  const take = Math.min(Math.max(Number(limit) || 25, 1), 100);
  const skip = (Math.max(Number(page) || 1, 1) - 1) * take;
  const where = status === 'ALL' ? {} : { status };
  const [items, total] = await prisma.$transaction([
    prisma.report.findMany({ where, skip, take, orderBy: { createdAt: 'asc' }, include: { reporter: { select: { id: true, username: true } }, ...reportTargetSelect, resolver: { select: { id: true, username: true } } } }),
    prisma.report.count({ where }),
  ]);
  return { items, meta: { page: Math.floor(skip / take) + 1, limit: take, total, totalPages: Math.ceil(total / take) } };
}

export async function resolveReport(actorId, reportId, input) {
  const report = await prisma.report.findUnique({ where: { id: reportId }, include: reportTargetSelect });
  if (!report) throw notFound();
  if (report.status !== 'OPEN') { const error = new Error('Report has already been resolved'); error.statusCode = 409; error.code = 'REPORT_ALREADY_RESOLVED'; throw error; }
  if (report.reporterId === actorId) throw forbidden();
  const now = new Date();
  const status = input.action === 'DISMISS' ? 'DISMISSED' : 'RESOLVED';
  return prisma.$transaction(async (transaction) => {
    const updated = await transaction.report.update({ where: { id: reportId }, data: { status, resolvedBy: actorId, resolvedAt: now } });
    const targetType = report.recipeId ? 'RECIPE' : report.commentId ? 'COMMENT' : 'COOKSNAP';
    const targetId = report.recipeId || report.commentId || report.cooksnapId;
    const targetAuthorId = report.recipe?.authorId || report.comment?.authorId || report.cooksnap?.authorId;
    if (input.action === 'HIDE' && report.recipeId) await transaction.recipe.update({ where: { id: report.recipeId }, data: { hiddenAt: now, hiddenReason: input.note?.trim() || report.reason } });
    if (input.action === 'RESTORE' && report.recipeId) await transaction.recipe.update({ where: { id: report.recipeId }, data: { hiddenAt: null, hiddenReason: null } });
    if (['HIDE', 'RESTORE'].includes(input.action) && report.commentId) await transaction.comment.update({ where: { id: report.commentId }, data: { status: input.action === 'HIDE' ? 'HIDDEN' : 'ACTIVE', ...(input.action === 'RESTORE' ? { deletedAt: null } : {}) } });
    if (['HIDE', 'RESTORE'].includes(input.action) && report.cooksnapId) {
      const wasActive = report.cooksnap.status === 'ACTIVE' && !report.cooksnap.deletedAt;
      await transaction.cooksnap.update({ where: { id: report.cooksnapId }, data: { status: input.action === 'HIDE' ? 'HIDDEN' : 'ACTIVE', ...(input.action === 'RESTORE' ? { deletedAt: null } : {}) } });
      if (input.action === 'HIDE' && wasActive) {
        await transaction.recipe.updateMany({ where: { id: report.cooksnap.recipeId, cookSnapCount: { gt: 0 } }, data: { cookSnapCount: { decrement: 1 } } });
      }
      if (input.action === 'RESTORE' && !wasActive) {
        await transaction.recipe.update({ where: { id: report.cooksnap.recipeId }, data: { cookSnapCount: { increment: 1 } } });
      }
    }
    await transaction.auditLog.create({ data: { actorId, action: `REPORT_${input.action}`, targetType, targetId, details: { reportId, reason: report.reason, note: input.note?.trim() || null } } });
    if (['HIDE', 'RESTORE'].includes(input.action) && targetAuthorId && targetAuthorId !== actorId) {
      await transaction.notification.create({
        data: {
          userId: targetAuthorId,
          type: `CONTENT_${input.action}`,
          title: input.action === 'HIDE' ? 'Nội dung đã bị ẩn' : 'Nội dung đã được khôi phục',
          message: input.action === 'HIDE'
            ? `Nội dung của bạn đã bị ẩn sau khi xử lý báo cáo.${input.note?.trim() ? ` Lý do: ${input.note.trim()}` : ''}`
            : 'Nội dung của bạn đã được khôi phục.',
        },
      });
    }
    return updated;
  });
}

export async function listAuditLogs({ page = 1, limit = 50 }) {
  const take = Math.min(Math.max(Number(limit) || 50, 1), 100);
  const skip = (Math.max(Number(page) || 1, 1) - 1) * take;
  const [items, total] = await prisma.$transaction([
    prisma.auditLog.findMany({ skip, take, orderBy: { createdAt: 'desc' }, include: { actor: { select: { id: true, username: true, role: true } } } }),
    prisma.auditLog.count(),
  ]);
  return { items, meta: { page: Math.floor(skip / take) + 1, limit: take, total, totalPages: Math.ceil(total / take) } };
}

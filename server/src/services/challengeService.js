import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';

const recipeInclude = {
  author: { select: { id: true, username: true, status: true, profile: { select: { displayName: true, avatarUrl: true } } } },
  category: true,
  ingredients: { orderBy: { sortOrder: 'asc' } },
};

const challengeInclude = {
  createdBy: { select: { id: true, username: true, profile: { select: { displayName: true } } } },
  _count: { select: { entries: { where: { removedAt: null } } } },
};

function fail(message, code, statusCode) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  return error;
}

function notFound() {
  return fail('Challenge not found', 'CHALLENGE_NOT_FOUND', 404);
}

export function resolveChallengeStatus(challenge, now = new Date()) {
  if (challenge.status === 'DRAFT' || challenge.status === 'ARCHIVED') return challenge.status;
  if (now < challenge.startsAt) return 'UPCOMING';
  if (now > challenge.endsAt) return 'ENDED';
  return 'ACTIVE';
}

function serializeChallenge(challenge, now = new Date()) {
  return {
    ...challenge,
    status: resolveChallengeStatus(challenge, now),
    entryCount: challenge._count?.entries ?? challenge.entryCount ?? 0,
    _count: undefined,
  };
}

function statusWhere(status, now) {
  if (status === 'ACTIVE') return { startsAt: { lte: now }, endsAt: { gte: now } };
  if (status === 'UPCOMING') return { startsAt: { gt: now } };
  if (status === 'ENDED') return { endsAt: { lt: now } };
  return {};
}

export async function listChallenges({ page = 1, limit = 12, status } = {}) {
  const take = Math.min(Math.max(Number(limit) || 12, 1), 50);
  const currentPage = Math.max(Number(page) || 1, 1);
  const skip = (currentPage - 1) * take;
  const now = new Date();
  const allowedStatuses = ['ACTIVE', 'UPCOMING', 'ENDED'];
  if (status && !allowedStatuses.includes(status)) {
    throw fail('Status filter must be ACTIVE, UPCOMING or ENDED', 'CHALLENGE_STATUS_FILTER_INVALID', 422);
  }

  const where = {
    status: { notIn: ['DRAFT', 'ARCHIVED'] },
    ...(status ? statusWhere(status, now) : {}),
  };

  const [items, total] = await prisma.$transaction([
    prisma.challenge.findMany({ where, skip, take, orderBy: [{ startsAt: 'desc' }, { createdAt: 'desc' }], include: challengeInclude }),
    prisma.challenge.count({ where }),
  ]);

  return {
    items: items.map((challenge) => serializeChallenge(challenge, now)),
    meta: { page: currentPage, limit: take, total, totalPages: Math.ceil(total / take) },
  };
}

export async function getChallenge(id, viewer = {}) {
  const challenge = await prisma.challenge.findUnique({
    where: { id },
    include: {
      ...challengeInclude,
      entries: {
        where: { removedAt: null },
        orderBy: { createdAt: 'desc' },
        include: {
          recipe: { include: recipeInclude },
          submittedBy: { select: { id: true, username: true, profile: { select: { displayName: true } } } },
        },
      },
    },
  });
  if (!challenge) throw notFound();

  const canManage = Boolean(viewer.userId && (challenge.createdById === viewer.userId || viewer.role === 'ADMIN'));
  if (['DRAFT', 'ARCHIVED'].includes(challenge.status) && !canManage) throw notFound();

  const now = new Date();
  const entries = challenge.entries.filter((entry) => {
    if (canManage) return true;
    const recipe = entry.recipe;
    return recipe.status === 'PUBLISHED' && recipe.visibility === 'PUBLIC' && !recipe.deletedAt && !recipe.hiddenAt && recipe.author?.status === 'ACTIVE';
  });

  const sanitizedEntries = entries.map((entry) => ({
    ...entry,
    recipe: entry.recipe
      ? { ...entry.recipe, author: entry.recipe.author ? { ...entry.recipe.author, status: undefined } : entry.recipe.author }
      : entry.recipe,
  }));

  return { ...serializeChallenge(challenge, now), entries: sanitizedEntries };
}

export async function createChallenge(userId, userRole, input) {
  if (!['EDITOR', 'ADMIN'].includes(userRole)) {
    throw fail('Only editors and admins can create challenges', 'FORBIDDEN', 403);
  }
  if (input.startsAt >= input.endsAt) {
    throw fail('Challenge end time must be after start time', 'CHALLENGE_DATES_INVALID', 422);
  }
  const challenge = await prisma.challenge.create({
    data: {
      createdById: userId,
      title: input.title,
      description: input.description ?? null,
      bannerUrl: input.bannerUrl ?? null,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      status: input.status || 'DRAFT',
    },
    include: challengeInclude,
  });
  return serializeChallenge(challenge);
}

export async function updateChallenge(userId, userRole, id, input) {
  const current = await prisma.challenge.findUnique({ where: { id } });
  if (!current) throw notFound();
  if (current.createdById !== userId && userRole !== 'ADMIN') {
    throw fail('You do not have permission to modify this challenge', 'FORBIDDEN', 403);
  }
  if (current.status === 'ARCHIVED') {
    throw fail('Archived challenge cannot be updated', 'CHALLENGE_ARCHIVED', 409);
  }

  const startsAt = input.startsAt ?? current.startsAt;
  const endsAt = input.endsAt ?? current.endsAt;
  if (startsAt >= endsAt) {
    throw fail('Challenge end time must be after start time', 'CHALLENGE_DATES_INVALID', 422);
  }

  const challenge = await prisma.challenge.update({
    where: { id },
    data: {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.bannerUrl !== undefined ? { bannerUrl: input.bannerUrl } : {}),
      ...(input.startsAt !== undefined ? { startsAt } : {}),
      ...(input.endsAt !== undefined ? { endsAt } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
    },
    include: challengeInclude,
  });
  return serializeChallenge(challenge);
}

export async function archiveChallenge(userId, userRole, id) {
  const current = await prisma.challenge.findUnique({ where: { id } });
  if (!current) throw notFound();
  if (current.createdById !== userId && userRole !== 'ADMIN') {
    throw fail('You do not have permission to archive this challenge', 'FORBIDDEN', 403);
  }
  const challenge = await prisma.challenge.update({ where: { id }, data: { status: 'ARCHIVED' }, include: challengeInclude });
  return serializeChallenge(challenge);
}

export async function submitChallengeEntry(userId, challengeId, recipeId) {
  const challenge = await prisma.challenge.findUnique({ where: { id: challengeId } });
  if (!challenge || challenge.status === 'DRAFT' || challenge.status === 'ARCHIVED') throw notFound();
  if (resolveChallengeStatus(challenge) !== 'ACTIVE') {
    throw fail('Challenge is not accepting entries', 'CHALLENGE_NOT_ACTIVE', 409);
  }

  const recipe = await prisma.recipe.findUnique({
    where: { id: recipeId },
    select: { id: true, authorId: true, status: true, visibility: true, deletedAt: true, hiddenAt: true, author: { select: { status: true } } },
  });
  if (!recipe) throw fail('Recipe not found', 'RECIPE_NOT_FOUND', 404);
  if (recipe.authorId !== userId) {
    throw fail('You can only submit your own recipe', 'CHALLENGE_RECIPE_NOT_OWNED', 403);
  }
  const eligible = recipe.status === 'PUBLISHED' && recipe.visibility === 'PUBLIC' && !recipe.deletedAt && !recipe.hiddenAt && recipe.author.status === 'ACTIVE';
  if (!eligible) {
    throw fail('Recipe must be published and public to join a challenge', 'CHALLENGE_RECIPE_NOT_ELIGIBLE', 422);
  }

  try {
    return await prisma.$transaction(async (transaction) => {
      const entry = await transaction.challengeEntry.create({
        data: { challengeId, recipeId, submittedById: userId },
        include: { recipe: { include: recipeInclude } },
      });
      if (challenge.createdById !== userId) {
        await transaction.notification.create({
          data: {
            userId: challenge.createdById,
            type: 'CHALLENGE_ENTRY_CREATED',
            title: 'Có bài tham gia thử thách mới',
            message: `Một thành viên vừa gửi công thức "${entry.recipe.title}" vào thử thách "${challenge.title}".`,
          },
        });
      }
      return entry;
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw fail('Recipe has already been submitted to this challenge', 'CHALLENGE_ENTRY_DUPLICATE', 409);
    }
    throw error;
  }
}

export async function removeChallengeEntry(userId, userRole, challengeId, entryId) {
  const entry = await prisma.challengeEntry.findFirst({
    where: { id: entryId, challengeId },
    include: { challenge: { select: { createdById: true } }, recipe: { select: { authorId: true } } },
  });
  if (!entry) throw fail('Challenge entry not found', 'CHALLENGE_ENTRY_NOT_FOUND', 404);
  if (entry.removedAt) throw fail('Challenge entry has already been removed', 'CHALLENGE_ENTRY_ALREADY_REMOVED', 409);

  const isModerator = ['MODERATOR', 'ADMIN'].includes(userRole);
  const isOwner = entry.submittedById === userId;
  const isEditorOfChallenge = userRole === 'EDITOR' && entry.challenge.createdById === userId;
  if (!isModerator && !isOwner && !isEditorOfChallenge) {
    throw fail('You do not have permission to remove this entry', 'FORBIDDEN', 403);
  }

  return prisma.$transaction(async (transaction) => {
    const updated = await transaction.challengeEntry.update({
      where: { id: entryId },
      data: { removedAt: new Date(), removedById: userId },
    });
    if (!isOwner) {
      await transaction.auditLog.create({
        data: {
          actorId: userId,
          action: 'CHALLENGE_ENTRY_REMOVED',
          targetType: 'CHALLENGE_ENTRY',
          targetId: entryId,
          details: { challengeId, recipeId: entry.recipeId, submittedById: entry.submittedById },
        },
      });
    }
    return updated;
  });
}

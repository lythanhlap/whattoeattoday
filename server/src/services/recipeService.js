import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { createRecipeSlug } from '../utils/slug.js';

const recipeInclude = {
  author: { select: { id: true, username: true, status: true, profile: { select: { displayName: true, avatarUrl: true, bio: true } } } },
  category: true,
  coverImage: { select: { id: true, secureUrl: true, format: true } },
  ingredients: { orderBy: { sortOrder: 'asc' } },
  steps: { orderBy: { stepNumber: 'asc' } },
  tags: { include: { tag: true } },
};

const DIET_TAG_SLUGS = new Set(['mon-chay', 'thuan-chay', 'eat-clean', 'khong-gluten', 'khong-sua']);

async function findSearchIds(query, ingredient) {
  if (!query?.trim() && !ingredient?.trim()) return null;
  const normalizedQuery = query?.trim() || '';
  const normalizedIngredient = ingredient?.trim() || '';
  const rows = await prisma.$queryRaw(Prisma.sql`
    SELECT DISTINCT r.id
    FROM recipes r
    LEFT JOIN recipe_ingredients ri ON ri."recipeId" = r.id
    LEFT JOIN recipe_tags rt ON rt."recipeId" = r.id
    LEFT JOIN tags t ON t.id = rt."tagId"
    LEFT JOIN categories c ON c.id = r."categoryId"
    WHERE (
      ${normalizedQuery} = ''
      OR to_tsvector('simple', immutable_unaccent(coalesce(r.title, '') || ' ' || coalesce(r.description, ''))) @@ plainto_tsquery('simple', immutable_unaccent(${normalizedQuery}))
      OR immutable_unaccent(r.title) % immutable_unaccent(${normalizedQuery})
      OR immutable_unaccent(coalesce(t.name, '')) % immutable_unaccent(${normalizedQuery})
      OR immutable_unaccent(coalesce(c.name, '')) % immutable_unaccent(${normalizedQuery})
    )
    AND (
      ${normalizedIngredient} = ''
      OR immutable_unaccent(ri."displayName") % immutable_unaccent(${normalizedIngredient})
    )
  `);
  return rows.map((row) => row.id);
}

function recipeData(input) {
  return {
    title: input.title,
    description: input.description || null,
    coverImageId: input.coverImageId || null,
    prepTimeMinutes: input.prepTimeMinutes ?? null,
    cookTimeMinutes: input.cookTimeMinutes ?? null,
    totalTimeMinutes: input.totalTimeMinutes ?? null,
    servings: input.servings ?? null,
    difficulty: input.difficulty ?? null,
    tips: input.tips || null,
    substitutions: input.substitutions || null,
    storageInstructions: input.storageInstructions || null,
    visibility: input.visibility || 'PRIVATE',
    categoryId: input.categoryId || null,
  };
}

function nestedRecipeData(input) {
  return {
    ingredients: input.ingredients ? { create: input.ingredients.map((item, index) => ({
      displayName: item.displayName.trim(),
      quantity: item.quantity ?? null,
      unit: item.unit ?? null,
      note: item.note ?? null,
      sortOrder: index,
      isOptional: item.isOptional === true,
    })) } : undefined,
    steps: input.steps ? { create: input.steps.map((item, index) => ({
      instruction: item.instruction.trim(),
      stepNumber: index + 1,
      imageId: item.imageId ?? null,
      durationMinutes: item.durationMinutes ?? null,
    })) } : undefined,
    tags: input.tagIds ? { create: input.tagIds.map((tagId) => ({ tagId })) } : undefined,
  };
}

function notFound() {
  const error = new Error('Recipe not found');
  error.statusCode = 404;
  error.code = 'RECIPE_NOT_FOUND';
  return error;
}

function forbidden() {
  const error = new Error('You do not have permission to modify this recipe');
  error.statusCode = 403;
  error.code = 'FORBIDDEN';
  return error;
}

function assertCanManage(recipe, userId, userRole) {
  if (recipe.authorId !== userId && !['EDITOR', 'ADMIN'].includes(userRole)) throw forbidden();
}

function assertPublicRecipe(recipe) {
  return recipe.status === 'PUBLISHED' && recipe.visibility === 'PUBLIC' && !recipe.deletedAt && !recipe.hiddenAt && recipe.author.status === 'ACTIVE';
}

function sanitizeRecipe(recipe) {
  if (!recipe?.author) return recipe;
  const author = { ...recipe.author };
  delete author.status;
  return { ...recipe, author };
}

async function getRecipeById(id, include = recipeInclude) {
  return prisma.recipe.findUnique({ where: { id }, include });
}

async function assertCoverImage(transaction, userId, coverImageId) {
  if (!coverImageId) return;
  const asset = await transaction.mediaAsset.findFirst({
    where: { id: coverImageId, ownerId: userId, status: { in: ['UPLOADED', 'ATTACHED'] } },
    select: { id: true },
  });
  if (!asset) {
    const error = new Error('Cover image must be an uploaded media asset owned by the author');
    error.statusCode = 422;
    error.code = 'RECIPE_COVER_INVALID';
    throw error;
  }
}

async function attachCoverImage(transaction, coverImageId) {
  if (!coverImageId) return;
  await transaction.mediaAsset.updateMany({
    where: { id: coverImageId, status: 'UPLOADED' },
    data: { status: 'ATTACHED', attachedAt: new Date() },
  });
}

export async function createRecipe(userId, input) {
  try {
    return await prisma.$transaction(async (transaction) => {
      await assertCoverImage(transaction, userId, input.coverImageId);
      const recipe = await transaction.recipe.create({
        data: {
          ...recipeData(input),
          authorId: userId,
          slug: createRecipeSlug(input.title),
          ...nestedRecipeData(input),
        },
        include: recipeInclude,
      });
      await attachCoverImage(transaction, input.coverImageId);
      return sanitizeRecipe(recipe);
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
      const conflict = new Error('Category or tag does not exist');
      conflict.statusCode = 404;
      conflict.code = 'RECIPE_REFERENCE_NOT_FOUND';
      throw conflict;
    }
    throw error;
  }
}

export async function updateRecipe(userId, userRole, id, input) {
  const current = await getRecipeById(id, { author: { select: { id: true } }, ingredients: true, steps: true, tags: true });
  if (!current || current.deletedAt) throw notFound();
  assertCanManage(current, userId, userRole);

  return prisma.$transaction(async (transaction) => {
    if (input.coverImageId) await assertCoverImage(transaction, current.authorId, input.coverImageId);
    const data = { ...recipeData({ ...current, ...input }) };
    if (input.ingredients !== undefined) {
      await transaction.recipeIngredient.deleteMany({ where: { recipeId: id } });
      data.ingredients = nestedRecipeData(input).ingredients;
    }
    if (input.steps !== undefined) {
      await transaction.recipeStep.deleteMany({ where: { recipeId: id } });
      data.steps = nestedRecipeData(input).steps;
    }
    if (input.tagIds !== undefined) {
      await transaction.recipeTag.deleteMany({ where: { recipeId: id } });
      data.tags = nestedRecipeData(input).tags;
    }
    if (input.status === undefined && current.status === 'PUBLISHED') data.status = 'PENDING_REVIEW';
    const recipe = await transaction.recipe.update({ where: { id }, data, include: recipeInclude });
    await attachCoverImage(transaction, input.coverImageId);
    return sanitizeRecipe(recipe);
  });
}

export async function publishRecipe(userId, userRole, id) {
  const recipe = await getRecipeById(id, { author: { select: { id: true } }, ingredients: true, steps: true });
  if (!recipe || recipe.deletedAt) throw notFound();
  assertCanManage(recipe, userId, userRole);

  const complete = recipe.coverImageId && recipe.ingredients?.length > 0 && recipe.steps?.length > 0;
  if (!complete) {
    const error = new Error('Recipe needs a cover image, ingredients and steps before publishing');
    error.statusCode = 422;
    error.code = 'RECIPE_INCOMPLETE';
    throw error;
  }

  const isTrustedPublisher = userRole === 'EDITOR' || userRole === 'ADMIN';
  const updatedRecipe = await prisma.recipe.update({
    where: { id },
    data: {
      status: isTrustedPublisher ? 'PUBLISHED' : 'PENDING_REVIEW',
      visibility: 'PUBLIC',
      publishedAt: isTrustedPublisher ? new Date() : null,
      reviewedAt: isTrustedPublisher ? new Date() : null,
      reviewNote: null,
    },
    include: recipeInclude,
  });
  return sanitizeRecipe(updatedRecipe);
}

export async function listRecipes({ page = 1, limit = 20, q, ingredient, categoryId, tags, status, visibility, userId, maxCookTime, hasCooksnap = false, featured = false, diet, sort = 'newest' }) {
  const take = Math.min(Math.max(Number(limit) || 20, 1), 50);
  const skip = (Math.max(Number(page) || 1, 1) - 1) * take;
  const where = { deletedAt: null, hiddenAt: null };
  if (userId) where.authorId = userId;
  else {
    where.status = 'PUBLISHED';
    where.visibility = 'PUBLIC';
    where.author = { status: 'ACTIVE', deletedAt: null };
  }
  if (userId && status) where.status = status;
  if (userId && visibility) where.visibility = visibility;
  if (categoryId) where.categoryId = categoryId;
  if (featured) where.featuredAt = { not: null };
  if (diet && DIET_TAG_SLUGS.has(diet)) {
    where.OR = [
      { tags: { some: { tag: { slug: diet } } } },
      { category: { slug: diet } },
    ];
  }
  if (tags?.length) where.tags = { some: { tag: { slug: { in: tags } } } };
  if (maxCookTime !== undefined) where.cookTimeMinutes = { lte: maxCookTime };
  if (hasCooksnap) where.cooksnaps = { some: { status: 'ACTIVE', deletedAt: null } };
  const searchIds = await findSearchIds(q, ingredient);
  if (searchIds) where.id = { in: searchIds };

  const orderBy = sort === 'popular'
    ? [{ saveCount: 'desc' }, { cookSnapCount: 'desc' }, { viewCount: 'desc' }, { createdAt: 'desc' }]
    : sort === 'cooksnaps'
      ? [{ cookSnapCount: 'desc' }, { createdAt: 'desc' }]
      : { createdAt: 'desc' };

  const [items, total] = await prisma.$transaction([
    prisma.recipe.findMany({ where, skip, take, orderBy, include: recipeInclude }),
    prisma.recipe.count({ where }),
  ]);
  return { items: items.map(sanitizeRecipe), meta: { page: Math.floor(skip / take) + 1, limit: take, total, totalPages: Math.ceil(total / take) } };
}

export async function getRecipeBySlug(slug, userId, userRole) {
  const recipe = await prisma.recipe.findUnique({ where: { slug }, include: recipeInclude });
  if (!recipe || recipe.deletedAt) throw notFound();
  const canModerate = ['EDITOR', 'MODERATOR', 'ADMIN'].includes(userRole);
  if (assertPublicRecipe(recipe) || recipe.authorId === userId || canModerate) return sanitizeRecipe(recipe);
  throw notFound();
}

export async function deleteRecipe(userId, userRole, id) {
  const recipe = await getRecipeById(id, { author: { select: { id: true } } });
  if (!recipe || recipe.deletedAt) throw notFound();
  assertCanManage(recipe, userId, userRole);
  await prisma.recipe.update({ where: { id }, data: { deletedAt: new Date(), status: 'ARCHIVED', visibility: 'PRIVATE' } });
}

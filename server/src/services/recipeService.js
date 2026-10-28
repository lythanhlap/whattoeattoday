import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { createRecipeSlug } from '../utils/slug.js';

const recipeInclude = {
  author: { select: { id: true, username: true, status: true, profile: { select: { displayName: true, avatarUrl: true, bio: true } } } },
  category: true,
  coverImage: { select: { id: true, secureUrl: true, format: true } },
  ingredients: { orderBy: { sortOrder: 'asc' } },
  steps: { orderBy: { stepNumber: 'asc' } },
  images: {
    orderBy: { sortOrder: 'asc' },
    include: { mediaAsset: { select: { id: true, secureUrl: true, format: true } } },
  },
  tags: { include: { tag: true } },
};

const DIET_TAG_SLUGS = new Set(['mon-chay', 'thuan-chay', 'eat-clean', 'khong-gluten', 'khong-sua']);

function searchConditions({ query, ingredient }) {
  return Prisma.sql`
    (
      ${query} = ''
      OR to_tsvector('simple', immutable_unaccent(coalesce(r.title, '') || ' ' || coalesce(r.description, ''))) @@ plainto_tsquery('simple', immutable_unaccent(${query}))
      OR immutable_unaccent(r.title) % immutable_unaccent(${query})
      OR immutable_unaccent(r.title) ILIKE '%' || immutable_unaccent(${query}) || '%'
      OR EXISTS (
        SELECT 1 FROM recipe_ingredients ri
        WHERE ri."recipeId" = r.id
          AND (immutable_unaccent(ri."displayName") % immutable_unaccent(${query})
            OR immutable_unaccent(ri."displayName") ILIKE '%' || immutable_unaccent(${query}) || '%')
      )
      OR EXISTS (
        SELECT 1 FROM recipe_tags rt JOIN tags t ON t.id = rt."tagId"
        WHERE rt."recipeId" = r.id AND immutable_unaccent(t.name) % immutable_unaccent(${query})
      )
      OR EXISTS (
        SELECT 1 FROM categories c
        WHERE c.id = r."categoryId" AND immutable_unaccent(c.name) % immutable_unaccent(${query})
      )
    )
    AND (
      ${ingredient} = ''
      OR EXISTS (
        SELECT 1 FROM recipe_ingredients ri
        WHERE ri."recipeId" = r.id
          AND (immutable_unaccent(ri."displayName") % immutable_unaccent(${ingredient})
            OR immutable_unaccent(ri."displayName") ILIKE '%' || immutable_unaccent(${ingredient}) || '%')
      )
    )
  `;
}

function searchFilters({ categoryId, tags = [], diet, maxCookTime, hasCooksnap, featured }) {
  const tagList = tags.length ? tags : null;
  return Prisma.sql`
    AND (${categoryId || null}::uuid IS NULL OR r."categoryId" = ${categoryId || null}::uuid)
    AND (${tagList}::text[] IS NULL OR EXISTS (
      SELECT 1 FROM recipe_tags rt JOIN tags t ON t.id = rt."tagId"
      WHERE rt."recipeId" = r.id AND t.slug = ANY(${tagList}::text[])
    ))
    AND (${diet || null}::text IS NULL
      OR EXISTS (
        SELECT 1 FROM recipe_tags rt JOIN tags t ON t.id = rt."tagId"
        WHERE rt."recipeId" = r.id AND t.slug = ${diet || null}
      )
      OR EXISTS (
        SELECT 1 FROM categories c WHERE c.id = r."categoryId" AND c.slug = ${diet || null}
      ))
    AND (${maxCookTime ?? null}::int IS NULL OR coalesce(r."cookTimeMinutes", 2147483647) <= ${maxCookTime ?? null}::int)
    AND (${featured} = false OR r."featuredAt" IS NOT NULL)
    AND (${hasCooksnap} = false OR EXISTS (
      SELECT 1 FROM cooksnaps cs
      WHERE cs."recipeId" = r.id AND cs.status = 'ACTIVE' AND cs."deletedAt" IS NULL
    ))
  `;
}

function searchOrder(sort) {
  if (sort === 'popular') return Prisma.sql`r."saveCount" DESC, r."cookSnapCount" DESC, r."publishedAt" DESC NULLS LAST, r."createdAt" DESC`;
  if (sort === 'cooksnaps') return Prisma.sql`r."cookSnapCount" DESC, r."publishedAt" DESC NULLS LAST, r."createdAt" DESC`;
  return Prisma.sql`title_hit DESC, ingredient_hit DESC, text_rank DESC, r."publishedAt" DESC NULLS LAST, r."createdAt" DESC, r."saveCount" DESC`;
}

async function searchRecipes({ take, skip, q = '', ingredient = '', sort, ...filters }) {
  const query = q.trim();
  const ingredientText = ingredient.trim();
  const baseWhere = Prisma.sql`
    r.status = 'PUBLISHED'
    AND r.visibility = 'PUBLIC'
    AND r."deletedAt" IS NULL
    AND r."hiddenAt" IS NULL
    AND u.status = 'ACTIVE'
    AND u."deletedAt" IS NULL
    AND ${searchConditions({ query, ingredient: ingredientText })}
    ${searchFilters(filters)}
  `;
  const rows = await prisma.$queryRaw(Prisma.sql`
    SELECT r.id,
      COUNT(*) OVER()::int AS total,
      CASE WHEN ${query} <> '' AND (immutable_unaccent(r.title) ILIKE '%' || immutable_unaccent(${query}) || '%'
        OR immutable_unaccent(r.title) % immutable_unaccent(${query})) THEN 1 ELSE 0 END AS title_hit,
      CASE WHEN ${ingredientText} <> '' OR ${query} = '' THEN 0
        WHEN EXISTS (
          SELECT 1 FROM recipe_ingredients ri
          WHERE ri."recipeId" = r.id
            AND (immutable_unaccent(ri."displayName") % immutable_unaccent(${query})
              OR immutable_unaccent(ri."displayName") ILIKE '%' || immutable_unaccent(${query}) || '%')
        ) THEN 1 ELSE 0 END AS ingredient_hit,
      ts_rank_cd(
        to_tsvector('simple', immutable_unaccent(coalesce(r.title, '') || ' ' || coalesce(r.description, ''))),
        plainto_tsquery('simple', immutable_unaccent(${query}))
      ) AS text_rank
    FROM recipes r
    JOIN users u ON u.id = r."authorId"
    WHERE ${baseWhere}
    ORDER BY ${searchOrder(sort)}
    LIMIT ${take} OFFSET ${skip}
  `);
  let total = rows[0]?.total ?? 0;
  if (!rows.length) {
    const counted = await prisma.$queryRaw(Prisma.sql`
      SELECT COUNT(*)::int AS total FROM recipes r JOIN users u ON u.id = r."authorId" WHERE ${baseWhere}
    `);
    total = counted[0]?.total ?? 0;
  }
  return { ids: rows.map((row) => row.id), total };
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
    images: input.imageIds?.length ? { create: input.imageIds.map((mediaAssetId, index) => ({ mediaAssetId, sortOrder: index })) } : undefined,
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
  return recipe.status === 'PUBLISHED' && (recipe.visibility === 'PUBLIC' || recipe.visibility === 'UNLISTED') && !recipe.deletedAt && !recipe.hiddenAt && recipe.author.status === 'ACTIVE';
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

async function assertGalleryImages(transaction, userId, imageIds, currentRecipeId = null) {
  if (!imageIds?.length) return;
  if (imageIds.length > 6 || imageIds.some((id) => typeof id !== 'string')) {
    const error = new Error('Gallery images must be up to 6 media asset ids');
    error.statusCode = 422;
    error.code = 'RECIPE_GALLERY_INVALID';
    throw error;
  }
  const owned = await transaction.mediaAsset.count({
    where: { id: { in: imageIds }, ownerId: userId, status: { in: ['UPLOADED', 'ATTACHED'] } },
  });
  const usedElsewhere = await transaction.recipeImage.count({
    where: {
      mediaAssetId: { in: imageIds },
      ...(currentRecipeId ? { recipeId: { not: currentRecipeId } } : {}),
    },
  });
  if (owned !== imageIds.length || usedElsewhere > 0) {
    const error = new Error('Gallery images must be uploaded media assets owned by the author');
    error.statusCode = 422;
    error.code = 'RECIPE_GALLERY_INVALID';
    throw error;
  }
}

async function attachGalleryImages(transaction, imageIds) {
  if (!imageIds?.length) return;
  await transaction.mediaAsset.updateMany({
    where: { id: { in: imageIds }, status: 'UPLOADED' },
    data: { status: 'ATTACHED', attachedAt: new Date() },
  });
}

export async function createRecipe(userId, input) {
  try {
    return await prisma.$transaction(async (transaction) => {
      await assertCoverImage(transaction, userId, input.coverImageId);
      await assertGalleryImages(transaction, userId, input.imageIds);
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
      await attachGalleryImages(transaction, input.imageIds);
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
    if (input.imageIds !== undefined) {
      await assertGalleryImages(transaction, current.authorId, input.imageIds, id);
      await transaction.recipeImage.deleteMany({ where: { recipeId: id } });
      data.images = nestedRecipeData(input).images;
    }
    if (input.status === undefined && current.status === 'PUBLISHED' && !['EDITOR', 'ADMIN'].includes(userRole)) data.status = 'PENDING_REVIEW';
    const recipe = await transaction.recipe.update({ where: { id }, data, include: recipeInclude });
    await attachCoverImage(transaction, input.coverImageId);
    await attachGalleryImages(transaction, input.imageIds);
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

  if (!userId && (q?.trim() || ingredient?.trim())) {
    const { ids, total } = await searchRecipes({ take, skip, q, ingredient, sort, categoryId, tags, diet, maxCookTime, hasCooksnap: Boolean(hasCooksnap), featured: Boolean(featured) });
    const items = ids.length ? await prisma.recipe.findMany({ where: { id: { in: ids } }, include: recipeInclude }) : [];
    const byId = new Map(items.map((item) => [item.id, item]));
    return { items: ids.map((id) => sanitizeRecipe(byId.get(id))).filter(Boolean), meta: { page: Math.floor(skip / take) + 1, limit: take, total, totalPages: Math.ceil(total / take) } };
  }

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

export async function suggestRecipes({ q, limit }) {
  const term = q.trim();
  const rows = await prisma.$queryRaw(Prisma.sql`
    SELECT label, slug, type
    FROM (
      SELECT r.title AS label,
        r.slug AS slug,
        'RECIPE'::text AS type,
        CASE WHEN immutable_unaccent(r.title) ILIKE immutable_unaccent(${term}) || '%' THEN 0 ELSE 1 END AS prefix_rank,
        similarity(immutable_unaccent(r.title), immutable_unaccent(${term})) AS score,
        r."publishedAt" AS sort_time
      FROM recipes r
      WHERE r.status = 'PUBLISHED'
        AND r.visibility = 'PUBLIC'
        AND r."deletedAt" IS NULL
        AND r."hiddenAt" IS NULL
        AND EXISTS (SELECT 1 FROM users u WHERE u.id = r."authorId" AND u.status = 'ACTIVE' AND u."deletedAt" IS NULL)
        AND (
          immutable_unaccent(r.title) ILIKE '%' || immutable_unaccent(${term}) || '%'
          OR immutable_unaccent(r.title) % immutable_unaccent(${term})
        )
      UNION ALL
      SELECT t.name, t.slug, 'TAG'::text,
        CASE WHEN immutable_unaccent(t.name) ILIKE immutable_unaccent(${term}) || '%' THEN 0 ELSE 1 END,
        similarity(immutable_unaccent(t.name), immutable_unaccent(${term})),
        NULL::timestamp
      FROM tags t
      WHERE immutable_unaccent(t.name) ILIKE '%' || immutable_unaccent(${term}) || '%'
        OR immutable_unaccent(t.name) % immutable_unaccent(${term})
      UNION ALL
      SELECT c.name, c.slug, 'CATEGORY'::text,
        CASE WHEN immutable_unaccent(c.name) ILIKE immutable_unaccent(${term}) || '%' THEN 0 ELSE 1 END,
        similarity(immutable_unaccent(c.name), immutable_unaccent(${term})),
        NULL::timestamp
      FROM categories c
      WHERE immutable_unaccent(c.name) ILIKE '%' || immutable_unaccent(${term}) || '%'
        OR immutable_unaccent(c.name) % immutable_unaccent(${term})
    ) matches
    ORDER BY
      CASE matches.type WHEN 'RECIPE' THEN 0 WHEN 'TAG' THEN 1 ELSE 2 END,
      matches.prefix_rank,
      matches.score DESC,
      matches.sort_time DESC NULLS LAST,
      matches.label ASC
    LIMIT ${limit}
  `);
  return rows.map((row) => ({ type: row.type, label: row.label, slug: row.slug }));
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

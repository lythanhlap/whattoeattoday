const DIFFICULTIES = new Set(['EASY', 'MEDIUM', 'HARD']);
const VISIBILITIES = new Set(['PUBLIC', 'PRIVATE', 'UNLISTED']);
const MAX_GALLERY_IMAGES = 6;

function positiveInteger(value, field, errors, { allowNull = true } = {}) {
  if (value === undefined || (value === null && allowNull)) return;
  if (!Number.isInteger(value) || value < 0) errors[field] = `${field} must be a non-negative integer`;
}

function normalizeList(items, field, errors) {
  if (items === undefined) return undefined;
  if (!Array.isArray(items)) {
    errors[field] = `${field} must be an array`;
    return [];
  }
  return items;
}

export function validateRecipeInput(body, { partial = false } = {}) {
  const errors = {};
  const title = typeof body.title === 'string' ? body.title.trim() : body.title;
  const description = typeof body.description === 'string' ? body.description.trim() : body.description;

  if (!partial || title !== undefined) {
    if (typeof title !== 'string' || title.length < 3 || title.length > 150) errors.title = 'Title must be 3 to 150 characters';
  }
  if (description !== undefined && description !== null && description.length > 2000) errors.description = 'Description is too long';

  for (const field of ['prepTimeMinutes', 'cookTimeMinutes', 'totalTimeMinutes', 'servings']) positiveInteger(body[field], field, errors);
  for (const field of ['tips', 'substitutions', 'storageInstructions']) {
    if (body[field] !== undefined && body[field] !== null && typeof body[field] !== 'string') errors[field] = `${field} must be text`;
  }
  if (body.difficulty !== undefined && body.difficulty !== null && !DIFFICULTIES.has(body.difficulty)) errors.difficulty = 'Difficulty is invalid';
  if (body.visibility !== undefined && !VISIBILITIES.has(body.visibility)) errors.visibility = 'Visibility is invalid';
  if (body.categoryId !== undefined && body.categoryId !== null && typeof body.categoryId !== 'string') errors.categoryId = 'Category is invalid';

  const ingredients = normalizeList(body.ingredients, 'ingredients', errors);
  const steps = normalizeList(body.steps, 'steps', errors);
  const tagIds = normalizeList(body.tagIds, 'tagIds', errors);
  const imageIds = normalizeList(body.imageIds, 'imageIds', errors);

  if (!partial || ingredients !== undefined) {
    if (!partial && (!ingredients || ingredients.length === 0)) errors.ingredients = 'At least one ingredient is required';
    ingredients?.forEach((ingredient, index) => {
      if (!ingredient || typeof ingredient.displayName !== 'string' || ingredient.displayName.trim().length === 0) errors[`ingredients.${index}.displayName`] = 'Ingredient name is required';
    });
  }
  if (!partial || steps !== undefined) {
    if (!partial && (!steps || steps.length === 0)) errors.steps = 'At least one step is required';
    steps?.forEach((step, index) => {
      if (!step || typeof step.instruction !== 'string' || step.instruction.trim().length === 0) errors[`steps.${index}.instruction`] = 'Step instruction is required';
      if (step?.durationMinutes !== undefined && (!Number.isInteger(step.durationMinutes) || step.durationMinutes < 0)) errors[`steps.${index}.durationMinutes`] = 'Duration must be a non-negative integer';
    });
  }
  if (tagIds && (tagIds.some((id) => typeof id !== 'string') || new Set(tagIds).size !== tagIds.length)) errors.tagIds = 'Tag ids must be unique strings';
  if (imageIds && (imageIds.length > MAX_GALLERY_IMAGES || imageIds.some((id) => typeof id !== 'string') || new Set(imageIds).size !== imageIds.length)) errors.imageIds = `Gallery images must be up to ${MAX_GALLERY_IMAGES} unique media asset ids`;

  if (Object.keys(errors).length > 0) {
    const error = new Error('Validation failed');
    error.statusCode = 422;
    error.code = 'VALIDATION_ERROR';
    error.details = errors;
    throw error;
  }

  return {
    ...body,
    ...(title !== undefined ? { title } : {}),
    ...(description !== undefined ? { description } : {}),
    ...(ingredients ? { ingredients } : {}),
    ...(steps ? { steps } : {}),
    ...(tagIds ? { tagIds } : {}),
    ...(imageIds ? { imageIds } : {}),
  };
}

export function validateRecipeQuery(query) {  const page = Number(query.page || 1);
  const limit = Number(query.limit || 20);
  const maxCookTime = query.maxCookTime === undefined ? undefined : Number(query.maxCookTime);
  const tags = query.tags ? String(query.tags).split(',').map((tag) => tag.trim()).filter(Boolean) : undefined;
  const hasCooksnap = query.hasCooksnap === undefined ? false : query.hasCooksnap === 'true';
  const featured = query.featured === 'true';
  const allowedSorts = new Set(['newest', 'popular', 'cooksnaps']);
  const allowedDiets = new Set(['mon-chay', 'thuan-chay', 'eat-clean', 'khong-gluten', 'khong-sua']);
  const allowedStatuses = new Set(['DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'REJECTED', 'ARCHIVED']);
  const allowedVisibilities = new Set(['PUBLIC', 'PRIVATE', 'UNLISTED']);
  const q = query.q === undefined ? undefined : String(query.q).trim();
  const ingredient = query.ingredient === undefined ? undefined : String(query.ingredient).trim();
  const diet = query.diet === undefined || query.diet === '' ? undefined : String(query.diet);
  const errors = {};
  if (!Number.isInteger(page) || page < 1) errors.page = 'Page must be a positive integer';
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) errors.limit = 'Limit must be between 1 and 50';
  if (maxCookTime !== undefined && (!Number.isInteger(maxCookTime) || maxCookTime < 0)) errors.maxCookTime = 'Max cook time must be a non-negative integer';
  if (!allowedSorts.has(query.sort || 'newest')) errors.sort = 'Sort is invalid';
  if (q && q.length > 120) errors.q = 'Search keyword is too long';
  if (ingredient && ingredient.length > 100) errors.ingredient = 'Ingredient keyword is too long';
  if (diet && !allowedDiets.has(diet)) errors.diet = 'Diet filter is invalid';
  if (query.status !== undefined && query.status !== '' && !allowedStatuses.has(query.status)) errors.status = 'Status filter is invalid';
  if (query.visibility !== undefined && query.visibility !== '' && !allowedVisibilities.has(query.visibility)) errors.visibility = 'Visibility filter is invalid';
  if (tags && tags.length > 10) errors.tags = 'At most 10 tags are allowed';
  if (Object.keys(errors).length) {
    const error = new Error('Invalid recipe query');
    error.statusCode = 422;
    error.code = 'VALIDATION_ERROR';
    error.details = errors;
    throw error;
  }
  return { ...query, q, ingredient, diet, featured, page, limit, maxCookTime, tags, hasCooksnap, sort: query.sort || 'newest' };
}

export function validateSuggestionQuery(query) {
  const errors = {};
  const q = typeof query.q === 'string' ? query.q.trim() : '';

  if (q.length < 2 || q.length > 100) errors.q = 'Search query must be 2 to 100 characters';

  let limit = 6;
  if (query.limit !== undefined && query.limit !== '') {
    limit = Number(query.limit);
    if (!Number.isInteger(limit) || limit < 1 || limit > 10) errors.limit = 'Limit must be an integer between 1 and 10';
  }

  if (Object.keys(errors).length) {
    const error = new Error('Invalid suggestion query');
    error.statusCode = 422;
    error.code = 'VALIDATION_ERROR';
    error.details = errors;
    throw error;
  }

  return { q, limit };
}

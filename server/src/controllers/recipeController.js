import { listRecipes, createRecipe, updateRecipe, publishRecipe, getRecipeBySlug, deleteRecipe, suggestRecipes } from '../services/recipeService.js';
import { recordRecipeView } from '../services/recipeViewService.js';
import { validateRecipeInput, validateRecipeQuery, validateSuggestionQuery } from '../validators/recipeValidator.js';

export async function createRecipeController(request, response, next) {
  try {
    const recipe = await createRecipe(request.auth.userId, validateRecipeInput(request.body));
    response.status(201).json({ data: { recipe }, meta: {}, error: null });
  } catch (error) { next(error); }
}

export async function listRecipesController(request, response, next) {
  try {
    const mine = request.query.mine === 'true';
    if (mine && !request.auth?.userId) {
      const error = new Error('Authentication required');
      error.statusCode = 401;
      error.code = 'AUTH_REQUIRED';
      throw error;
    }
    const result = await listRecipes({ ...validateRecipeQuery(request.query), userId: mine ? request.auth.userId : undefined });
    response.status(200).json({ data: result.items, meta: result.meta, error: null });
  } catch (error) { next(error); }
}

export async function suggestRecipesController(request, response, next) {
  try {
    const { q, limit } = validateSuggestionQuery(request.query);
    const suggestions = await suggestRecipes({ q, limit });
    response.status(200).json({ data: suggestions, meta: { query: q, limit }, error: null });
  } catch (error) { next(error); }
}

export async function getRecipeController(request, response, next) {  try {
    const recipe = await getRecipeBySlug(request.params.slug, request.auth?.userId, request.auth?.role);
    response.status(200).json({ data: { recipe }, meta: {}, error: null });
  } catch (error) { next(error); }
}

export async function recordRecipeViewController(request, response, next) {
  try {
    const result = await recordRecipeView(request.params.id, {
      userId: request.auth?.userId,
      ip: request.ip,
      userAgent: request.get('user-agent'),
    });
    response.status(200).json({ data: result, meta: {}, error: null });
  } catch (error) { next(error); }
}

export async function updateRecipeController(request, response, next) {
  try {
    const recipe = await updateRecipe(request.auth.userId, request.auth.role, request.params.id, validateRecipeInput(request.body, { partial: true }));
    response.status(200).json({ data: { recipe }, meta: {}, error: null });
  } catch (error) { next(error); }
}

export async function publishRecipeController(request, response, next) {
  try {
    const recipe = await publishRecipe(request.auth.userId, request.auth.role, request.params.id);
    response.status(200).json({ data: { recipe }, meta: {}, error: null });
  } catch (error) { next(error); }
}

export async function deleteRecipeController(request, response, next) {
  try {
    await deleteRecipe(request.auth.userId, request.auth.role, request.params.id);
    response.status(204).send();
  } catch (error) { next(error); }
}

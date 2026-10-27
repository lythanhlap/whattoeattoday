import { listReviewQueue, reviewRecipe } from '../services/reviewService.js';
import { validateReviewInput, validateReviewQueueQuery } from '../validators/editorialValidator.js';

export async function listReviewQueueController(request, response, next) {
  try {
    const result = await listReviewQueue(validateReviewQueueQuery(request.query));
    response.json({ data: result.items, meta: result.meta, error: null });
  } catch (error) { next(error); }
}

export async function reviewRecipeController(request, response, next) {
  try {
    const recipe = await reviewRecipe(request.auth.userId, request.auth.role, request.params.id, validateReviewInput(request.body));
    response.json({ data: { recipe }, meta: {}, error: null });
  } catch (error) { next(error); }
}

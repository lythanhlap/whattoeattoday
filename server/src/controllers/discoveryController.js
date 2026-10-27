import { trendingKeywords } from '../services/discoveryService.js';

export async function trendingKeywordsController(request, response, next) {
  try {
    const limit = Number(request.query.limit || 8);
    if (!Number.isInteger(limit) || limit < 1 || limit > 20) {
      const error = new Error('Limit must be between 1 and 20');
      error.statusCode = 422;
      error.code = 'VALIDATION_ERROR';
      error.details = { limit: 'Limit must be between 1 and 20' };
      throw error;
    }
    response.json({ data: { keywords: await trendingKeywords({ limit }) }, meta: {}, error: null });
  } catch (error) { next(error); }
}

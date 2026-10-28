import { createBanner, deleteBanner, listBanners, listPublicBanners, updateBanner } from '../services/bannerService.js';
import { validateBannerInput, validateBannerListQuery } from '../validators/bannerValidator.js';

export async function listPublicBannersController(_request, response, next) {
  try {
    response.json({ data: await listPublicBanners(), meta: {}, error: null });
  } catch (error) { next(error); }
}

export async function listBannersController(request, response, next) {
  try {
    const query = validateBannerListQuery(request.query);
    const result = await listBanners(query);
    response.json({ data: result.items, meta: result.meta, error: null });
  } catch (error) { next(error); }
}

export async function createBannerController(request, response, next) {
  try {
    const banner = await createBanner(request.auth.userId, validateBannerInput(request.body));
    response.status(201).json({ data: { banner }, meta: {}, error: null });
  } catch (error) { next(error); }
}

export async function updateBannerController(request, response, next) {
  try {
    const banner = await updateBanner(request.auth.userId, request.params.id, validateBannerInput(request.body, { partial: true }));
    response.json({ data: { banner }, meta: {}, error: null });
  } catch (error) { next(error); }
}

export async function deleteBannerController(request, response, next) {
  try {
    await deleteBanner(request.params.id);
    response.status(204).send();
  } catch (error) { next(error); }
}

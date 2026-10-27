import { cleanupOrphanMediaAssets, createUploadSignature, registerUploadedAsset } from '../services/mediaService.js';

export async function createUploadSignatureController(request, response, next) {
  try { response.json({ data: { upload: await createUploadSignature(request.auth.userId, request.body?.purpose || 'cooksnap') }, meta: {}, error: null }); } catch (error) { next(error); }
}

export async function registerMediaAssetController(request, response, next) { try { const asset = await registerUploadedAsset(request.auth.userId, request.body); response.status(201).json({ data: { asset }, meta: {}, error: null }); } catch (error) { next(error); } }
export async function cleanupMediaAssetsController(_request, response, next) { try { response.json({ data: await cleanupOrphanMediaAssets(), meta: {}, error: null }); } catch (error) { next(error); } }

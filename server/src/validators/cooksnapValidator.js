export function validateCooksnapInput(body) {
  const errors = {};
  if (body.mediaAssetId !== undefined && (typeof body.mediaAssetId !== 'string' || body.mediaAssetId.length > 64)) errors.mediaAssetId = 'Media asset id is invalid';
  if (!body.mediaAssetId && (typeof body.imageUrl !== 'string' || !/^https?:\/\/[^\s]+$/i.test(body.imageUrl) || body.imageUrl.length > 2048)) errors.imageUrl = 'A valid object storage image URL is required';
  if (body.caption !== undefined && body.caption !== null && (typeof body.caption !== 'string' || body.caption.length > 1000)) errors.caption = 'Caption must be at most 1000 characters';
  if (Object.keys(errors).length) { const error = new Error('Validation failed'); error.statusCode = 422; error.code = 'VALIDATION_ERROR'; error.details = errors; throw error; }
  return { imageUrl: body.imageUrl, mediaAssetId: body.mediaAssetId, caption: body.caption?.trim() || null };
}

export function validateCooksnapUpdate(body) {
  const errors = {};
  const allowedKeys = new Set(['caption', 'mediaAssetId']);
  if (Object.keys(body || {}).some((key) => !allowedKeys.has(key))) errors.body = 'Only caption and mediaAssetId can be updated';
  if (body?.caption !== undefined && body.caption !== null && (typeof body.caption !== 'string' || body.caption.length > 1000)) errors.caption = 'Caption must be at most 1000 characters';
  if (body?.mediaAssetId !== undefined && (typeof body.mediaAssetId !== 'string' || body.mediaAssetId.length > 64)) errors.mediaAssetId = 'Media asset id is invalid';
  if (!errors.body && body?.caption === undefined && body?.mediaAssetId === undefined) errors.body = 'Nothing to update';
  if (Object.keys(errors).length) {
    const error = new Error('Validation failed');
    error.statusCode = 422;
    error.code = 'VALIDATION_ERROR';
    error.details = errors;
    throw error;
  }
  return {
    caption: body.caption === undefined ? undefined : (body.caption?.trim() || null),
    mediaAssetId: body.mediaAssetId,
  };
}

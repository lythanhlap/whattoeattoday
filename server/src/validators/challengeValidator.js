const CHALLENGE_STATUSES = new Set(['DRAFT', 'UPCOMING', 'ACTIVE', 'ENDED', 'ARCHIVED']);

function validation(details) {
  const error = new Error('Validation failed');
  error.statusCode = 422;
  error.code = 'VALIDATION_ERROR';
  error.details = details;
  return error;
}

function parseDate(value) {
  if (value === undefined || value === null || value === '') return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function validateChallengeInput(body = {}, { partial = false } = {}) {
  const errors = {};

  if (!partial || body.title !== undefined) {
    if (typeof body.title !== 'string' || body.title.trim().length < 5 || body.title.trim().length > 150) {
      errors.title = 'Tiêu đề thử thách phải từ 5 đến 150 ký tự.';
    }
  }

  if (body.description !== undefined && body.description !== null && (typeof body.description !== 'string' || body.description.length > 2000)) {
    errors.description = 'Mô tả tối đa 2000 ký tự.';
  }

  if (body.bannerUrl !== undefined && body.bannerUrl !== null && body.bannerUrl !== '') {
    if (typeof body.bannerUrl !== 'string' || body.bannerUrl.length > 2048 || !isHttpUrl(body.bannerUrl)) {
      errors.bannerUrl = 'Banner phải là URL http/https hợp lệ.';
    }
  }

  if (!partial || body.startsAt !== undefined) {
    if (!parseDate(body.startsAt)) errors.startsAt = 'Thời gian bắt đầu không hợp lệ.';
  }

  if (!partial || body.endsAt !== undefined) {
    if (!parseDate(body.endsAt)) errors.endsAt = 'Thời gian kết thúc không hợp lệ.';
  }

  if (body.startsAt !== undefined && body.endsAt !== undefined) {
    const startsAt = parseDate(body.startsAt);
    const endsAt = parseDate(body.endsAt);
    if (startsAt && endsAt && startsAt >= endsAt) errors.endsAt = 'Thời gian kết thúc phải sau thời gian bắt đầu.';
  }

  if (body.status !== undefined && !CHALLENGE_STATUSES.has(body.status)) {
    errors.status = 'Trạng thái thử thách không hợp lệ.';
  }

  if (Object.keys(errors).length) throw validation(errors);

  return {
    ...body,
    ...(body.title !== undefined ? { title: body.title.trim() } : {}),
    ...(body.description !== undefined ? { description: body.description?.trim() || null } : {}),
    ...(body.bannerUrl !== undefined ? { bannerUrl: body.bannerUrl?.trim() || null } : {}),
    ...(body.startsAt !== undefined ? { startsAt: parseDate(body.startsAt) } : {}),
    ...(body.endsAt !== undefined ? { endsAt: parseDate(body.endsAt) } : {}),
  };
}

export function validateChallengeEntryInput(body = {}) {
  if (typeof body.recipeId !== 'string' || body.recipeId.length < 10) {
    throw validation({ recipeId: 'recipeId không hợp lệ.' });
  }
  return body;
}

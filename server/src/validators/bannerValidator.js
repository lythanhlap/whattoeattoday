const LIST_STATUSES = new Set(['all', 'active', 'inactive']);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

function isSafeLink(value) {
  if (typeof value !== 'string' || value.length > 500) return false;
  if (value.startsWith('/')) return true;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function validateBannerInput(body = {}, { partial = false } = {}) {
  const errors = {};

  if (!partial || body.title !== undefined) {
    if (typeof body.title !== 'string' || body.title.trim().length < 3 || body.title.trim().length > 120) {
      errors.title = 'Tiêu đề banner phải từ 3 đến 120 ký tự.';
    }
  }

  if (body.subtitle !== undefined && body.subtitle !== null && (typeof body.subtitle !== 'string' || body.subtitle.length > 240)) {
    errors.subtitle = 'Mô tả ngắn tối đa 240 ký tự.';
  }

  if (body.linkUrl !== undefined && body.linkUrl !== null && body.linkUrl !== '' && !isSafeLink(body.linkUrl)) {
    errors.linkUrl = 'Liên kết phải là đường dẫn nội bộ bắt đầu bằng / hoặc URL http/https.';
  }

  if (!partial || body.imageId !== undefined) {
    if (typeof body.imageId !== 'string' || !UUID_PATTERN.test(body.imageId)) {
      errors.imageId = 'Ảnh banner không hợp lệ.';
    }
  }

  if (body.sortOrder !== undefined) {
    if (!Number.isInteger(body.sortOrder) || body.sortOrder < 0 || body.sortOrder > 999) {
      errors.sortOrder = 'Thứ tự phải là số nguyên từ 0 đến 999.';
    }
  }

  if (body.isActive !== undefined && typeof body.isActive !== 'boolean') {
    errors.isActive = 'Trạng thái hiển thị không hợp lệ.';
  }

  if (body.startsAt !== undefined && body.startsAt !== null && body.startsAt !== '' && !parseDate(body.startsAt)) {
    errors.startsAt = 'Thời gian bắt đầu không hợp lệ.';
  }

  if (body.endsAt !== undefined && body.endsAt !== null && body.endsAt !== '' && !parseDate(body.endsAt)) {
    errors.endsAt = 'Thời gian kết thúc không hợp lệ.';
  }

  if (body.startsAt && body.endsAt) {
    const startsAt = parseDate(body.startsAt);
    const endsAt = parseDate(body.endsAt);
    if (startsAt && endsAt && startsAt >= endsAt) errors.endsAt = 'Thời gian kết thúc phải sau thời gian bắt đầu.';
  }

  if (Object.keys(errors).length) throw validation(errors);

  return {
    ...(body.title !== undefined ? { title: body.title.trim() } : {}),
    ...(body.subtitle !== undefined ? { subtitle: body.subtitle?.trim() || null } : {}),
    ...(body.linkUrl !== undefined ? { linkUrl: body.linkUrl?.trim() || null } : {}),
    ...(body.imageId !== undefined ? { imageId: body.imageId } : {}),
    ...(body.sortOrder !== undefined ? { sortOrder: body.sortOrder } : {}),
    ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
    ...(body.startsAt !== undefined ? { startsAt: parseDate(body.startsAt) } : {}),
    ...(body.endsAt !== undefined ? { endsAt: parseDate(body.endsAt) } : {}),
  };
}

export function validateBannerListQuery(query = {}) {
  const page = Number(query.page || 1);
  const limit = Number(query.limit || 20);
  const status = String(query.status || 'all');
  const q = typeof query.q === 'string' ? query.q.trim() : '';
  const errors = {};
  if (!Number.isInteger(page) || page < 1) errors.page = 'Page must be a positive integer';
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) errors.limit = 'Limit must be between 1 and 50';
  if (!LIST_STATUSES.has(status)) errors.status = 'Status must be all, active or inactive';
  if (q.length > 100) errors.q = 'Search text must be at most 100 characters';
  if (Object.keys(errors).length) throw validation(errors);
  return { page, limit, status, q };
}

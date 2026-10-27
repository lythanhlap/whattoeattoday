const ACTIONS = new Set(['APPROVE', 'REJECT', 'REQUEST_CHANGES']);

function validation(details) {
  const error = new Error('Validation failed');
  error.statusCode = 422;
  error.code = 'VALIDATION_ERROR';
  error.details = details;
  return error;
}

export function validateReviewInput(body = {}) {
  const errors = {};
  if (!ACTIONS.has(body.action)) errors.action = 'Action must be APPROVE, REJECT or REQUEST_CHANGES';
  if (body.note !== undefined && body.note !== null && (typeof body.note !== 'string' || body.note.length > 1000)) {
    errors.note = 'Note must be at most 1000 characters';
  }
  if (['REJECT', 'REQUEST_CHANGES'].includes(body.action) && (typeof body.note !== 'string' || body.note.trim().length < 5)) {
    errors.note = 'A note of at least 5 characters is required for this action';
  }
  if (Object.keys(errors).length) throw validation(errors);
  return { action: body.action, note: body.note?.trim() || null };
}

export function validateReviewQueueQuery(query = {}) {
  const page = Number(query.page || 1);
  const limit = Number(query.limit || 20);
  const status = query.status || 'PENDING_REVIEW';
  const statuses = new Set(['PENDING_REVIEW', 'REJECTED', 'DRAFT', 'PUBLISHED']);
  const errors = {};
  if (!Number.isInteger(page) || page < 1) errors.page = 'Page must be a positive integer';
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) errors.limit = 'Limit must be between 1 and 50';
  if (!statuses.has(status)) errors.status = 'Status is invalid';
  if (Object.keys(errors).length) throw validation(errors);
  return { page, limit, status };
}

export function validateTaxonomyInput(body = {}, { partial = false } = {}) {
  const errors = {};
  if (!partial || body.name !== undefined) {
    if (typeof body.name !== 'string' || body.name.trim().length < 2 || body.name.trim().length > 100) {
      errors.name = 'Name must be 2 to 100 characters';
    }
  }
  if (body.slug !== undefined && body.slug !== null) {
    if (typeof body.slug !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(body.slug) || body.slug.length > 120) {
      errors.slug = 'Slug may only contain lowercase letters, numbers and hyphens';
    }
  }
  if (body.description !== undefined && body.description !== null && (typeof body.description !== 'string' || body.description.length > 500)) {
    errors.description = 'Description must be at most 500 characters';
  }
  if (Object.keys(errors).length) throw validation(errors);
  return {
    ...(body.name !== undefined ? { name: body.name.trim() } : {}),
    ...(body.slug !== undefined ? { slug: body.slug?.trim() || null } : {}),
    ...(body.description !== undefined ? { description: body.description?.trim() || null } : {}),
  };
}

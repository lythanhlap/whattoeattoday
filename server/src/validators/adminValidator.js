const CONTENT_TYPES = new Set(['recipes', 'comments', 'cooksnaps']);
const CONTENT_STATES = new Set(['all', 'visible', 'hidden']);
const CONTENT_ACTIONS = new Set(['HIDE', 'RESTORE', 'DELETE']);

function validation(details) {
  const error = new Error('Validation failed');
  error.statusCode = 422;
  error.code = 'VALIDATION_ERROR';
  error.details = details;
  return error;
}

export function validateContentQuery(query = {}) {
  const page = Number(query.page || 1);
  const limit = Number(query.limit || 20);
  const type = query.type || 'recipes';
  const state = query.state || 'all';
  const q = typeof query.q === 'string' ? query.q.trim() : '';
  const errors = {};
  if (!CONTENT_TYPES.has(type)) errors.type = 'Type must be recipes, comments or cooksnaps';
  if (!CONTENT_STATES.has(state)) errors.state = 'State must be all, visible or hidden';
  if (!Number.isInteger(page) || page < 1) errors.page = 'Page must be a positive integer';
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) errors.limit = 'Limit must be between 1 and 50';
  if (q.length > 120) errors.q = 'Search text must be at most 120 characters';
  if (Object.keys(errors).length) throw validation(errors);
  return { page, limit, type, state, q };
}

function validateActionBody(body = {}) {
  const errors = {};
  if (!CONTENT_ACTIONS.has(body.action)) errors.action = 'Action must be HIDE, RESTORE or DELETE';
  if (body.note !== undefined && body.note !== null && (typeof body.note !== 'string' || body.note.length > 500)) {
    errors.note = 'Note must be at most 500 characters';
  }
  if (Object.keys(errors).length) throw validation(errors);
  return { action: body.action, note: body.note?.trim() || null };
}

export function validateContentAction(body = {}) {
  return validateActionBody(body);
}

export function validateBulkContentAction(body = {}) {
  const errors = {};
  if (!CONTENT_TYPES.has(body.type)) errors.type = 'Type must be recipes, comments or cooksnaps';
  if (!Array.isArray(body.ids) || body.ids.length < 1 || body.ids.length > 50) {
    errors.ids = 'ids must contain 1 to 50 content ids';
  } else if (body.ids.some((id) => typeof id !== 'string' || id.length > 64)) {
    errors.ids = 'Every id must be a valid string';
  }
  if (Object.keys(errors).length) throw validation(errors);
  return { ...validateActionBody(body), type: body.type, ids: [...new Set(body.ids)] };
}

export function validateSuspendInput(body = {}) {
  const errors = {};
  const durationDays = Number(body.durationDays);
  if (!Number.isInteger(durationDays) || durationDays < 1 || durationDays > 30) {
    errors.durationDays = 'durationDays must be an integer between 1 and 30';
  }
  if (typeof body.reason !== 'string' || body.reason.trim().length < 5 || body.reason.length > 500) {
    errors.reason = 'Reason must be 5 to 500 characters';
  }
  if (Object.keys(errors).length) throw validation(errors);
  return { durationDays, reason: body.reason.trim() };
}

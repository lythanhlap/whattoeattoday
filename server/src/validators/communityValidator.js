const VISIBILITIES = new Set(['PUBLIC', 'PRIVATE']);
const REPORT_REASONS = new Set(['SPAM', 'COPIED_CONTENT', 'IRRELEVANT_IMAGE', 'DANGEROUS_OR_MISLEADING', 'HARASSMENT', 'COPYRIGHT', 'OFF_TOPIC', 'OTHER']);

function validation(details) { const error = new Error('Validation failed'); error.statusCode = 422; error.code = 'VALIDATION_ERROR'; error.details = details; return error; }

export function validateCollectionInput(body, { partial = false } = {}) {
  const errors = {};
  if (!partial || body.name !== undefined) {
    if (typeof body.name !== 'string' || body.name.trim().length < 2 || body.name.trim().length > 120) errors.name = 'Name must be 2 to 120 characters';
  }
  if (body.description !== undefined && body.description !== null && typeof body.description !== 'string') errors.description = 'Description must be text';
  if (body.description !== undefined && body.description !== null && body.description.length > 500) errors.description = 'Description must be at most 500 characters';
  if (body.coverImageId !== undefined && body.coverImageId !== null && (typeof body.coverImageId !== 'string' || body.coverImageId.length > 64)) errors.coverImageId = 'Cover image id is invalid';
  if (body.visibility !== undefined && !VISIBILITIES.has(body.visibility)) errors.visibility = 'Visibility is invalid';
  if (Object.keys(errors).length) throw validation(errors);
  return body;
}

export function validateBookmarkInput(body = {}) {
  if (body.collectionId !== undefined && body.collectionId !== null && typeof body.collectionId !== 'string') throw validation({ collectionId: 'Collection id is invalid' });
  return body;
}

export function validateReportInput(body) {
  const errors = {};
  if (!REPORT_REASONS.has(body.reason)) errors.reason = 'Report reason is invalid';
  if (body.description !== undefined && body.description !== null && (typeof body.description !== 'string' || body.description.length > 1000)) errors.description = 'Description must be at most 1000 characters';
  if (Object.keys(errors).length) throw validation(errors);
  return body;
}

export function validateModerationAction(body) {
  const actions = new Set(['DISMISS', 'HIDE', 'RESTORE']);
  if (!actions.has(body.action)) throw validation({ action: 'Action must be DISMISS, HIDE or RESTORE' });
  if (body.note !== undefined && body.note !== null && (typeof body.note !== 'string' || body.note.length > 500)) throw validation({ note: 'Note must be at most 500 characters' });
  return body;
}

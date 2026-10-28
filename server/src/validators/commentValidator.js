const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function validateCommentInput(body) {
  if (!body || typeof body.content !== 'string' || body.content.trim().length < 1 || body.content.trim().length > 2000) {
    const error = new Error('Comment must be 1 to 2000 characters'); error.statusCode = 422; error.code = 'VALIDATION_ERROR'; error.details = { content: 'Comment must be 1 to 2000 characters' }; throw error;
  }

  let parentId = null;
  if (body.parentId !== undefined && body.parentId !== null) {
    if (typeof body.parentId !== 'string' || !UUID_PATTERN.test(body.parentId)) {
      const error = new Error('Parent comment id is invalid'); error.statusCode = 422; error.code = 'VALIDATION_ERROR'; error.details = { parentId: 'Parent comment id is invalid' }; throw error;
    }
    parentId = body.parentId;
  }

  return { content: body.content.trim(), parentId };
}

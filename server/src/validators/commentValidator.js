export function validateCommentInput(body) {
  if (!body || typeof body.content !== 'string' || body.content.trim().length < 1 || body.content.trim().length > 2000) {
    const error = new Error('Comment must be 1 to 2000 characters'); error.statusCode = 422; error.code = 'VALIDATION_ERROR'; error.details = { content: 'Comment must be 1 to 2000 characters' }; throw error;
  }
  return { content: body.content.trim() };
}

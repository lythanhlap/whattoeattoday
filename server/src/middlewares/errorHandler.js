export function notFoundHandler(request, _response, next) {
  const error = new Error(`Route not found: ${request.method} ${request.originalUrl}`);
  error.statusCode = 404;
  error.code = 'ROUTE_NOT_FOUND';
  next(error);
}

export function errorHandler(error, request, response, next) {
  const isInvalidIdentifier = error.code === 'P2023';
  const statusCode = isInvalidIdentifier ? 400 : error.statusCode || 500;
  const isServerError = statusCode >= 500;

  void next;

  if (isServerError) {
    console.error(`[server-error] ${request.method} ${request.originalUrl}`, error);
  }

  response.status(statusCode).json({
    data: null,
    meta: {},
    error: {
      code: isInvalidIdentifier
        ? 'INVALID_IDENTIFIER'
        : isServerError
          ? 'INTERNAL_SERVER_ERROR'
          : error.code || 'REQUEST_ERROR',
      message: isInvalidIdentifier
        ? 'Identifier is invalid'
        : isServerError
          ? 'Internal server error'
          : error.message,
      ...(error.details ? { details: error.details } : {}),
    },
  });
}

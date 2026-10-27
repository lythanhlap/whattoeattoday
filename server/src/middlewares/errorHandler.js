export function notFoundHandler(request, _response, next) {
  const error = new Error(`Route not found: ${request.method} ${request.originalUrl}`);
  error.statusCode = 404;
  error.code = 'ROUTE_NOT_FOUND';
  next(error);
}

export function errorHandler(error, _request, response, next) {
  const statusCode = error.statusCode || 500;
  const isServerError = statusCode >= 500;

  void next;

  response.status(statusCode).json({
    data: null,
    meta: {},
    error: {
      code: error.code || (isServerError ? 'INTERNAL_SERVER_ERROR' : 'REQUEST_ERROR'),
      message: isServerError ? 'Internal server error' : error.message,
      ...(error.details ? { details: error.details } : {}),
    },
  });
}

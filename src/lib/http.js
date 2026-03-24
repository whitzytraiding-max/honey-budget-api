class HttpError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function sendData(response, status, data, meta) {
  const payload = meta ? { data, meta } : { data };
  response.status(status).json(payload);
}

function asyncHandler(handler) {
  return async function wrapped(request, response, next) {
    try {
      await handler(request, response, next);
    } catch (error) {
      next(error);
    }
  };
}

export { HttpError, asyncHandler, sendData };

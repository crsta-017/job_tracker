// Every response in the API uses the same shape: { success, message, data }
const send = (res, status, message, data = null) =>
  res.status(status).json({ success: status < 400, message, data });

// Throw this anywhere in a route to produce a clean error response
class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Lets async route handlers throw without try/catch in every route
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

module.exports = { send, ApiError, asyncHandler };

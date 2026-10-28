const { send, ApiError } = require("../utils/http");

const notFound = (_req, res) => send(res, 404, "Route not found");

// Central error handler: maps every kind of error to a status code and the standard JSON format
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, _req, res, _next) => {
  if (err instanceof ApiError) return send(res, err.status, err.message);

  if (err.name === "ValidationError") {
    const message = Object.values(err.errors)
      .map((e) => (e.name === "CastError" ? `${e.path} has an invalid value` : e.message))
      .join("; ");
    return send(res, 400, message);
  }
  if (err.name === "CastError") return send(res, 400, `${err.path} has an invalid value`);

  if (err.code === 11000) {
    const dupRule = err.keyPattern && err.keyPattern.companyName;
    return send(res, 409, dupRule
      ? "An active application for this company and job role already exists."
      : "A record with the same unique value already exists.");
  }
  if (err.type === "entity.parse.failed") return send(res, 400, "Request body is not valid JSON");

  console.error(err);
  send(res, 500, "Something went wrong on the server");
};

module.exports = { notFound, errorHandler };

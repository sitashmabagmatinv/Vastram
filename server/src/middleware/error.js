export function notFound(req, res) {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
}

export function errorHandler(err, req, res, next) {
  const status = err.status || 500;
  const isDatabaseConnectionError =
    err.code === "ECONNREFUSED" ||
    err.code === "ER_ACCESS_DENIED_ERROR" ||
    err.code === "ER_BAD_DB_ERROR";

  res.status(status).json({
    message: isDatabaseConnectionError
      ? "Database is unavailable. Start MySQL, create the Vastram database, and check server/.env."
      : err.message || "Unexpected server error"
  });
}

export function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

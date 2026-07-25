import { sanitizeLog } from "../utils/sanitizer.js";

const globalErrorHandler = (err, req, res, next) => {
    if (res.headersSent) {
      return next(err);
    }

    const statusCode = err.status || err.statusCode || (err.isConfigError ? 400 : 500);

    console.error(`[GlobalErrorHandler ${statusCode}]:`, sanitizeLog(err.message));

    if (statusCode === 429) {
      const retryAfter = err.retryAfter || err.response?.headers?.["retry-after"];
      if (retryAfter) res.set("retry-after", String(retryAfter));

      return res.status(429).json({
        success: false,
        message: err.message || "Too Many Requests",
        error: err.message || "Too Many Requests",
        retryAfter: retryAfter || null,
      });
    }

    return res.status(statusCode).json({
        success: false,
        message: err.message || 'Internal Server Error',
        error: err.message || 'Internal Server Error',
        errors:  err.errors || [],
    });
};

export default globalErrorHandler;
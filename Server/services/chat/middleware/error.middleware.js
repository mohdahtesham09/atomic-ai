const globalErrorHandler = (err, req, res, next) => {
    if (res.headersSent) {
      return next(err);
    }

    if (err.code === "LIMIT_FILE_SIZE" || err.type === "entity.too.large" || err.status === 413) {
      return res.status(413).json({
        success: false,
        code: "FILE_TOO_LARGE",
        message: "PDF size must be 20 MB or less.",
        maxFileSizeMb: 20
      });
    }

    if (err.code === "INVALID_FILE_TYPE") {
      return res.status(400).json({
        success: false,
        code: "INVALID_FILE_TYPE",
        message: "Only PDF files are allowed."
      });
    }

    const statusCode = err.status || err.statusCode || 500;

    console.error(`[ChatGlobalErrorHandler ${statusCode}]:`, err.message);

    if (statusCode === 429) {
      const retryAfter = err.retryAfter || err.response?.headers?.["retry-after"];
      if (retryAfter) res.set("retry-after", String(retryAfter));

      return res.status(429).json({
        success: false,
        code: "RATE_LIMITED",
        message: err.message || "Too Many Requests",
        error: err.message || "Too Many Requests",
        retryAfter: retryAfter || null,
      });
    }

    return res.status(statusCode).json({
        success: false,
        code: err.code || "INTERNAL_ERROR",
        message: err.message || 'Internal Server Error',
        error: err.message || 'Internal Server Error',
        errors:  err.errors || [],
    });
};

export default globalErrorHandler;
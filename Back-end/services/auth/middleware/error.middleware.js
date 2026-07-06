const globalErrorHandler = (err, req, res, next) => {
    const statusCode = err.statusCode || 500;

    res.status(statusCode).json({
        success: false,
        message: err.message || 'Internal Server Error',
        errors:  err.errors || [],
        stack: process.env.NODE_ENV === "devlopment" ? err.stack : undefined
    });
}

export default globalErrorHandler
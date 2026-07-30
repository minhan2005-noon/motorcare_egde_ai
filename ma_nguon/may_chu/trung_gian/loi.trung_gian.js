function errorMiddleware(error, req, res, next) {
  if (res.headersSent) {
    return next(error);
  }

  let status = error.status || error.statusCode || 500;
  let message = error.message;

  if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
    status = 409;
    message = 'Dữ liệu đã tồn tại';
  }

  if (status >= 500) {
    console.error(`[${res.locals.requestId || 'no-request-id'}]`, error);
  }

  return res.status(status).json({
    success: false,
    message: status >= 500 && !error.expose ? 'Lỗi máy chủ' : message,
    details: status < 500 ? error.details : undefined,
    requestId: res.locals.requestId,
  });
}

module.exports = errorMiddleware;

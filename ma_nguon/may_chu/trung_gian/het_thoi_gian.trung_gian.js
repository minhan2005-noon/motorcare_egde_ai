function timeoutMiddleware(milliseconds = 15000) {
  return (req, res, next) => {
    res.setTimeout(milliseconds, () => {
      if (!res.headersSent) {
        res.status(503).json({
          success: false,
          message: 'Yêu cầu mất quá nhiều thời gian xử lý',
        });
      }
    });
    next();
  };
}

module.exports = timeoutMiddleware;

function notFound(req, res) {
  return res.status(404).json({
    success: false,
    message: 'Không tìm thấy endpoint',
    requestId: res.locals.requestId,
  });
}

module.exports = notFound;

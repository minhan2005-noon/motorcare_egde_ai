function ok(res, data, message = 'OK', status = 200) {
  return res.status(status).json({
    success: true,
    message,
    data,
    requestId: res.locals.requestId,
  });
}

function created(res, data, message = 'Created') {
  return ok(res, data, message, 201);
}

function fail(res, message = 'Bad request', status = 400, details) {
  const body = {
    success: false,
    message,
    requestId: res.locals.requestId,
  };

  if (details) {
    body.details = details;
  }

  return res.status(status).json(body);
}

module.exports = {
  ok,
  created,
  fail,
};

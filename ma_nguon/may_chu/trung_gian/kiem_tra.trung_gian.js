function validate(validator, source = 'body') {
  return (req, res, next) => {
    try {
      req.validated = validator(req[source] || {});
      return next();
    } catch (error) {
      return next(error);
    }
  };
}

module.exports = validate;

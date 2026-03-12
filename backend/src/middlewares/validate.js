const { ApiError } = require("../utils/apiError");

function validate(schema) {
  return (req, _res, next) => {
    if (!schema) return next();

    if (typeof schema.safeParse === "function") {
      const result = schema.safeParse(req.body);
      if (!result.success) {
        return next(new ApiError(400, result.error.message));
      }
      req.body = result.data;
      return next();
    }

    const result = schema.validate(req.body, { abortEarly: false, stripUnknown: true });
    if (result.error) {
      return next(new ApiError(400, result.error.message));
    }

    req.body = result.value;
    return next();
  };
}

module.exports = { validate };

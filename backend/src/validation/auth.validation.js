const Joi = require("joi");

const registerSchema = Joi.object({
  name: Joi.string().min(2).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
  twoFactorToken: Joi.string().length(6).optional(),
});

const refreshSchema = Joi.object({
  refreshToken: Joi.string().optional(),
});

const twoFactorSchema = Joi.object({
  token: Joi.string().length(6).required(),
});

module.exports = { registerSchema, loginSchema, refreshSchema, twoFactorSchema };

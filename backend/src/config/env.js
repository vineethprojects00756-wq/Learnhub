const dotenv = require("dotenv");
const Joi = require("joi");

const envSchema = Joi.object({
  NODE_ENV: Joi.string().valid("development", "test", "production").default("development"),
  PORT: Joi.number().default(5000),
  MONGO_URI: Joi.string().uri().required(),
  JWT_ACCESS_SECRET: Joi.string().min(12).required(),
  JWT_REFRESH_SECRET: Joi.string().min(12).required(),
  CORS_ORIGIN: Joi.string().allow("").default("*"),
  RATE_LIMIT_WINDOW_MS: Joi.number().default(15 * 60 * 1000),
  RATE_LIMIT_MAX: Joi.number().default(300),
  LOG_LEVEL: Joi.string().default("info"),
  MORGAN_FORMAT: Joi.string().default("dev"),
  STORAGE_PROVIDER: Joi.string().valid("cloudinary", "s3").default("cloudinary"),
  CLOUDINARY_CLOUD_NAME: Joi.string().allow(""),
  CLOUDINARY_API_KEY: Joi.string().allow(""),
  CLOUDINARY_API_SECRET: Joi.string().allow(""),
  AWS_REGION: Joi.string().allow(""),
  AWS_ACCESS_KEY_ID: Joi.string().allow(""),
  AWS_SECRET_ACCESS_KEY: Joi.string().allow(""),
  AWS_S3_BUCKET: Joi.string().allow(""),
  COOKIE_SECURE: Joi.boolean().truthy("true").falsy("false").default(false),
  COOKIE_SAMESITE: Joi.string().valid("lax", "strict", "none").default("lax"),
}).unknown();

function loadEnv() {
  dotenv.config();

  const { error, value } = envSchema.validate(process.env, { abortEarly: false });
  if (error) {
    throw new Error(`Environment validation error: ${error.message}`);
  }

  process.env = { ...process.env, ...value };
}

module.exports = { loadEnv };

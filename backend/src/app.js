const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");

const { logger, morganStream } = require("./config/logger");
const { apiRateLimiter } = require("./middlewares/rateLimit");
const { apiUsageTracker } = require("./middlewares/apiUsage");
const { optionalAuth } = require("./middlewares/optionalAuth");
const { maintenanceMode } = require("./middlewares/maintenance");
const { notFound, errorHandler } = require("./middlewares/error");
const routes = require("./routes");

const app = express();

// Core security and parsing
app.use(helmet());
const corsOrigin = process.env.CORS_ORIGIN || "*";
app.use(cors({
  origin: corsOrigin,
  credentials: corsOrigin !== "*",
}));
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Observability
app.use(morgan(process.env.MORGAN_FORMAT || "dev", { stream: morganStream }));

app.use(optionalAuth);
app.use(apiUsageTracker());

// Rate limit
app.use(apiRateLimiter());

// Optional auth + maintenance guard
app.use(maintenanceMode);

// Routes
app.use("/api", routes);

// 404 + error handler
app.use(notFound);
app.use(errorHandler);

module.exports = { app, logger };

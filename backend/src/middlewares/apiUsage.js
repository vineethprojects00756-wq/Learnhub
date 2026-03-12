const { ApiUsage } = require("../models/ApiUsage");

function apiUsageTracker() {
  return (req, res, next) => {
    const start = process.hrtime.bigint();
    res.on("finish", () => {
      const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
      ApiUsage.create({
        method: req.method,
        path: req.originalUrl,
        statusCode: res.statusCode,
        durationMs,
        user: req.user?._id || req.user?.id,
      }).catch(() => {});
    });
    next();
  };
}

module.exports = { apiUsageTracker };

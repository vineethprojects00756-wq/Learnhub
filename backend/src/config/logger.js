const winston = require("winston");

const fs = require("fs");
const path = require("path");

const transports = [new winston.transports.Console()];

if (process.env.LOG_FILE || process.env.NODE_ENV === "production") {
  const logFile = process.env.LOG_FILE || "logs/app.log";
  const logDir = path.dirname(logFile);
  if (logDir && !fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
  transports.push(
    new winston.transports.File({
      filename: logFile,
      level: "info",
    })
  );
}

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports,
});

const morganStream = {
  write: (message) => logger.info(message.trim()),
};

module.exports = { logger, morganStream };

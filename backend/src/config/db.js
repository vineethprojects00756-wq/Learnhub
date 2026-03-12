const mongoose = require("mongoose");
const { logger } = require("./logger");

async function connectDB() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    throw new Error("MONGO_URI is not set");
  }

  const maxPoolSize = Number(process.env.MONGO_MAX_POOL_SIZE) || 10;
  const serverSelectionTimeoutMS = Number(process.env.MONGO_SERVER_SELECTION_TIMEOUT_MS) || 10000;

  await mongoose.connect(uri, {
    maxPoolSize,
    serverSelectionTimeoutMS,
  });

  logger.info("MongoDB connected");
}

module.exports = { connectDB };

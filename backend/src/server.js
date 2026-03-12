const http = require("http");
const { app, logger } = require("./app");
const { loadEnv } = require("./config/env");
const { connectDB } = require("./config/db");
const { initSocket } = require("./realtime/socket");

loadEnv();

const PORT = Number(process.env.PORT) || 5000;

async function bootstrap() {
  await connectDB();

  const server = http.createServer(app);
  initSocket(server);

  server.listen(PORT, () => {
    logger.info(`API running on ${PORT}`);
  });

  server.on("error", (error) => {
    if (error.code === "EADDRINUSE") {
      logger.error(`Port ${PORT} already in use. Set PORT in backend/.env.`);
      return;
    }
    logger.error(`Server failed to start: ${error.message}`);
  });
}

bootstrap().catch((err) => {
  logger.error(`Fatal bootstrap error: ${err.message}`);
  process.exit(1);
});

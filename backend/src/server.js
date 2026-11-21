import { env } from './config/env.js';
import { connectDB, disconnectDB } from './config/db.js';
import app from './app.js';
import { closeRealtime, initRealtime } from './realtime/socket.js';
import { verifyStorage } from './services/storage.service.js';
import { logger } from './utils/logger.js';

async function start() {
  await connectDB(env.MONGODB_URI);
  verifyStorage(); // logs only; never blocks startup

  const server = app.listen(env.PORT, () => {
    logger.info(`API running on http://localhost:${env.PORT}/api/v1`);
    if (!env.isProduction) logger.info(`API docs on http://localhost:${env.PORT}/api/docs`);
  });
  // Slow-client protection: drop requests that take too long to send headers / body.
  server.headersTimeout = 30_000;
  server.requestTimeout = 60_000;
  initRealtime(server);

  const shutdown = (signal) => {
    logger.info(`${signal} received, shutting down`);
    // io.close() also closes the HTTP server, after dropping open live connections
    // (otherwise server.close would wait for them forever).
    closeRealtime()
      .then(() => new Promise((resolve) => server.close(() => resolve())))
      .finally(async () => {
        await disconnectDB();
        process.exit(0);
      });
    // Force exit if connections hang.
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

process.on('unhandledRejection', (reason) => {
  logger.fatal({ err: reason }, 'Unhandled promise rejection');
  process.exit(1);
});

start().catch((err) => {
  logger.fatal({ err }, 'Failed to start server');
  process.exit(1);
});

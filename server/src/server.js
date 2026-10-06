import mongoose from 'mongoose';
import pino from 'pino';
import { env } from './config/env.js';
import { connectDatabase } from './config/database.js';
import { createApp } from './app.js';

const logger = pino();
try {
  await connectDatabase();
  const app = createApp();
  const server = app.listen(env.PORT, () => logger.info({ port: env.PORT, environment: env.NODE_ENV }, 'Hirelane API listening'));
  server.requestTimeout = 65000;
  server.headersTimeout = 15000;
  let stopping = false;
  const shutdown = async (signal) => {
    if (stopping) return;
    stopping = true;
    logger.info({ signal }, 'Closing HTTP server and database connection');
    const timeout = setTimeout(() => process.exit(1), 10000).unref();
    server.close(async () => { await mongoose.disconnect(); clearTimeout(timeout); process.exit(0); });
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
  server.on('error', error => { logger.error({ errorType: error.code }, 'HTTP server could not start'); process.exit(1); });
} catch (error) {
  logger.error({ errorType: error.name }, 'Startup failed. Check environment configuration and database access.');
  await mongoose.disconnect();
  process.exit(1);
}

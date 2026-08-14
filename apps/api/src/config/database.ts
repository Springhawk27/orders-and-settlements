import mongoose from 'mongoose';
import logger from '../shared/logger.js';
import config from './index.js';

type ConnectionCache = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

/**
 * A serverless function is frozen between invocations rather than torn down, so
 * the connection is cached on globalThis and reused. Without this, every cold
 * request opens a new pool and the cluster runs out of connections under load.
 */
const globalCache = globalThis as typeof globalThis & { mongooseCache?: ConnectionCache };

const cache: ConnectionCache = (globalCache.mongooseCache ??= { conn: null, promise: null });

export const connectDatabase = async (): Promise<typeof mongoose> => {
  if (cache.conn) {
    return cache.conn;
  }

  cache.promise ??= mongoose
    .connect(config.databaseUrl, {
      serverSelectionTimeoutMS: 10_000,
      maxPoolSize: 10,
    })
    .then((instance) => {
      logger.info('database connected');
      return instance;
    })
    .catch((error: unknown) => {
      // Clear the cached promise so the next request retries instead of
      // rejecting forever with the first failure.
      cache.promise = null;
      throw error;
    });

  cache.conn = await cache.promise;

  return cache.conn;
};

export const disconnectDatabase = async (): Promise<void> => {
  if (!cache.conn) {
    return;
  }

  await mongoose.disconnect();
  cache.conn = null;
  cache.promise = null;
};

import mongoose from 'mongoose';
import { afterAll, afterEach } from 'vitest';
import { disconnectDatabase } from '../src/config/database';

// Every test starts from an empty database, so ordering between them never matters.
afterEach(async () => {
  const { collections } = mongoose.connection;

  await Promise.all(Object.values(collections).map((collection) => collection.deleteMany({})));
});

afterAll(async () => {
  await disconnectDatabase();
});

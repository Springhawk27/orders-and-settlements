import { MongoMemoryReplSet } from 'mongodb-memory-server';

let replSet: MongoMemoryReplSet | undefined;

/**
 * A replica set rather than a standalone server: payment writes run inside a
 * transaction, and MongoDB only offers those on a replica set.
 */
export const setup = async (): Promise<void> => {
  replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1 },
    instanceOpts: [{ port: 27018 }],
  });
};

export const teardown = async (): Promise<void> => {
  await replSet?.stop();
};

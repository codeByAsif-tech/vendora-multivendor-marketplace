import { MongoMemoryReplSet } from 'mongodb-memory-server';

// Replica set (not a standalone server) so later phases can test MongoDB transactions.
let replSet;

export async function setup(ctx) {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  ctx.provide('mongoUri', replSet.getUri('marketplace_test'));
}

export async function teardown() {
  await replSet?.stop();
}

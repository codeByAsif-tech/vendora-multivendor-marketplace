import mongoose from 'mongoose';

export async function connectTestDB() {
  // MONGODB_URI is set by tests/setup/globalMongo.js
  await mongoose.connect(process.env.MONGODB_URI);
  await Promise.all(Object.values(mongoose.models).map((model) => model.init()));
}

export async function clearTestDB() {
  const collections = await mongoose.connection.db.collections();
  await Promise.all(collections.map((collection) => collection.deleteMany({})));
}

export async function disconnectTestDB() {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
}

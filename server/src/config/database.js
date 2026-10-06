import mongoose from 'mongoose';
import { env } from './env.js';

// Queries use explicitly constructed operators and validated primitives.
mongoose.set('strictQuery', true);

export async function connectDatabase() {
  await mongoose.connect(env.MONGODB_URI, {
    serverSelectionTimeoutMS: 10000,
    maxPoolSize: 20,
    autoIndex: env.NODE_ENV !== 'production',
  });
}

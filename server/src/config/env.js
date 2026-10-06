import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

dotenv.config({ path: fileURLToPath(new URL('../../.env', import.meta.url)), quiet: true });

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(5000),
  MONGODB_URI: z.string().regex(/^mongodb(?:\+srv)?:\/\//, 'A MongoDB connection URI is required'),
  CLIENT_URL: z.string().url().default('http://localhost:5173'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must contain at least 32 characters'),
  TRUST_PROXY: z.coerce.number().int().min(0).max(5).default(0),
  CLOUDINARY_CLOUD_NAME: z.string().default(''),
  CLOUDINARY_API_KEY: z.string().default(''),
  CLOUDINARY_API_SECRET: z.string().default(''),
  GEMINI_API_KEY: z.string().default(''),
  GEMINI_MODEL: z.string().regex(/^[a-zA-Z0-9._-]+$/).default('gemini-2.5-flash'),
});

export function readEnvironment(source = process.env) {
  const result = schema.safeParse(source);
  if (!result.success) throw new Error(`Invalid configuration: ${result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ')}`);
  const config = result.data;
  const origin = new URL(config.CLIENT_URL);
  if (origin.origin !== config.CLIENT_URL) throw new Error('CLIENT_URL must be an exact origin without a path or trailing slash');
  if (config.NODE_ENV === 'production') {
    if (origin.protocol !== 'https:' && !['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname)) throw new Error('Production CLIENT_URL must use HTTPS');
    if (/replace|example|change|demo|test/i.test(config.JWT_SECRET)) throw new Error('Set an unpredictable production JWT_SECRET');
  }
  return config;
}

export const env = readEnvironment();

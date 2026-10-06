import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import pinoHttp from 'pino-http';
import mongoose from 'mongoose';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { env } from './config/env.js';
import { optionalAuth } from './middleware/auth.js';
import { requireTrustedOrigin, apiLimiter } from './middleware/security.js';
import { errorHandler } from './middleware/errorHandler.js';
import { router } from './routes/index.js';
import { AppError } from './utils/errors.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', env.TRUST_PROXY);
  app.use(helmet({
    contentSecurityPolicy: { directives: { defaultSrc: ["'self'"], scriptSrc: ["'self'"], styleSrc: ["'self'", "'unsafe-inline'"], imgSrc: ["'self'", 'data:', 'https://res.cloudinary.com'], connectSrc: ["'self'"], fontSrc: ["'self'", 'data:'], objectSrc: ["'none'"], frameAncestors: ["'none'"] } },
    crossOriginResourcePolicy: { policy: 'same-site' },
    ...(env.NODE_ENV !== 'production' ? { strictTransportSecurity: false } : {}),
  }));
  app.use(pinoHttp({
    enabled: env.NODE_ENV !== 'test',
    genReqId: () => randomUUID(),
    serializers: {
      req: req => ({ id: req.id, method: req.method, path: req.url?.split('?')[0] }),
      res: res => ({ statusCode: res.statusCode }),
    },
    customErrorObject: () => ({ message: 'Request failed' }),
  }));
  app.use(cors({ origin: env.CLIENT_URL, credentials: true, methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'] }));
  app.use('/api', requireTrustedOrigin, apiLimiter);
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());
  app.get('/api/health', (req, res) => {
    const ready = mongoose.connection.readyState === 1;
    res.status(ready ? 200 : 503).json({ data: { status: ready ? 'ok' : 'unavailable', database: ready ? 'connected' : 'disconnected' } });
  });
  app.use('/api', (req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); }, optionalAuth, router);
  app.use('/api', (req, res, next) => next(new AppError(404, 'API endpoint not found')));
  if (env.NODE_ENV === 'production') {
    const dist = fileURLToPath(new URL('../../client/dist/', import.meta.url));
    if (existsSync(path.join(dist, 'index.html'))) {
      app.use(express.static(dist, { index: false, maxAge: '1h' }));
      app.get('/{*path}', (req, res) => { res.setHeader('Cache-Control', 'no-cache'); res.sendFile(path.join(dist, 'index.html')); });
    }
  }
  app.use((req, res, next) => next(new AppError(404, 'Resource not found')));
  app.use(errorHandler);
  return app;
}

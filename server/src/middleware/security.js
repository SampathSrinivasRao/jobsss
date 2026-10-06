import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';
import { AppError } from '../utils/errors.js';

// SameSite cookies are defense in depth. Every state-changing API request must
// also carry the exact configured frontend Origin, including login and upload.
export function requireTrustedOrigin(req, res, next) {
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.get('origin') !== env.CLIENT_URL) {
    return next(new AppError(403, 'Request origin is not allowed'));
  }
  next();
}
const options = { standardHeaders: 'draft-8', legacyHeaders: false, message: { message: 'Too many requests. Please try again shortly.' } };
export const apiLimiter = rateLimit({ ...options, windowMs: 15 * 60 * 1000, limit: 900 });
export const authLimiter = rateLimit({ ...options, windowMs: 15 * 60 * 1000, limit: 20, skipSuccessfulRequests: true });
export const uploadLimiter = rateLimit({ ...options, windowMs: 15 * 60 * 1000, limit: 15 });
export const aiLimiter = rateLimit({ ...options, windowMs: 60 * 60 * 1000, limit: 20, keyGenerator: req => String(req.user._id) });

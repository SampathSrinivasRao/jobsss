import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { User } from '../models/User.js';
import { Session } from '../models/Session.js';
import { AppError } from '../utils/errors.js';

export const cookieName = env.NODE_ENV === 'production' ? '__Host-hirelane' : 'hirelane_session';
export const cookieOptions = { httpOnly: true, secure: env.NODE_ENV === 'production', sameSite: 'lax', path: '/' };
export const SESSION_MS = 24 * 60 * 60 * 1000;

export async function optionalAuth(req, res, next) {
  const token = req.cookies[cookieName];
  if (!token) return next();
  let payload;
  try {
    payload = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'], issuer: 'hirelane-api', audience: 'hirelane-web' });
  } catch {
    res.clearCookie(cookieName, cookieOptions);
    return next();
  }
  const session = await Session.findOne({ tokenId: payload.jti, user: payload.sub, expiresAt: { $gt: new Date() } });
  if (!session) {
    res.clearCookie(cookieName, cookieOptions);
    return next();
  }
  const user = await User.findById(payload.sub);
  if (user) { req.user = user; req.session = session; }
  next();
}
export function requireAuth(req, res, next) {
  if (!req.user) return next(new AppError(401, 'Please sign in to continue'));
  next();
}
export function requireRole(role) {
  return (req, res, next) => {
    if (!req.user) return next(new AppError(401, 'Please sign in to continue'));
    if (req.user.role !== role) return next(new AppError(403, 'Your account cannot perform this action'));
    next();
  };
}

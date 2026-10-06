import { randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { env } from '../config/env.js';
import { User } from '../models/User.js';
import { Session } from '../models/Session.js';
import { cookieName, cookieOptions, SESSION_MS } from '../middleware/auth.js';
import { AppError, data } from '../utils/errors.js';

async function createSession(res, user) {
  const tokenId = randomUUID();
  await Session.create({ user: user._id, tokenId, expiresAt: new Date(Date.now() + SESSION_MS) });
  const token = jwt.sign({}, env.JWT_SECRET, { subject: String(user._id), jwtid: tokenId, algorithm: 'HS256', expiresIn: '24h', issuer: 'hirelane-api', audience: 'hirelane-web' });
  res.cookie(cookieName, token, { ...cookieOptions, maxAge: SESSION_MS });
}
// Cost-matched comparison prevents the easiest email-existence timing difference.
const dummyHash = await bcrypt.hash(randomUUID(), 12);
export async function register(req, res) {
  const user = await User.create(req.validatedBody);
  await createSession(res, user);
  data(res, user, 201);
}
export async function login(req, res) {
  const { email, password, role } = req.validatedBody;
  const user = await User.findOne({ email }).select('+password');
  const valid = await bcrypt.compare(password, user?.password || dummyHash);
  if (!user || !valid || user.role !== role) throw new AppError(401, 'Email, password, or account type is incorrect');
  if (req.session) await Session.deleteOne({ _id: req.session._id });
  await createSession(res, user);
  data(res, user);
}
export async function logout(req, res) {
  if (req.session) await Session.deleteOne({ _id: req.session._id });
  res.clearCookie(cookieName, cookieOptions);
  data(res, { message: 'Signed out' });
}
export function me(req, res) { data(res, req.user); }

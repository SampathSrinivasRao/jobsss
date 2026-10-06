import mongoose from 'mongoose';
import { AppError } from '../utils/errors.js';

export function validate(schema, target = 'body') {
  return (req, res, next) => {
    const result = schema.safeParse(req[target]);
    if (!result.success) return next(new AppError(400, 'Please check the submitted fields', result.error.flatten()));
    req[target === 'query' ? 'validatedQuery' : 'validatedBody'] = result.data;
    next();
  };
}
export function objectId(req, res, next, value) {
  if (!mongoose.isObjectIdOrHexString(value)) return next(new AppError(400, 'Invalid resource ID'));
  next();
}

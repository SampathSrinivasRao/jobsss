export class AppError extends Error {
  constructor(status, message, errors) {
    super(message);
    this.status = status;
    this.errors = errors;
  }
}

export const notFound = (message = 'Resource not found') => new AppError(404, message);
export const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export const data = (res, value, status = 200) => res.status(status).json({ data: value });

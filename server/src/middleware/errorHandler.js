import multer from 'multer';

export function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);
  let status = error.status || 500;
  let message = error.message || 'Something went wrong';
  let errors = error.errors;
  if (error.code === 11000) {
    status = 409;
    message = error.keyPattern?.email ? 'An account with that email already exists' : 'This record already exists';
    errors = undefined;
  } else if (error.name === 'VersionError') {
    status = 409; message = 'This record was changed by another request. Refresh and try again.'; errors = undefined;
  } else if (error instanceof multer.MulterError) {
    status = 400;
    message = error.code === 'LIMIT_FILE_SIZE' ? 'File exceeds the 5 MB upload limit' : 'Upload one file using the file field';
  } else if (error.name === 'ValidationError' || error.name === 'CastError') {
    status = 400; message = 'Please check the submitted fields'; errors = undefined;
  } else if (error.type === 'entity.parse.failed') {
    status = 400; message = 'Request contains invalid JSON'; errors = undefined;
  } else if (error.type === 'entity.too.large') {
    status = 413; message = 'Request body is too large'; errors = undefined;
  }
  if (status >= 500) {
    // Never log raw DB/cloud-provider errors: their messages can contain credentials.
    req.log?.error({ errorType: error.name, status }, 'Request failed');
    if (status === 500) { message = 'An unexpected server error occurred'; errors = undefined; }
  }
  res.status(status).json({ message, ...(errors ? { errors } : {}) });
}

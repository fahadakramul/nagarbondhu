import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { CONFIG } from '../config';

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) {
  console.error(`[Error] ${req.method} ${req.url}:`, err);

  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: err.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      })),
    });
  }

  let statusCode = err.statusCode || 500;
  if (!err.statusCode) {
    if (err.message?.includes('not found')) {
      statusCode = 404;
    } else if (
      err.message?.includes('Invalid') ||
      err.message?.includes('Authentication') ||
      err.message?.includes('password')
    ) {
      statusCode = 401;
    }
  }
  const message = err.message || 'Internal server error';

  res.status(statusCode).json({
    success: false,
    error: message,
    ...(CONFIG.NODE_ENV === 'development' ? { stack: err.stack } : {}),
  });
}

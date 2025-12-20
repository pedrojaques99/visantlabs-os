import { Request, Response, NextFunction } from 'express';

export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Only log full stack in development
  if (process.env.NODE_ENV === 'development') {
    console.error('❌ Error:', {
      message: err.message,
      stack: err.stack,
      type: err.type,
      code: err.code,
      statusCode: err.statusCode,
      path: req.path,
      method: req.method,
    });
  } else {
    // In production, log less verbose
    console.error('❌ Error:', {
      message: err.message,
      type: err.type,
      code: err.code,
      statusCode: err.statusCode,
      path: req.path,
      method: req.method,
    });
  }
  
  // If it's a Stripe error, return more details
  if (err.type && err.type.startsWith('Stripe')) {
    return res.status(err.statusCode || 500).json({
      error: 'Stripe error',
      message: err.message,
      type: err.type,
      code: err.code,
    });
  }
  
  // If it's already a response error, use its status
  const statusCode = err.statusCode || err.status || 500;
  
  // Check if error already has details (e.g., from R2 upload)
  const errorResponse: any = {
    error: err.error || 'Internal server error',
    message: err.message || undefined,
  };
  
  // Include details if available
  if (err.details) {
    errorResponse.details = err.details;
  }
  
  // In development, include more debug info
  if (process.env.NODE_ENV === 'development') {
    if (err.type) errorResponse.type = err.type;
    if (err.code) errorResponse.code = err.code;
    if (err.stack) errorResponse.stack = err.stack;
  }
  
  res.status(statusCode).json(errorResponse);
};


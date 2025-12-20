import { Request, Response, NextFunction } from 'express';

// hCaptcha validation
async function validateCaptcha(token: string): Promise<boolean> {
  const secretKey = process.env.HCAPTCHA_SECRET_KEY;

  // Skip validation if CAPTCHA is disabled
  if (process.env.CAPTCHA_ENABLED === 'false' || !secretKey) {
    return true;
  }

  // Skip validation in development if explicitly disabled
  if (process.env.NODE_ENV === 'development' && process.env.CAPTCHA_ENABLED === 'false') {
    return true;
  }

  if (!token) {
    return false;
  }

  try {
    const response = await fetch('https://hcaptcha.com/siteverify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `secret=${encodeURIComponent(secretKey)}&response=${encodeURIComponent(token)}`,
    });

    const data = await response.json();
    return data.success === true;
  } catch (error) {
    console.error('CAPTCHA validation error:', error);
    // On error, allow request through but log it
    // In production, you might want to be more strict
    return process.env.NODE_ENV === 'development';
  }
}

export async function captchaMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Skip if CAPTCHA is disabled or secret key is not configured
  if (process.env.CAPTCHA_ENABLED === 'false' || !process.env.HCAPTCHA_SECRET_KEY) {
    return next();
  }

  const captchaToken = req.body.captchaToken || req.headers['x-captcha-token'];

  if (!captchaToken) {
    return res.status(400).json({
      error: 'CAPTCHA verification required',
      message: 'Please complete the CAPTCHA verification.',
    });
  }

  const isValid = await validateCaptcha(captchaToken);

  if (!isValid) {
    return res.status(400).json({
      error: 'Invalid CAPTCHA',
      message: 'CAPTCHA verification failed. Please try again.',
    });
  }

  next();
}


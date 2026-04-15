import jwt from 'jsonwebtoken';
import { TEST_JWT_SECRET } from './env.js';

export interface TokenPayload {
  userId: string;
  email: string;
}

export function signTestToken(payload: TokenPayload, expiresIn: string | number = '1h'): string {
  return jwt.sign(payload, TEST_JWT_SECRET, { expiresIn } as jwt.SignOptions);
}

export function bearer(token: string): string {
  return `Bearer ${token}`;
}

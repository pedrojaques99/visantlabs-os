/**
 * JWT Secret utility
 * 
 * SECURITY: This module ensures JWT_SECRET is properly configured.
 * In production, the server will fail to start if JWT_SECRET is not set.
 * In development, it will warn but allow startup with a default value.
 */

const isProduction = process.env.NODE_ENV === 'production';
const envSecret = process.env.JWT_SECRET;

// Validate JWT_SECRET on module load
if (!envSecret || envSecret === 'your-secret-key-change-in-production') {
  if (isProduction) {
    console.error('❌ CRITICAL: JWT_SECRET is not configured in production!');
    console.error('   Please set a secure JWT_SECRET environment variable.');
    console.error('   Generate one with: npm run generate-jwt-secret');
    throw new Error('JWT_SECRET must be configured in production');
  } else {
    console.warn('⚠️  JWT_SECRET is not configured. Using default development secret.');
    console.warn('   Generate a secure secret with: npm run generate-jwt-secret');
  }
}

/**
 * Get the JWT secret for signing and verifying tokens.
 * In development, returns a default value if not set.
 * In production, throws an error if not set (checked at module load).
 */
export const getJwtSecret = (): string => {
  if (envSecret && envSecret !== 'your-secret-key-change-in-production') {
    return envSecret;
  }
  // Only reached in development
  return 'development-secret-do-not-use-in-production';
};

export const JWT_SECRET = getJwtSecret();



/**
 * Zod validation schemas for backend API endpoints
 *
 * These schemas replace manual validation with type-safe,
 * composable Zod schemas. Use z.safeParse() in route handlers
 * for automatic validation with structured error messages.
 */

import { z } from 'zod';

// ── Primitive schemas ──

/** ReDoS-resistant email schema with RFC 5321 length limits */
export const emailSchema = z
  .string()
  .min(1, 'Email is required')
  .max(254, 'Email too long')
  .email('Invalid email format')
  .transform((v) => v.toLowerCase());

/** MongoDB ObjectId (24 hex chars) */
export const objectIdSchema = z.string().regex(/^[a-fA-F0-9]{24}$/, 'Invalid ID format');

/** Safe string ID (alphanumeric + hyphens/underscores, max 100 chars) */
export const safeIdSchema = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[a-zA-Z0-9_-]+$/, 'ID contains invalid characters');

/** Password with minimum length */
export const passwordSchema = z
  .string()
  .min(6, 'Password must be at least 6 characters')
  .max(128, 'Password too long');

/** Positive integer with bounds */
export const positiveIntSchema = z.coerce.number().int().min(1);

/** Aspect ratio whitelist */
export const VALID_ASPECT_RATIOS = [
  '9:16',
  '21:9',
  '2:3',
  '3:2',
  '3:4',
  '4:3',
  '4:5',
  '5:4',
  '16:9',
  '1:1',
] as const;
export const aspectRatioSchema = z.enum(VALID_ASPECT_RATIOS);

/** Bounded string (prevents value injection in $set operations) */
export const boundedStringSchema = (maxLen = 50000) => z.string().max(maxLen);

// ── Endpoint schemas ──

export const signupSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: z.string().max(100).optional(),
  referralCode: z.string().max(20).optional(),
});

export const signinSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  password: passwordSchema,
});

export const forgotPasswordSchema = z.object({
  email: emailSchema,
  // Quem pediu: sem valor, o link cai no visantlabs.com; 'club' manda pra
  // app.visant.club/definir-senha. Enum fechado, nunca URL livre (open redirect).
  app: z.enum(['club']).optional(),
});

/** Pedido de link mágico. Mesmo par do forgot: e-mail e, opcional, quem pediu. */
export const magicLinkRequestSchema = z.object({
  email: emailSchema,
  app: z.enum(['club']).optional(),
});

/** Troca do link mágico por sessão. O token é base64url de 32 bytes (43 chars). */
export const magicLinkVerifySchema = z.object({
  token: z
    .string()
    .min(20, 'Token is required')
    .max(200)
    .regex(/^[A-Za-z0-9_-]+$/, 'Invalid token'),
});

export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  skip: z.coerce.number().int().min(0).default(0),
});

export const brandingFeedbackSchema = z.object({
  prompt: z.string().min(1, 'Prompt is required'),
  step: z.coerce.number().int(),
  output: z.any(),
  rating: z.number().int().optional(),
});

export const mockupFeedbackSchema = z.object({
  prompt: z.string().min(1, 'Prompt is required'),
  imageUrl: z.string().url('Invalid image URL'),
  designType: z.string().optional(),
  tags: z.array(z.string()).optional(),
  brandingTags: z.array(z.string()).optional(),
  aspectRatio: z.string().optional(),
  rating: z.number().int().optional(),
});

export const updateProfileSchema = z.object({
  name: z.string().max(100).optional(),
  email: emailSchema.optional(),
  picture: z.string().url().optional(),
});

// ── Helpers ──

/**
 * Extract a user-friendly error message from a ZodError
 */
export function formatZodError(error: z.ZodError): string {
  return error.issues.map((i) => i.message).join(', ');
}

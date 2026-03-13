import { z } from 'zod';

export const colorSchema = z.object({
  name: z.string().min(1),
  hex: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  role: z.string().optional(),
});

export const typographySchema = z.object({
  family: z.string().min(1),
  role: z.string(),
  style: z.string().optional(),
  size: z.number().optional(),
});

export const identitySchema = z.object({
  name: z.string().min(1, 'Brand name required'),
  tagline: z.string().optional(),
  description: z.string().optional(),
});

export const editorialSchema = z.object({
  voice: z.string().optional(),
  dos: z.array(z.string()).optional(),
  accessibility: z.string().optional(),
});

export const tagsSchema = z.record(z.string(), z.array(z.string()));

export const tokensSchema = z.object({
  spacing: z.record(z.string(), z.number()).optional(),
  radius: z.record(z.string(), z.number()).optional(),
});

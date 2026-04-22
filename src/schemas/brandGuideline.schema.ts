import { z } from 'zod';

const cmykSchema = z.object({
  c: z.number().min(0).max(100),
  m: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
  k: z.number().min(0).max(100),
});

export const colorSchema = z.object({
  name: z.string().min(1),
  hex: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  role: z.string().optional(),
  cmyk: cmykSchema.optional(),
});

export const typographySchema = z.object({
  family: z.string().min(1),
  role: z.string(),
  style: z.string().optional(),
  size: z.number().optional(),
  lineHeight: z.number().optional(),
  letterSpacing: z.string().optional(),
  weights: z.array(z.number()).optional(),
});

export const identitySchema = z.object({
  name: z.string().min(1, 'Brand name required'),
  website: z.string().optional(),
  portfolio: z.string().optional(),
  instagram: z.string().optional(),
  linkedin: z.string().optional(),
  x: z.string().optional(),
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

export const archetypeSchema = z.object({
  name: z.string().min(1),
  role: z.enum(['primary', 'secondary']).optional(),
  description: z.string(),
  image: z.string().optional(),
  examples: z.array(z.string()).optional(),
});

export const personaSchema = z.object({
  name: z.string().min(1),
  age: z.number().optional(),
  occupation: z.string().optional(),
  traits: z.array(z.string()).optional(),
  bio: z.string().optional(),
  desires: z.array(z.string()).optional(),
  painPoints: z.array(z.string()).optional(),
  image: z.string().optional(),
});

export const voiceValueSchema = z.object({
  title: z.string().min(1),
  description: z.string(),
  example: z.string(),
});

export const strategySchema = z.object({
  manifesto: z.string().optional(),
  positioning: z.array(z.string()).optional(),
  archetypes: z.array(archetypeSchema).optional(),
  personas: z.array(personaSchema).optional(),
  voiceValues: z.array(voiceValueSchema).optional(),
});

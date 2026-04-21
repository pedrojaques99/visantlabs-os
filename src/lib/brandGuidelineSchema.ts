/**
 * Shared Zod contract for BrandGuideline persistence.
 *
 * Prisma `BrandGuideline` model is the source of truth. This schema is the
 * wire contract used on both sides of the boundary:
 *
 *   webapp ──POST/PUT──▶ /api/brand-guidelines ──▶ prisma.brandGuideline
 *   plugin ──POST/PUT──▶ /api/brand-guidelines ──▶ prisma.brandGuideline
 *                ▲                                       │
 *                └─────── GET (validated) ◀──────────────┘
 *
 * Rules:
 *  - `.passthrough()` everywhere: never strip unknown fields (Prisma adds
 *    createdAt/updatedAt/userId/extraction/etc that clients shouldn't lose).
 *  - Every leaf `.optional()`: partial updates (PUT patches) are common.
 *  - Runtime-only coercion — does not replace TypeScript types in figma-types.ts.
 */

import { z } from 'zod';

// ── Atoms ──

export const BrandColorSchema = z.object({
  hex: z.string(),
  name: z.string().optional(),
  role: z.string().optional(),
  cmyk: z.object({ c: z.number(), m: z.number(), y: z.number(), k: z.number() }).optional()
}).passthrough();

export const BrandLogoSchema = z.object({
  id: z.string().optional(),
  url: z.string().optional(),
  variant: z.string().optional(),
  label: z.string().optional(),
  // Dual-source: either an uploaded media file (svg/png/pdf) or a linked Figma component.
  source: z.enum(['upload', 'figma']).optional(),
  thumbnailUrl: z.string().optional(),       // rendered preview for <img>
  format: z.string().optional(),             // svg | png | jpg | pdf
  figmaKey: z.string().optional(),           // published component key (stable across files)
  figmaNodeId: z.string().optional(),        // fallback for same-file references
  figmaFileKey: z.string().optional()
}).passthrough();

export const BrandTypographySchema = z.object({
  family: z.string().optional(),
  fontFamily: z.string().optional(),
  style: z.string().optional(),
  fontStyle: z.string().optional(),
  role: z.string().optional(),
  size: z.number().optional(),
  fontSize: z.number().optional(),
  weight: z.number().optional(),
  fontWeight: z.number().optional(),
  lineHeight: z.number().optional(),
  availableStyles: z.array(z.string()).optional()
}).passthrough();

export const BrandIdentitySchema = z.object({
  name: z.string().optional(),
  website: z.string().optional(),
  tagline: z.string().optional(),
  description: z.string().optional(),
  instagram: z.string().optional(),
  linkedin: z.string().optional(),
  portfolio: z.string().optional(),
  x: z.string().optional()
}).passthrough();

export const BrandMediaSchema = z.object({
  id: z.string().optional(),
  url: z.string(),
  type: z.string().optional(),
  label: z.string().optional()
}).passthrough();

export const BrandTokensSchema = z.object({
  spacing: z.record(z.string(), z.any()).optional(),
  radius: z.record(z.string(), z.any()).optional(),
  shadows: z.record(z.string(), z.any()).optional(),
  components: z.record(z.string(), z.any()).optional(),
  families: z.array(z.string()).optional(),
  fonts: z.array(z.any()).optional()
}).passthrough();

// ── Full guideline ──

export const BrandGuidelineSchema = z.object({
  id: z.string().optional(),
  _id: z.string().optional(),
  userId: z.string().optional(),

  identity: BrandIdentitySchema.optional().nullable(),
  logos: z.array(BrandLogoSchema).optional().nullable(),
  colors: z.array(BrandColorSchema).optional().nullable(),
  typography: z.array(BrandTypographySchema).optional().nullable(),
  media: z.array(BrandMediaSchema).optional().nullable(),
  tokens: BrandTokensSchema.optional().nullable(),
  tags: z.any().optional().nullable(),
  guidelines: z.any().optional().nullable(),
  strategy: z.any().optional().nullable(),
  extraction: z.any().optional().nullable(),

  createdAt: z.union([z.string(), z.date()]).optional().nullable(),
  updatedAt: z.union([z.string(), z.date()]).optional().nullable()
}).passthrough();

/** Partial patch for PUT /api/brand-guidelines/:id */
export const BrandGuidelinePatchSchema = BrandGuidelineSchema.partial();

/** GET list response */
export const BrandGuidelineListResponseSchema = z.object({
  guidelines: z.array(BrandGuidelineSchema)
}).passthrough();

/** GET/POST/PUT single-item response */
export const BrandGuidelineItemResponseSchema = z.object({
  guideline: BrandGuidelineSchema
}).passthrough();

// ── Inferred types (export for consumers) ──

export type BrandGuidelineDto = z.infer<typeof BrandGuidelineSchema>;
export type BrandGuidelinePatchDto = z.infer<typeof BrandGuidelinePatchSchema>;

// ── Safe-parse helpers ──

/**
 * Normalize any unknown shape into BrandGuidelineDto, or return null if
 * fundamentally invalid. Unknown fields are preserved (passthrough).
 */
export function parseBrandGuideline(input: unknown): BrandGuidelineDto | null {
  const result = BrandGuidelineSchema.safeParse(input);
  return result.success ? result.data : null;
}

export function parseBrandGuidelineList(input: unknown): BrandGuidelineDto[] {
  if (Array.isArray(input)) {
    return input
      .map((g) => BrandGuidelineSchema.safeParse(g))
      .filter((r): r is z.ZodSafeParseSuccess<BrandGuidelineDto> => r.success)
      .map((r) => r.data);
  }
  const wrapped = BrandGuidelineListResponseSchema.safeParse(input);
  if (wrapped.success) return wrapped.data.guidelines;
  return [];
}

/** Unwrap `{ guideline }` envelope or accept raw guideline. */
export function unwrapGuidelineResponse(input: unknown): BrandGuidelineDto | null {
  const wrapped = BrandGuidelineItemResponseSchema.safeParse(input);
  if (wrapped.success) return wrapped.data.guideline;
  return parseBrandGuideline(input);
}

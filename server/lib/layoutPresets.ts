// server/lib/layoutPresets.ts
// Built-in layout recipes for common content types

import type { FigmaOperation, FigmaPaint } from '../../src/lib/figma-types.js';
import type { TokenRegistry } from './tokenRegistry.js';
import { getFormatPreset } from './formatPresets.js';

// ── Defaults ──

const DEFAULT_FONT = 'Inter';
const DEFAULT_PRIMARY = { r: 0.051, g: 0.6, b: 1 };     // #0D99FF
const DEFAULT_SURFACE = { r: 1, g: 1, b: 1 };             // #FFFFFF
const DEFAULT_TEXT = { r: 0.067, g: 0.067, b: 0.067 };   // #111111
const DEFAULT_MUTED = { r: 0.45, g: 0.45, b: 0.45 };     // #737373

// ── Content shape passed to generate() ──

export interface LayoutContent {
  title?: string;
  subtitle?: string;
  body?: string;
  cta?: string;
  discount?: string;
  badge?: string;
  image?: string;
}

// ── Core interface ──

export interface LayoutPreset {
  name: string;
  description: string;
  intents: string[];
  generate(
    content: LayoutContent,
    format: string | undefined,
    tokens: TokenRegistry
  ): FigmaOperation[];
}

// ── Token helpers ──

/**
 * Get a solid color fill from the token registry by color name.
 * Falls back to `fallback` RGB when the token is not found.
 */
export function getColorFill(
  tokens: TokenRegistry,
  name: string,
  fallback: { r: number; g: number; b: number }
): FigmaPaint {
  const token = tokens.colors.get(name);
  const rgb = token?.rgb ?? fallback;
  return { type: 'SOLID', color: rgb };
}

/**
 * Get font family from the token registry by typography role.
 * Falls back to `fallback` when the token is not found.
 */
export function getTypography(
  tokens: TokenRegistry,
  role: string,
  fallback: string
): string {
  const token = tokens.typography.get(role);
  if (!token) return fallback;
  const val = token.value as { family?: string } | undefined;
  return val?.family ?? fallback;
}

// ── Dimension helper ──

/**
 * Returns canvas dimensions for a given format string.
 * Falls back to 1080×1080 (Instagram feed) when format is unknown.
 */
export function getFormatDimensions(format?: string): { width: number; height: number } {
  if (!format) return { width: 1080, height: 1080 };
  const preset = getFormatPreset(format);
  return preset ?? { width: 1080, height: 1080 };
}

// ── Presets ──

/**
 * Promotional post — badge · title · subtitle · CTA button.
 * Suited for discount announcements, limited offers, product launches.
 */
export const promotionalPost: LayoutPreset = {
  name: 'Promotional Post',
  description: 'Bold promotional layout with badge, headline, subtitle, and CTA button',
  intents: ['promotional', 'promo', 'offer', 'discount', 'sale', 'launch', 'announcement'],

  generate(content, format, tokens): FigmaOperation[] {
    const { width, height } = getFormatDimensions(format);
    const font = getTypography(tokens, 'heading', DEFAULT_FONT);
    const bodyFont = getTypography(tokens, 'body', DEFAULT_FONT);

    const bgFill = getColorFill(tokens, 'primary', DEFAULT_PRIMARY);
    const surfaceFill: FigmaPaint = { type: 'SOLID', color: DEFAULT_SURFACE };
    const whiteFill: FigmaPaint = { type: 'SOLID', color: DEFAULT_SURFACE };
    const darkFill: FigmaPaint = { type: 'SOLID', color: DEFAULT_TEXT };

    const ops: FigmaOperation[] = [];

    // Root canvas frame
    ops.push({
      type: 'CREATE_FRAME',
      ref: 'root',
      props: {
        name: 'Promotional Post',
        width,
        height,
        fills: [bgFill],
        layoutMode: 'VERTICAL',
        primaryAxisSizingMode: 'FIXED',
        counterAxisSizingMode: 'FIXED',
        primaryAxisAlignItems: 'CENTER',
        counterAxisAlignItems: 'CENTER',
        itemSpacing: 24,
        paddingTop: 64,
        paddingRight: 64,
        paddingBottom: 64,
        paddingLeft: 64,
        clipsContent: true,
      },
    });

    // Badge pill
    ops.push({
      type: 'CREATE_FRAME',
      ref: 'badge',
      parentRef: 'root',
      props: {
        name: 'Badge',
        width: 160,
        height: 36,
        fills: [{ type: 'SOLID', color: DEFAULT_SURFACE, opacity: 0.2 }],
        cornerRadius: 18,
        layoutMode: 'HORIZONTAL',
        primaryAxisSizingMode: 'AUTO',
        counterAxisSizingMode: 'AUTO',
        primaryAxisAlignItems: 'CENTER',
        counterAxisAlignItems: 'CENTER',
        paddingTop: 6,
        paddingRight: 16,
        paddingBottom: 6,
        paddingLeft: 16,
      },
    });

    ops.push({
      type: 'CREATE_TEXT',
      parentRef: 'badge',
      props: {
        name: 'Badge Label',
        content: content.badge ?? content.discount ?? 'LIMITED OFFER',
        fontFamily: bodyFont,
        fontStyle: 'SemiBold',
        fontSize: 13,
        fills: [whiteFill],
        textCase: 'UPPER',
        letterSpacing: { value: 1.5, unit: 'PIXELS' },
        textAutoResize: 'WIDTH_AND_HEIGHT',
        layoutSizingHorizontal: 'HUG',
        layoutSizingVertical: 'HUG',
      },
    });

    // Title
    ops.push({
      type: 'CREATE_TEXT',
      ref: 'title',
      parentRef: 'root',
      props: {
        name: 'Title',
        content: content.title ?? 'Big Headline Here',
        fontFamily: font,
        fontStyle: 'Bold',
        fontSize: Math.round(width * 0.065),
        fills: [whiteFill],
        textAlignHorizontal: 'CENTER',
        textAutoResize: 'HEIGHT',
        layoutSizingHorizontal: 'FILL',
        layoutSizingVertical: 'HUG',
        lineHeight: { value: 110, unit: 'PERCENT' },
      },
    });

    // Subtitle
    if (content.subtitle) {
      ops.push({
        type: 'CREATE_TEXT',
        ref: 'subtitle',
        parentRef: 'root',
        props: {
          name: 'Subtitle',
          content: content.subtitle,
          fontFamily: bodyFont,
          fontStyle: 'Regular',
          fontSize: Math.round(width * 0.028),
          fills: [{ type: 'SOLID', color: DEFAULT_SURFACE, opacity: 0.8 }],
          textAlignHorizontal: 'CENTER',
          textAutoResize: 'HEIGHT',
          layoutSizingHorizontal: 'FILL',
          layoutSizingVertical: 'HUG',
          lineHeight: { value: 150, unit: 'PERCENT' },
        },
      });
    }

    // CTA Button
    ops.push({
      type: 'CREATE_FRAME',
      ref: 'cta',
      parentRef: 'root',
      props: {
        name: 'CTA Button',
        width: 240,
        height: 56,
        fills: [surfaceFill],
        cornerRadius: 28,
        layoutMode: 'HORIZONTAL',
        primaryAxisSizingMode: 'AUTO',
        counterAxisSizingMode: 'AUTO',
        primaryAxisAlignItems: 'CENTER',
        counterAxisAlignItems: 'CENTER',
        paddingTop: 14,
        paddingRight: 32,
        paddingBottom: 14,
        paddingLeft: 32,
      },
    });

    ops.push({
      type: 'CREATE_TEXT',
      parentRef: 'cta',
      props: {
        name: 'CTA Label',
        content: content.cta ?? 'Get Started',
        fontFamily: bodyFont,
        fontStyle: 'SemiBold',
        fontSize: 18,
        fills: [darkFill],
        textAutoResize: 'WIDTH_AND_HEIGHT',
        layoutSizingHorizontal: 'HUG',
        layoutSizingVertical: 'HUG',
      },
    });

    return ops;
  },
};

/**
 * Informative post — image placeholder · title · body text.
 * Suited for educational, news, how-to, or announcement content.
 */
export const informativePost: LayoutPreset = {
  name: 'Informative Post',
  description: 'Clean informative layout with image placeholder, title, and body text',
  intents: ['informative', 'educational', 'news', 'howto', 'tip', 'article', 'fact'],

  generate(content, format, tokens): FigmaOperation[] {
    const { width, height } = getFormatDimensions(format);
    const font = getTypography(tokens, 'heading', DEFAULT_FONT);
    const bodyFont = getTypography(tokens, 'body', DEFAULT_FONT);

    const bgFill: FigmaPaint = { type: 'SOLID', color: DEFAULT_SURFACE };
    const accentFill = getColorFill(tokens, 'primary', DEFAULT_PRIMARY);
    const textFill: FigmaPaint = { type: 'SOLID', color: DEFAULT_TEXT };
    const mutedFill: FigmaPaint = { type: 'SOLID', color: DEFAULT_MUTED };
    const imagePlaceholderFill: FigmaPaint = { type: 'SOLID', color: { r: 0.9, g: 0.92, b: 0.95 } };

    const ops: FigmaOperation[] = [];

    // Root frame — vertical stack
    ops.push({
      type: 'CREATE_FRAME',
      ref: 'root',
      props: {
        name: 'Informative Post',
        width,
        height,
        fills: [bgFill],
        layoutMode: 'VERTICAL',
        primaryAxisSizingMode: 'FIXED',
        counterAxisSizingMode: 'FIXED',
        primaryAxisAlignItems: 'MIN',
        counterAxisAlignItems: 'MIN',
        itemSpacing: 0,
        clipsContent: true,
      },
    });

    // Image placeholder — top half
    const imageHeight = Math.round(height * 0.45);
    ops.push({
      type: 'CREATE_RECTANGLE',
      ref: 'image',
      parentRef: 'root',
      props: {
        name: 'Image Placeholder',
        width,
        height: imageHeight,
        fills: [imagePlaceholderFill],
        layoutSizingHorizontal: 'FILL',
      },
    });

    // Content area — bottom half
    ops.push({
      type: 'CREATE_FRAME',
      ref: 'content',
      parentRef: 'root',
      props: {
        name: 'Content',
        width,
        height: height - imageHeight,
        fills: [bgFill],
        layoutMode: 'VERTICAL',
        primaryAxisSizingMode: 'FIXED',
        counterAxisSizingMode: 'FIXED',
        primaryAxisAlignItems: 'MIN',
        counterAxisAlignItems: 'MIN',
        itemSpacing: 16,
        paddingTop: 32,
        paddingRight: 48,
        paddingBottom: 32,
        paddingLeft: 48,
        layoutSizingHorizontal: 'FILL',
      },
    });

    // Accent line
    ops.push({
      type: 'CREATE_RECTANGLE',
      ref: 'accent',
      parentRef: 'content',
      props: {
        name: 'Accent',
        width: 48,
        height: 4,
        fills: [accentFill],
        cornerRadius: 2,
      },
    });

    // Title
    ops.push({
      type: 'CREATE_TEXT',
      ref: 'title',
      parentRef: 'content',
      props: {
        name: 'Title',
        content: content.title ?? 'Informative Headline',
        fontFamily: font,
        fontStyle: 'Bold',
        fontSize: Math.round(width * 0.042),
        fills: [textFill],
        textAutoResize: 'HEIGHT',
        layoutSizingHorizontal: 'FILL',
        layoutSizingVertical: 'HUG',
        lineHeight: { value: 120, unit: 'PERCENT' },
      },
    });

    // Body text
    ops.push({
      type: 'CREATE_TEXT',
      ref: 'body',
      parentRef: 'content',
      props: {
        name: 'Body',
        content: content.body ?? content.subtitle ?? 'Add your informative content here. Keep it concise and engaging.',
        fontFamily: bodyFont,
        fontStyle: 'Regular',
        fontSize: Math.round(width * 0.024),
        fills: [mutedFill],
        textAutoResize: 'HEIGHT',
        layoutSizingHorizontal: 'FILL',
        layoutSizingVertical: 'HUG',
        lineHeight: { value: 160, unit: 'PERCENT' },
      },
    });

    return ops;
  },
};

/**
 * Feature card — icon circle · title · description.
 * Suited for product features, service highlights, benefit cards.
 */
export const featureCard: LayoutPreset = {
  name: 'Feature Card',
  description: 'Compact feature card with icon circle, title, and description text',
  intents: ['feature', 'card', 'benefit', 'service', 'highlight', 'product'],

  generate(content, format, tokens): FigmaOperation[] {
    const { width, height } = getFormatDimensions(format);
    const font = getTypography(tokens, 'heading', DEFAULT_FONT);
    const bodyFont = getTypography(tokens, 'body', DEFAULT_FONT);

    const bgFill: FigmaPaint = { type: 'SOLID', color: DEFAULT_SURFACE };
    const iconBgFill = getColorFill(tokens, 'primary', DEFAULT_PRIMARY);
    const textFill: FigmaPaint = { type: 'SOLID', color: DEFAULT_TEXT };
    const mutedFill: FigmaPaint = { type: 'SOLID', color: DEFAULT_MUTED };
    const whiteFill: FigmaPaint = { type: 'SOLID', color: DEFAULT_SURFACE };

    const ops: FigmaOperation[] = [];

    // Root card frame
    ops.push({
      type: 'CREATE_FRAME',
      ref: 'root',
      props: {
        name: 'Feature Card',
        width,
        height,
        fills: [bgFill],
        cornerRadius: 16,
        layoutMode: 'VERTICAL',
        primaryAxisSizingMode: 'FIXED',
        counterAxisSizingMode: 'FIXED',
        primaryAxisAlignItems: 'CENTER',
        counterAxisAlignItems: 'CENTER',
        itemSpacing: 20,
        paddingTop: 48,
        paddingRight: 48,
        paddingBottom: 48,
        paddingLeft: 48,
        clipsContent: true,
      },
    });

    // Icon circle
    const iconSize = Math.round(Math.min(width, height) * 0.12);
    ops.push({
      type: 'CREATE_ELLIPSE',
      ref: 'icon-circle',
      parentRef: 'root',
      props: {
        name: 'Icon Circle',
        width: iconSize,
        height: iconSize,
        fills: [iconBgFill],
      },
    });

    // Icon label inside circle (centered text as icon stand-in)
    ops.push({
      type: 'CREATE_TEXT',
      ref: 'icon-label',
      parentRef: 'icon-circle',
      props: {
        name: 'Icon',
        content: '★',
        fontFamily: bodyFont,
        fontStyle: 'Regular',
        fontSize: Math.round(iconSize * 0.4),
        fills: [whiteFill],
        textAlignHorizontal: 'CENTER',
        textAlignVertical: 'CENTER',
        textAutoResize: 'NONE',
        layoutSizingHorizontal: 'FILL',
        layoutSizingVertical: 'FILL',
        x: 0,
        y: 0,
      },
    });

    // Title
    ops.push({
      type: 'CREATE_TEXT',
      ref: 'title',
      parentRef: 'root',
      props: {
        name: 'Title',
        content: content.title ?? 'Feature Title',
        fontFamily: font,
        fontStyle: 'SemiBold',
        fontSize: Math.round(width * 0.038),
        fills: [textFill],
        textAlignHorizontal: 'CENTER',
        textAutoResize: 'HEIGHT',
        layoutSizingHorizontal: 'FILL',
        layoutSizingVertical: 'HUG',
        lineHeight: { value: 120, unit: 'PERCENT' },
      },
    });

    // Description
    ops.push({
      type: 'CREATE_TEXT',
      ref: 'description',
      parentRef: 'root',
      props: {
        name: 'Description',
        content: content.body ?? content.subtitle ?? 'Describe this feature in one or two short sentences.',
        fontFamily: bodyFont,
        fontStyle: 'Regular',
        fontSize: Math.round(width * 0.024),
        fills: [mutedFill],
        textAlignHorizontal: 'CENTER',
        textAutoResize: 'HEIGHT',
        layoutSizingHorizontal: 'FILL',
        layoutSizingVertical: 'HUG',
        lineHeight: { value: 155, unit: 'PERCENT' },
      },
    });

    return ops;
  },
};

// ── Registry ──

export const LAYOUT_PRESETS: LayoutPreset[] = [
  promotionalPost,
  informativePost,
  featureCard,
];

/**
 * Find the best matching preset for a given intent string.
 * Returns the first preset whose intents array contains a match,
 * or `promotionalPost` as a safe default.
 */
export function findPresetForIntent(intent: string): LayoutPreset {
  const normalized = intent.toLowerCase();
  for (const preset of LAYOUT_PRESETS) {
    if (preset.intents.some((i) => normalized.includes(i))) {
      return preset;
    }
  }
  return promotionalPost;
}

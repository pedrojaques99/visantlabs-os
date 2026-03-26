/**
 * AI-First Prompt System - Format Presets
 *
 * Exportable for use in validator and other modules.
 * Single source of truth for social media dimensions.
 */

import type { FormatType } from './types.js';

export interface FormatPreset {
  width: number;
  height: number;
  label: string;
  aliases: string[];
}

export const FORMAT_PRESETS: Record<Exclude<FormatType, 'unknown'>, FormatPreset> = {
  instagram_feed: {
    width: 1080,
    height: 1080,
    label: 'Instagram Feed',
    aliases: ['feed', 'post instagram', 'instagram post', 'post feed', 'feed post', 'insta feed'],
  },
  instagram_stories: {
    width: 1080,
    height: 1920,
    label: 'Instagram Stories',
    aliases: ['stories', 'story', 'reels', 'instagram stories', 'insta stories'],
  },
  instagram_highlight: {
    width: 1080,
    height: 1920,
    label: 'Instagram Highlight',
    aliases: ['destaque', 'highlight', 'capa destaque', 'highlight cover'],
  },
  youtube_thumbnail: {
    width: 1280,
    height: 720,
    label: 'YouTube Thumbnail',
    aliases: ['youtube', 'thumbnail youtube', 'yt thumb', 'miniatura youtube'],
  },
  linkedin_post: {
    width: 1200,
    height: 627,
    label: 'LinkedIn Post',
    aliases: ['linkedin', 'post linkedin'],
  },
  facebook_post: {
    width: 1200,
    height: 630,
    label: 'Facebook Post',
    aliases: ['facebook', 'fb', 'post facebook'],
  },
  twitter_post: {
    width: 1600,
    height: 900,
    label: 'Twitter/X Post',
    aliases: ['twitter', 'x post', 'tweet'],
  },
  tiktok: {
    width: 1080,
    height: 1920,
    label: 'TikTok',
    aliases: ['tiktok', 'tik tok'],
  },
  pinterest: {
    width: 1000,
    height: 1500,
    label: 'Pinterest Pin',
    aliases: ['pinterest', 'pin'],
  },
  slide_16_9: {
    width: 1920,
    height: 1080,
    label: 'Slide 16:9',
    aliases: ['slide', 'apresentacao', 'apresentação', 'presentation', '16:9', 'deck'],
  },
  slide_4_3: {
    width: 1440,
    height: 1080,
    label: 'Slide 4:3',
    aliases: ['4:3', 'slide 4:3'],
  },
};

/**
 * Detect format from user input
 */
export function detectFormat(input: string): FormatType {
  const normalized = input.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  for (const [format, preset] of Object.entries(FORMAT_PRESETS)) {
    for (const alias of preset.aliases) {
      const normalizedAlias = alias.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      if (normalized.includes(normalizedAlias)) {
        return format as FormatType;
      }
    }
  }

  return 'unknown';
}

/**
 * Get dimensions for a format
 */
export function getFormatDimensions(format: FormatType): { width: number; height: number } | null {
  if (format === 'unknown') return null;
  const preset = FORMAT_PRESETS[format];
  return { width: preset.width, height: preset.height };
}

/**
 * Build preset context for prompt injection
 */
export function buildPresetContext(format: FormatType): string {
  if (format === 'unknown') {
    return `DIMENSOES: Formato desconhecido. PERGUNTE ao usuario antes de criar.`;
  }

  const preset = FORMAT_PRESETS[format];
  return `DIMENSOES: ${preset.label} = ${preset.width}x${preset.height}px (usar automaticamente)`;
}

/**
 * Build full presets reference (for complex intents)
 */
export function buildFullPresetsReference(): string {
  const lines = ['FORMATOS DISPONIVEIS:'];

  for (const [, preset] of Object.entries(FORMAT_PRESETS)) {
    lines.push(`  ${preset.label}: ${preset.width}x${preset.height}px`);
  }

  return lines.join('\n');
}

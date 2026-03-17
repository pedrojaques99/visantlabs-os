/**
 * Social Media Format Presets
 * Predefined dimensions for common social platforms
 */

export const FORMAT_PRESETS = {
  'instagram-feed': { width: 1080, height: 1080, name: 'Instagram Feed' },
  'instagram-story': { width: 1080, height: 1920, name: 'Instagram Story' },
  'instagram-reels': { width: 1080, height: 1920, name: 'Instagram Reels' },
  'linkedin-post': { width: 1200, height: 627, name: 'LinkedIn Post' },
  'twitter-post': { width: 1200, height: 675, name: 'Twitter/X Post' },
  'facebook-post': { width: 1200, height: 630, name: 'Facebook Post' },
  'youtube-thumbnail': { width: 1280, height: 720, name: 'YouTube Thumbnail' },
} as const;

export type FormatPresetKey = keyof typeof FORMAT_PRESETS;

/**
 * Build context string for LLM system prompt
 */
export function buildFormatPresetsContext(): string {
  const lines = [
    '## SOCIAL MEDIA FORMATS',
    'When creating social media content, use these exact dimensions:',
    '',
  ];

  for (const [_key, preset] of Object.entries(FORMAT_PRESETS)) {
    lines.push(`- ${preset.name}: ${preset.width}x${preset.height}`);
  }

  lines.push('');
  lines.push('Match the format to the platform mentioned in the request.');
  lines.push('If no platform specified, default to Instagram Feed (1080x1080).');

  return lines.join('\n');
}

/**
 * Get preset by key or find best match for a query
 */
export function getFormatPreset(query: string): { width: number; height: number; name: string } | null {
  const normalized = query.toLowerCase().replace(/[^a-z]/g, '');

  // Direct match
  for (const [key, preset] of Object.entries(FORMAT_PRESETS)) {
    if (normalized.includes(key.replace('-', ''))) {
      return preset;
    }
  }

  // Fuzzy match by platform name
  if (normalized.includes('instagram') || normalized.includes('insta')) {
    if (normalized.includes('story') || normalized.includes('stories') || normalized.includes('reel')) {
      return FORMAT_PRESETS['instagram-story'];
    }
    return FORMAT_PRESETS['instagram-feed'];
  }
  if (normalized.includes('linkedin')) return FORMAT_PRESETS['linkedin-post'];
  if (normalized.includes('twitter') || normalized.includes('x')) return FORMAT_PRESETS['twitter-post'];
  if (normalized.includes('facebook') || normalized.includes('fb')) return FORMAT_PRESETS['facebook-post'];
  if (normalized.includes('youtube') || normalized.includes('thumbnail')) return FORMAT_PRESETS['youtube-thumbnail'];

  return null;
}

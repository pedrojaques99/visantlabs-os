/**
 * Branding Configuration — Single Source of Truth
 *
 * This file centralizes all branding-related content that may need to be
 * customized when forking this project. Edit these values to personalize
 * your instance of the application.
 *
 * For more sensitive values (like private group links), use environment
 * variables instead (see env.example).
 */

export const branding = {
  companyName: 'Visant Labs',
  productName: 'Visant Labs',

  description:
    'AI design platform: generate mockups, creatives, brand identities, and production-ready assets from brand guidelines.',

  github: {
    organization: 'pedrojaques99',
    repository: 'visantlabs-os',
    url: 'https://github.com/pedrojaques99/visantlabs-os',
  },

  social: {
    github: 'https://github.com/pedrojaques99/visantlabs-os',
    x: 'https://x.com/visantlabs',
  },

  support: {
    email: 'support@visantlabs.com',
  },

  links: {
    website: 'https://www.visant.co/works',
  },

  tutorialVideo: {
    youtubeId: 'nzLeKvcL6-Y',
    enabled: true,
  },
} as const;

/**
 * Get YouTube thumbnail URL
 */
export const getYoutubeThumbnail = (
  quality: 'maxresdefault' | 'hqdefault' | 'mqdefault' = 'maxresdefault'
): string => {
  if (!branding.tutorialVideo.enabled || !branding.tutorialVideo.youtubeId) {
    return '';
  }
  return `https://img.youtube.com/vi/${branding.tutorialVideo.youtubeId}/${quality}.jpg`;
};

/**
 * Get YouTube video URL
 */
export const getYoutubeVideoUrl = (): string => {
  if (!branding.tutorialVideo.enabled || !branding.tutorialVideo.youtubeId) {
    return '';
  }
  return `https://www.youtube.com/watch?v=${branding.tutorialVideo.youtubeId}`;
};

/**
 * Get GitHub repository URL
 */
export const getGithubUrl = (): string => {
  return branding.github.url;
};

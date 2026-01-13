/**
 * Branding Configuration
 * 
 * This file centralizes all branding-related content that may need to be
 * customized when forking this project. Edit these values to personalize
 * your instance of the application.
 * 
 * For more sensitive values (like private group links), use environment
 * variables instead (see env.example).
 */

export const branding = {
  // Company/Organization Info
  companyName: 'Visant Labs',
  productName: 'VSN Mockup Machine',

  // Repository
  github: {
    organization: 'pedrojaques99',
    repository: 'visantlabs-os',
    url: 'https://github.com/pedrojaques99/visantlabs-os',
  },

  // Contact & Support
  support: {
    // These emails appear in legal pages and support sections
    // Customize for your own deployment
    email: 'contato@visant.co',
    supportEmail: 'suporte@visantlabs.com',
  },

  // External Links
  links: {
    // Portfolio/website link shown in About page
    website: 'https://www.visant.co/works',
  },

  // Tutorial Video
  // YouTube video ID for the tutorial shown on welcome screen
  // Set to empty string to hide the tutorial video
  tutorialVideo: {
    youtubeId: 'nzLeKvcL6-Y',
    enabled: true,
  },
} as const;

/**
 * Get YouTube thumbnail URL
 */
export const getYoutubeThumbnail = (quality: 'maxresdefault' | 'hqdefault' | 'mqdefault' = 'maxresdefault'): string => {
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



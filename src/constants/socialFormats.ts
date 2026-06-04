export interface SocialFormat {
  id: string;
  label: string;
  platform: string;
  ratio: '1:1' | '9:16' | '16:9' | '4:5' | '1.91:1' | '2:3';
  width: number;
  height: number;
  copyMaxChars: number;
  icon: string;
}

export const SOCIAL_FORMATS: SocialFormat[] = [
  { id: 'ig-post', label: 'Instagram Post', platform: 'Instagram', ratio: '1:1', width: 1080, height: 1080, copyMaxChars: 2200, icon: 'instagram' },
  { id: 'ig-story', label: 'Instagram Story', platform: 'Instagram', ratio: '9:16', width: 1080, height: 1920, copyMaxChars: 125, icon: 'instagram' },
  { id: 'ig-feed', label: 'Instagram Feed', platform: 'Instagram', ratio: '4:5', width: 1080, height: 1350, copyMaxChars: 2200, icon: 'instagram' },
  { id: 'linkedin', label: 'LinkedIn Post', platform: 'LinkedIn', ratio: '1.91:1', width: 1200, height: 628, copyMaxChars: 3000, icon: 'linkedin' },
  { id: 'twitter', label: 'Twitter / X', platform: 'Twitter', ratio: '16:9', width: 1200, height: 675, copyMaxChars: 280, icon: 'twitter' },
  { id: 'facebook', label: 'Facebook Post', platform: 'Facebook', ratio: '1.91:1', width: 1200, height: 630, copyMaxChars: 2000, icon: 'facebook' },
  { id: 'tiktok', label: 'TikTok Cover', platform: 'TikTok', ratio: '9:16', width: 1080, height: 1920, copyMaxChars: 150, icon: 'tiktok' },
  { id: 'pinterest', label: 'Pinterest Pin', platform: 'Pinterest', ratio: '2:3', width: 1000, height: 1500, copyMaxChars: 500, icon: 'pinterest' },
  { id: 'yt-thumb', label: 'YouTube Thumbnail', platform: 'YouTube', ratio: '16:9', width: 1280, height: 720, copyMaxChars: 100, icon: 'youtube' },
];

export const DEFAULT_CONTENT_FORMATS = ['ig-post', 'ig-story', 'linkedin', 'twitter'];

export function getFormatById(id: string): SocialFormat | undefined {
  return SOCIAL_FORMATS.find((f) => f.id === id);
}

export function mapSocialToCreativeRatio(ratio: SocialFormat['ratio']): '1:1' | '9:16' | '16:9' | '4:5' {
  switch (ratio) {
    case '1:1': return '1:1';
    case '9:16': return '9:16';
    case '16:9': return '16:9';
    case '4:5': return '4:5';
    case '1.91:1': return '16:9';
    case '2:3': return '9:16';
    default: return '1:1';
  }
}

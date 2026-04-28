export interface ColorToken {
  name: string;
  variable: string;
  description?: string;
  group: 'semantic' | 'chart' | 'sidebar' | 'brand';
}

export interface SpacingToken {
  name: string;
  variable: string;
  description?: string;
}

export interface TypographyToken {
  name: string;
  className: string;
  fontFamily: string;
  description: string;
}

export const COLOR_TOKENS: ColorToken[] = [
  { name: 'Background', variable: '--background', description: 'Main background', group: 'semantic' },
  { name: 'Foreground', variable: '--foreground', description: 'Main text color', group: 'semantic' },
  { name: 'Card', variable: '--card', description: 'Card background', group: 'semantic' },
  { name: 'Card Foreground', variable: '--card-foreground', description: 'Text on card', group: 'semantic' },
  { name: 'Popover', variable: '--popover', description: 'Popover background', group: 'semantic' },
  { name: 'Popover Foreground', variable: '--popover-foreground', description: 'Text on popover', group: 'semantic' },
  { name: 'Primary', variable: '--primary', description: 'Main brand color', group: 'semantic' },
  { name: 'Primary Foreground', variable: '--primary-foreground', description: 'Text on primary', group: 'semantic' },
  { name: 'Secondary', variable: '--secondary', description: 'Secondary background', group: 'semantic' },
  { name: 'Secondary Foreground', variable: '--secondary-foreground', description: 'Text on secondary', group: 'semantic' },
  { name: 'Muted', variable: '--muted', description: 'Muted background', group: 'semantic' },
  { name: 'Muted Foreground', variable: '--muted-foreground', description: 'Muted text', group: 'semantic' },
  { name: 'Accent', variable: '--accent', description: 'Accent color', group: 'semantic' },
  { name: 'Accent Foreground', variable: '--accent-foreground', description: 'Text on accent', group: 'semantic' },
  { name: 'Destructive', variable: '--destructive', description: 'Error/danger color', group: 'semantic' },
  { name: 'Border', variable: '--border', description: 'Border color', group: 'semantic' },
  { name: 'Input', variable: '--input', description: 'Input border', group: 'semantic' },
  { name: 'Ring', variable: '--ring', description: 'Focus ring', group: 'semantic' },
  { name: 'Chart 1', variable: '--chart-1', group: 'chart' },
  { name: 'Chart 2', variable: '--chart-2', group: 'chart' },
  { name: 'Chart 3', variable: '--chart-3', group: 'chart' },
  { name: 'Chart 4', variable: '--chart-4', group: 'chart' },
  { name: 'Chart 5', variable: '--chart-5', group: 'chart' },
  { name: 'Sidebar', variable: '--sidebar', description: 'Sidebar background', group: 'sidebar' },
  { name: 'Sidebar Foreground', variable: '--sidebar-foreground', description: 'Sidebar text', group: 'sidebar' },
  { name: 'Sidebar Primary', variable: '--sidebar-primary', description: 'Sidebar primary', group: 'sidebar' },
  { name: 'Sidebar Primary Foreground', variable: '--sidebar-primary-foreground', group: 'sidebar' },
  { name: 'Sidebar Accent', variable: '--sidebar-accent', group: 'sidebar' },
  { name: 'Sidebar Accent Foreground', variable: '--sidebar-accent-foreground', group: 'sidebar' },
  { name: 'Sidebar Border', variable: '--sidebar-border', group: 'sidebar' },
  { name: 'Sidebar Ring', variable: '--sidebar-ring', group: 'sidebar' },
  { name: 'Brand Cyan', variable: '--brand-cyan', description: 'Brand accent color', group: 'brand' },
];

export const SPACING_TOKENS: SpacingToken[] = [
  { name: '--radius', variable: '--radius', description: 'Base border radius' },
  { name: '--node-padding', variable: '--node-padding', description: 'Default node padding (p-8)' },
  { name: '--node-gap', variable: '--node-gap', description: 'Default gap between elements (gap-4)' },
  { name: '--node-gap-sm', variable: '--node-gap-sm', description: 'Small gap (gap-3)' },
  { name: '--node-gap-lg', variable: '--node-gap-lg', description: 'Large gap (gap-5)' },
  { name: '--node-margin', variable: '--node-margin', description: 'Default margin-bottom (mb-4)' },
  { name: '--node-margin-sm', variable: '--node-margin-sm', description: 'Small margin (mb-3)' },
  { name: '--node-margin-lg', variable: '--node-margin-lg', description: 'Large margin (mb-5)' },
  { name: '--node-space-y', variable: '--node-space-y', description: 'Default vertical spacing (space-y-4)' },
  { name: '--node-space-y-sm', variable: '--node-space-y-sm', description: 'Small vertical spacing (space-y-3)' },
  { name: '--node-space-y-lg', variable: '--node-space-y-lg', description: 'Large vertical spacing (space-y-5)' },
];

export const TAILWIND_SPACING_SCALE = [
  { name: '0', tailwind: 'p-0', px: 0 },
  { name: '1', tailwind: 'p-1', px: 4 },
  { name: '2', tailwind: 'p-2', px: 8 },
  { name: '3', tailwind: 'p-3', px: 12 },
  { name: '4', tailwind: 'p-4', px: 16 },
  { name: '5', tailwind: 'p-5', px: 20 },
  { name: '6', tailwind: 'p-6', px: 24 },
  { name: '8', tailwind: 'p-8', px: 32 },
  { name: '10', tailwind: 'p-10', px: 40 },
  { name: '12', tailwind: 'p-12', px: 48 },
  { name: '16', tailwind: 'p-16', px: 64 },
  { name: '20', tailwind: 'p-20', px: 80 },
] as const;

export const TYPOGRAPHY_TOKENS: TypographyToken[] = [
  { name: 'Manrope', className: 'font-manrope', fontFamily: "'Manrope', sans-serif", description: 'Primary font family' },
  { name: 'Red Hat Mono', className: 'font-redhatmono', fontFamily: "'Red Hat Mono', monospace", description: 'Monospace font' },
  { name: 'Dancing Script', className: 'font-signature', fontFamily: "'Dancing Script', cursive", description: 'Signature font' },
  { name: 'Rock Salt', className: 'font-rocksalt', fontFamily: "'Rock Salt', cursive", description: 'Display font' },
];

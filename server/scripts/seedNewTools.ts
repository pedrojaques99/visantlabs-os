/**
 * Seed all 9 new standalone tools into the apps database.
 * Run: npx tsx server/scripts/seedNewTools.ts
 */

import { prisma } from '../db/prisma.js';

const NEW_TOOLS = [
  {
    appId: 'color-converter',
    name: 'Color Converter',
    description:
      'Convert between HEX, RGB, CMYK, HSL with nearest RAL & Pantone lookup. Batch support.',
    link: '/color-converter',
    badgeVariant: 'free',
    category: 'creative',
    isExternal: false,
    free: true,
    isHidden: false,
    displayOrder: 51,
  },
  {
    appId: 'compress',
    name: 'Image Compressor',
    description:
      'Batch compress and optimize images. Adjust quality, max dimensions, and output format (JPEG, PNG, WebP).',
    link: '/compress',
    badgeVariant: 'free',
    category: 'creative',
    isExternal: false,
    free: true,
    isHidden: false,
    displayOrder: 52,
  },
  {
    appId: 'color-palette',
    name: 'Color Palette',
    description:
      'Extract color palettes from images. Export as CSS variables, Tailwind config, or JSON. WCAG contrast grid.',
    link: '/color-palette',
    badgeVariant: 'free',
    category: 'creative',
    isExternal: false,
    free: true,
    isHidden: false,
    displayOrder: 53,
  },
  {
    appId: 'converter',
    name: 'File Converter',
    description:
      'Batch convert images between PNG, JPG, WebP, PDF, and ICO. All processing client-side.',
    link: '/converter',
    badgeVariant: 'free',
    category: 'creative',
    isExternal: false,
    free: true,
    isHidden: false,
    displayOrder: 54,
  },
  {
    appId: 'favicon',
    name: 'Favicon Generator',
    description:
      'Generate all favicon sizes (16-512px), ICO file, and web manifest from a single image.',
    link: '/favicon',
    badgeVariant: 'free',
    category: 'creative',
    isExternal: false,
    free: true,
    isHidden: false,
    displayOrder: 56,
  },
  {
    appId: 'svg-optimizer',
    name: 'SVG Optimizer',
    description:
      'Clean and minify SVG files. Remove metadata, editor data, empty groups. Preview diff.',
    link: '/svg-optimizer',
    badgeVariant: 'free',
    category: 'creative',
    isExternal: false,
    free: true,
    isHidden: false,
    displayOrder: 57,
  },
  {
    appId: 'watermark',
    name: 'Watermark Tool',
    description:
      'Batch apply text or logo watermarks. Adjustable position, opacity, tiling, and rotation.',
    link: '/watermark',
    badgeVariant: 'free',
    category: 'creative',
    isExternal: false,
    free: true,
    isHidden: false,
    displayOrder: 58,
  },
  {
    appId: 'remove-bg',
    name: 'Background Remover',
    description:
      'Remove solid backgrounds from images. Batch processing with adjustable threshold and feathering.',
    link: '/remove-bg',
    badgeVariant: 'free',
    category: 'creative',
    isExternal: false,
    free: true,
    isHidden: false,
    displayOrder: 59,
  },
  {
    appId: 'og-image',
    name: 'OG Image Generator',
    description:
      'Create Open Graph images for social sharing. 4 templates, live preview, export PNG with meta tags.',
    link: '/og-image',
    badgeVariant: 'free',
    category: 'creative',
    isExternal: false,
    free: true,
    isHidden: false,
    displayOrder: 60,
  },
];

async function main() {
  for (const app of NEW_TOOLS) {
    const result = await (prisma as any).appConfig.upsert({
      where: { appId: app.appId },
      update: {
        name: app.name,
        description: app.description,
        link: app.link,
        badgeVariant: app.badgeVariant,
        category: app.category,
        free: app.free,
        isHidden: app.isHidden,
        displayOrder: app.displayOrder,
      },
      create: app,
    });
    console.log(`✓ ${result.appId}`);
  }

  const visible = await (prisma as any).appConfig.findMany({
    where: { isHidden: false },
    orderBy: { displayOrder: 'asc' },
    select: { name: true, link: true, category: true, badgeVariant: true },
  });
  console.log(`\n${visible.length} visible apps total:`);
  visible.forEach((a: any) =>
    console.log(`  [${a.category}/${a.badgeVariant}] ${a.name} → ${a.link}`)
  );

  await (prisma as any).$disconnect();
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});

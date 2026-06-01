export const IMAGE_EDITOR = {
  mask: {
    fill: 'rgba(255, 255, 255, 1)',
    preview: 'rgba(82, 221, 235, 0.35)',
    dimOverlay: 'rgba(0, 0, 0, 0.55)',
  },
  selection: {
    stroke: 'rgba(82, 221, 235, 0.7)',
    strokeDash: [6, 4],
    fill: 'rgba(82, 221, 235, 0.1)',
    handleSize: 8,
    handleFill: 'rgba(82, 221, 235, 0.9)',
  },
  expand: {
    zoneFill: 'rgba(82, 221, 235, 0.08)',
    zoneBorder: 'rgba(82, 221, 235, 0.4)',
    handleThickness: 6,
    checkerSize: 12,
    checkerLight: 'rgba(255, 255, 255, 0.06)',
    checkerDark: 'rgba(0, 0, 0, 0.06)',
  },
  toolbar: {
    bg: 'bg-neutral-900/90 backdrop-blur-xl',
    border: 'border border-white/10',
    radius: 'rounded-xl',
    activeTool: 'bg-brand-cyan/20 text-brand-cyan',
    inactiveTool: 'text-neutral-400 hover:text-white hover:bg-neutral-800/50',
    divider: 'w-px h-5 bg-white/10',
  },
  canvas: {
    bg: 'bg-neutral-950',
    minZoom: 0.1,
    maxZoom: 5,
    padding: 60,
  },
  brush: {
    minSize: 2,
    maxSize: 200,
    defaultSize: 24,
    cursorColor: 'rgba(82, 221, 235, 0.6)',
  },
} as const;

export const EDITOR_STATUS_MESSAGES = [
  'analyzing the image',
  'preparing the mask',
  'generating new content',
  'blending seamlessly',
  'refining details',
  'almost there',
] as const;

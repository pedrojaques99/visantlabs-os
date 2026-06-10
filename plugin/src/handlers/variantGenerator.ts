/// <reference types="@figma/plugin-typings" />

/**
 * VARIANT GENERATOR
 *
 * Takes the currently selected frame and produces color/mood variants.
 * Each variant is a clone with swapped fills, instance components, and
 * opacity adjustments based on a preset config.
 *
 * 100% scriptable, no LLM. One selection → N variants in one click.
 */

export interface VariantPreset {
  id: string;
  label: string;
  overlay?: { r: number; g: number; b: number };
  ellipse?: { r: number; g: number; b: number };
  ellipseMid?: { r: number; g: number; b: number };
  textureOpacity?: number;
  sedimentumOpacity?: number;
  swapFita?: string;
  swapTexture?: string;
}

export const DEFAULT_PRESETS: VariantPreset[] = [
  {
    id: 'lava',
    label: 'Lava',
    overlay: { r: 0.72, g: 0.12, b: 0.03 },
    ellipse: { r: 0.95, g: 0.45, b: 0.15 },
    ellipseMid: { r: 0.95, g: 0.55, b: 0.25 },
  },
  {
    id: 'off-white',
    label: 'Off-White',
    overlay: { r: 0.96, g: 0.93, b: 0.87 },
    ellipse: { r: 0.98, g: 0.92, b: 0.82 },
    ellipseMid: { r: 0.97, g: 0.94, b: 0.88 },
    textureOpacity: 0.3,
    sedimentumOpacity: 0.6,
  },
  {
    id: 'terra',
    label: 'Terra',
    overlay: { r: 0.4, g: 0.22, b: 0.1 },
    ellipse: { r: 0.65, g: 0.48, b: 0.3 },
    ellipseMid: { r: 0.72, g: 0.56, b: 0.38 },
  },
];

function applyGradientColor(
  fills: readonly Paint[],
  color: { r: number; g: number; b: number },
  type: 'LINEAR' | 'RADIAL',
  midColor?: { r: number; g: number; b: number }
): Paint[] {
  const cloned: Paint[] = JSON.parse(JSON.stringify(fills));
  for (const fill of cloned) {
    if (fill.type === `GRADIENT_${type}` && 'gradientStops' in fill) {
      const stops = (fill as GradientPaint).gradientStops;
      if (type === 'LINEAR' && stops.length >= 2) {
        stops[0].color = { ...color, a: 1 };
        stops[1].color = { ...color, a: 0 };
      } else if (type === 'RADIAL' && stops.length >= 3) {
        stops[0].color = { ...color, a: 1 };
        stops[1].color = { ...(midColor || color), a: 1 };
        stops[2].color = { ...color, a: 0 };
      }
    }
  }
  return cloned;
}

export async function generateVariants(presets: VariantPreset[] = DEFAULT_PRESETS) {
  const selection = figma.currentPage.selection;
  if (selection.length === 0) return;

  const source = selection[0];
  if (source.type !== 'FRAME' && source.type !== 'COMPONENT' && source.type !== 'INSTANCE') return;

  const gap = 200;
  const created: SceneNode[] = [];

  for (let i = 0; i < presets.length; i++) {
    const preset = presets[i];
    const clone = source.clone();
    clone.name = `${source.name} :: ${preset.label}`;
    clone.x = source.x + (source.width + gap) * (i + 1);
    clone.y = source.y;

    // Overlay gradient
    if (preset.overlay) {
      const overlay = clone.findOne(
        (n) => n.name === 'Overlay/Shadow' || n.name.includes('Overlay')
      );
      if (overlay && 'fills' in overlay) {
        (overlay as GeometryMixin).fills = applyGradientColor(
          (overlay as GeometryMixin).fills as readonly Paint[],
          preset.overlay,
          'LINEAR'
        );
      }
    }

    // Ellipse gradients
    if (preset.ellipse) {
      const ellipses = clone.findAll((n) => n.type === 'ELLIPSE');
      for (const ell of ellipses) {
        (ell as EllipseNode).fills = applyGradientColor(
          (ell as EllipseNode).fills as readonly Paint[],
          preset.ellipse,
          'RADIAL',
          preset.ellipseMid
        );
      }
    }

    // Texture opacity
    if (preset.textureOpacity !== undefined) {
      const texture = clone.findOne((n) => n.type === 'INSTANCE' && n.name.includes('Terra Lines'));
      if (texture) texture.opacity = preset.textureOpacity;
    }

    // Sedimentum opacity
    if (preset.sedimentumOpacity !== undefined) {
      const sed = clone.findOne((n) => n.type === 'INSTANCE' && n.name.includes('SEDIMENTUM'));
      if (sed) sed.opacity = preset.sedimentumOpacity;
    }

    created.push(clone);
  }

  figma.currentPage.selection = created;
}

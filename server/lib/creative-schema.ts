import { z } from 'zod';

// 0..1 normalized coord with hard bounds (rejects NaN/Infinity).
const Norm01 = z.number().finite().min(0).max(1);

const Position = z.object({ x: Norm01, y: Norm01 });
const Size = z.object({ w: Norm01, h: Norm01 });

const HexColor = z.string().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/);

const TextLayer = z.object({
  type: z.literal('text'),
  content: z.string().min(1).max(500),
  role: z.enum(['headline', 'subheadline', 'body', 'custom']),
  position: Position,
  size: Size,
  align: z.enum(['left', 'center', 'right']),
  fontSize: z.number().finite().min(8).max(400),
  fontFamily: z.string().optional(),
  color: HexColor,
  bold: z.boolean(),
});

const LogoLayer = z.object({
  type: z.literal('logo'),
  url: z.string().url().optional(),
  position: Position,
  size: Size,
});

const ShapeLayer = z.object({
  type: z.literal('shape'),
  shape: z.literal('rect'),
  color: HexColor,
  position: Position,
  size: Size,
});

const Layer = z.discriminatedUnion('type', [TextLayer, LogoLayer, ShapeLayer]);

const Overlay = z.object({
  type: z.enum(['gradient', 'solid']),
  direction: z.enum(['top', 'bottom', 'left', 'right']).optional(),
  opacity: z.number().finite().min(0).max(1),
  color: HexColor.optional(),
});

export const CreativeAIResponseSchema = z.object({
  background: z.object({ prompt: z.string().min(1).max(2000) }).optional(),
  overlay: Overlay.nullable().optional(),
  layers: z.array(Layer).min(1).max(20),
});

export type CreativeAIResponseValidated = z.infer<typeof CreativeAIResponseSchema>;

// Clamp x+w and y+h to ≤ 1.0 — saves layouts where the model overshoots edges.
export function clampLayerBounds(plan: CreativeAIResponseValidated): CreativeAIResponseValidated {
  return {
    ...plan,
    layers: plan.layers.map((layer) => {
      if (layer.type === 'logo' || layer.type === 'shape' || layer.type === 'text') {
        const x = Math.max(0, Math.min(1, layer.position.x));
        const y = Math.max(0, Math.min(1, layer.position.y));
        const w = Math.max(0.01, Math.min(1 - x, layer.size.w));
        const h = Math.max(0.01, Math.min(1 - y, layer.size.h));
        return { ...layer, position: { x, y }, size: { w, h } };
      }
      return layer;
    }),
  };
}

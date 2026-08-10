// Scene Package format — the RAM/UX unlock.
//
// A SceneDoc is the result of pre-processing a PSD ONCE: it captures the
// geometry of each editable face (the quad to warp the art into) plus a small
// set of flattened layer images (base = everything below the faces, over =
// light/shadow layers above, with their blend mode + opacity annotated).
//
// Rendering a mockup from a SceneDoc is then a trivial compose (warp + blend)
// that runs on ANY canvas — the user's browser, a local CLI, or the server as a
// fallback — without ever opening (or shipping) the source PSD.

/** A quad of 4 corners (TL, TR, BR, BL) in document coordinates. */
export type Quad = [number, number, number, number, number, number, number, number];

export interface SceneFace {
  /** Stable key (linkId or representative path) — matches Face.key. */
  key: string;
  /** Short UI name ("Frente", "L", "Arte"). */
  name: string;
  /**
   * Corner quad in document space, or null when the placed layer had no
   * transform (art is drawn axis-aligned at innerW/innerH from `origin`).
   */
  quad: Quad | null;
  /** Axis-aligned placement origin (document px) used when `quad` is null. */
  origin?: { left: number; top: number };
  /** Internal art canvas size — the aspect ratio the art should be generated at. */
  innerW: number;
  innerH: number;
  /** Optional reference to a raster mask image in the asset map. */
  maskRef?: string;
  /** Optional reference to a displacement map image in the asset map (R=X, G=Y, 128=neutral). */
  dispRef?: string;
  /** Displacement scale in pixels (applied symmetrically to H and V). Default 8. */
  dispScale?: number;
}

/**
 * LUT de 256 entradas por canal, serializável em JSON (o `Uint8Array` de
 * `RgbLut` não sobrevive ao `JSON.stringify` do SceneDoc).
 */
export interface SceneLut {
  r: number[];
  g: number[];
  b: number[];
}

export interface SceneLayer {
  /**
   * `base` = abaixo das faces (desenhado primeiro); `over` = acima
   * (luz/sombra); `adjust` = adjustment layer (Levels/Curves/Brightness).
   *
   * `adjust` não tem pixels próprios: aplica um LUT sobre tudo que já foi
   * composto abaixo — inclusive a arte da face. Antes ele virava um `over`
   * achatado sozinho, e achatar um adjustment sem nada embaixo produz canvas
   * vazio: o ajuste sumia em silêncio e a cena saía lavada (preto virando
   * cinza, contraste e saturação indo embora).
   */
  role: 'base' | 'over' | 'adjust';
  /** Reference into the asset map ({ ref: canvas|url }). Vazio quando role='adjust'. */
  src: string;
  /** Só para `role: 'adjust'`: a tabela a aplicar. */
  lut?: SceneLut;
  /** Só para `role: 'adjust'`: máscara raster que limita onde o ajuste age. */
  maskRef?: string;
  /** Canvas-2D globalCompositeOperation already resolved from the PSD blend mode. */
  blendMode: string;
  /** 0..1 combined opacity * fillOpacity. */
  opacity: number;
  /** Top-left where the layer image is drawn (document px). Usually 0,0 (full-size). */
  left: number;
  top: number;
}

export interface SceneDoc {
  version: 1;
  width: number;
  height: number;
  faces: SceneFace[];
  layers: SceneLayer[];
  /** Blend modes / features encountered that the engine cannot reproduce 1:1 (fallback hints). */
  warnings: string[];
}

/** Map from a SceneLayer/SceneFace `src`/`maskRef` to a loaded image or canvas. */
export type AssetMap = Record<string, any>;

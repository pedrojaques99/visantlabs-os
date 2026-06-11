// Shared types for @visantlabs/psd-engine.
// The engine is canvas-implementation agnostic: callers inject a `CreateCanvas`
// factory (node-canvas, browser HTMLCanvasElement, @napi-rs/canvas, etc.) so the
// same compositor runs server-side, in the browser, or in a local CLI.

/** Factory that returns a canvas-like object exposing getContext('2d'). */
export type CreateCanvas = (w: number, h: number) => any;

/** Minimal canvas surface the compositor relies on. */
export interface CanvasLike {
  width: number;
  height: number;
  getContext(type: '2d'): any;
}

/** Result of replacing the art in one smart-object layer. */
export interface ReplacedLayer {
  name: string;
  width: number;
  height: number;
  warped: boolean;
}

/** A scanned smart object, the raw input to face computation. */
export interface FaceSo {
  name: string;
  path: string;
  innerWidth: number;
  innerHeight: number;
  hidden?: boolean;
  linkId?: string;
}

/** An editable "face" of a mockup (a group of linked smart objects). */
export interface Face {
  /** Identificador estável (linkId ou path do representante). */
  key: string;
  /** Nome curto pra UI ("L", "Frente", "Arte"). */
  name: string;
  /** Valor a enviar como `smartObject` pro render (path único do representante). */
  smartObject: string;
  innerWidth: number;
  innerHeight: number;
  /** Quantos SOs vinculados compõem a face. */
  linkedCount: number;
}

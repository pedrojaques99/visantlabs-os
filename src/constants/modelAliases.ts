/**
 * Modelos aposentados → substituto. Fonte: ai.google.dev/gemini-api/docs/deprecations e a API
 * (`GET /v1beta/models/<id>`), conferidos em 2026-10-27. Canvas, presets e chamadas antigas ainda
 * mandam o id velho: o servidor troca pelo substituto antes de gerar e de cobrar.
 *
 * Kling legado só roda na API direta da Kling, que está sem pacote; o v3 (via fal) assume.
 */
export const RETIRED_MODEL_ALIASES: Readonly<Record<string, string>> = {
  // Google — Imagen 4 respondeu 404 (desligado em 17/ago/2026); a Google indica o Nano Banana 2.
  'imagen-4.0-fast-generate-001': 'gemini-3.1-flash-lite-image',
  'imagen-4.0-generate-001': 'gemini-3.1-flash-lite-image',
  'imagen-4.0-ultra-generate-001': 'gemini-3.1-flash-image',
  // Google — preview → GA (mesmo modelo e preço) e Nano Banana → Nano Banana 2 Lite (mais barato).
  'gemini-2.5-flash-image': 'gemini-3.1-flash-lite-image',
  'gemini-3.1-flash-image-preview': 'gemini-3.1-flash-image',
  'gemini-3-pro-image-preview': 'gemini-3-pro-image',
  'gemini-3.1-flash-lite-preview': 'gemini-3.1-flash-lite',
  // Kling legado (só API direta, sem pacote) → v3 no fal.
  'kling-v1': 'kling-v3',
  'kling-v1-5': 'kling-v3',
  'kling-v1.5': 'kling-v3',
  'kling-v1-6': 'kling-v3',
  'kling-v1.6': 'kling-v3',
  'kling-v2-1': 'kling-v3',
  'kling-v2.1': 'kling-v3',
  'kling-v2-master': 'kling-v3',
  'kling-v2-1-master': 'kling-v3',
  'kling-video-o1': 'kling-v3-omni',
};

/** Id em uso para um id possivelmente aposentado. Desconhecido ou atual: devolve o mesmo. */
export function resolveModelAlias<T extends string | undefined | null>(model: T): T {
  if (!model) return model;
  return (RETIRED_MODEL_ALIASES[model] ?? model) as T;
}

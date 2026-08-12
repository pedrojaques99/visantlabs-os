// Camadas de COR SÓLIDA (Solid Color fill) — detectar e trocar.
//
// O template BOXY já separa a cor do produto numa camada própria, e o nome diz
// isso em português claro: "Cor do Fundo", "Cor da Caixa", "Left Cup Color".
// São fill layers com máscara, e é assim que a cor do mockup era editada — no
// Photoshop, abrindo o arquivo.
//
// O ag-psd entrega essa camada de duas formas ao mesmo tempo:
//   - `vectorFill: { type: 'color', color: { r, g, b } }` — a cor declarada;
//   - `canvas` — a mesma cor JÁ rasterizada, recortada pela máscara da camada.
//
// O compositor lê o `canvas`. Então trocar a cor é repintar esse canvas
// PRESERVANDO O ALPHA: a forma (e o antisserrilhado da borda) mora no alpha, e
// refazê-la a partir da máscara devolveria uma borda dura que o PSD não tem.

import type { CreateCanvas } from './types.js';

export interface ColorSlot {
  /** Path único da camada na árvore — a mesma chave que `resolveSoTarget` usa. */
  path: string;
  /** Nome da camada, como aparece no Photoshop ("Cor do Fundo"). */
  name: string;
  /** Cor atual em hex (`#rrggbb`). */
  hex: string;
  /** Blend do Photoshop, cru — quem for exibir precisa saber que é multiply. */
  blendMode: string;
  /** opacity * fillOpacity, 0..1. */
  opacity: number;
  /** A camada está oculta no arquivo? (variantes de cor costumam vir assim.) */
  hidden: boolean;
}

const dois = (n: number) =>
  Math.max(0, Math.min(255, Math.round(n)))
    .toString(16)
    .padStart(2, '0');

export function rgbParaHex(c: { r: number; g: number; b: number }): string {
  return `#${dois(c.r)}${dois(c.g)}${dois(c.b)}`;
}

export function hexParaRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = /^#?([0-9a-f]{6}|[0-9a-f]{3})$/i.exec(hex.trim());
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

/**
 * Lista as camadas de cor sólida de uma árvore já achatada por `flattenLayers`.
 *
 * Camada oculta ENTRA na lista de propósito: no template BOXY as variantes de
 * cor vêm desligadas ("Cor da Caixa" oculta ao lado de uma ativa), e esconder
 * isso da UI seria esconder metade das opções que o arquivo oferece. Quem exibe
 * decide o que fazer com o `hidden`.
 */
export function computeColorSlots(allLayers: any[]): ColorSlot[] {
  const slots: ColorSlot[] = [];
  for (const l of allLayers) {
    const fill = l.vectorFill;
    if (!fill || fill.type !== 'color' || !fill.color) continue;
    const op = l.opacity ?? 1;
    const fillOp = l.fillOpacity ?? 1;
    slots.push({
      path: l.path ?? l.name ?? 'unnamed',
      name: l.name ?? 'unnamed',
      hex: rgbParaHex(fill.color),
      blendMode: l.blendMode ?? 'normal',
      opacity: Math.max(0, Math.min(1, op * fillOp)),
      hidden: !!l.hidden,
    });
  }
  return slots;
}

/**
 * Repinta as camadas de cor sólida indicadas. Chave = `path` (o que
 * `computeColorSlots` devolve) ou o nome da camada; valor = hex.
 *
 * ⚠️ Escreve no `__original` — o objeto REAL da árvore que o `composePsd` vai
 * ler. `flattenLayers` devolve cópias rasas; mexer nelas não muda o render, e o
 * sintoma seria a cor "não pegar" sem erro nenhum.
 *
 * Devolve os paths efetivamente aplicados, para o chamador poder avisar quando
 * pediu uma camada que não existe em vez de renderizar calado.
 */
export function applyColorOverrides(
  allLayers: any[],
  overrides: Record<string, string>,
  cc: CreateCanvas
): string[] {
  const aplicados: string[] = [];
  for (const l of allLayers) {
    const fill = l.vectorFill;
    if (!fill || fill.type !== 'color') continue;
    const path = l.path ?? l.name ?? 'unnamed';
    const hex = overrides[path] ?? overrides[l.name ?? ''];
    if (!hex) continue;
    const rgb = hexParaRgb(hex);
    if (!rgb) continue;

    const alvo = l.__original ?? l;
    const origem = alvo.canvas ?? l.canvas;
    if (!origem || !origem.width || !origem.height) {
      // Sem raster não há o que repintar; a cor declarada ainda vale para quem
      // rasterizar depois.
      alvo.vectorFill = { ...fill, color: { ...rgb } };
      aplicados.push(path);
      continue;
    }

    const novo = cc(origem.width, origem.height);
    const ctx = novo.getContext('2d');
    ctx.fillStyle = `rgb(${rgb.r},${rgb.g},${rgb.b})`;
    ctx.fillRect(0, 0, origem.width, origem.height);
    // A forma e a borda macia moram no alpha do canvas original.
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(origem, 0, 0);
    ctx.globalCompositeOperation = 'source-over';

    alvo.canvas = novo;
    alvo.vectorFill = { ...fill, color: { ...rgb } };
    aplicados.push(path);
  }
  return aplicados;
}

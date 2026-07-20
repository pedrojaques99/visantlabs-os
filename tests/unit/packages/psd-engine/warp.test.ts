// Cobertura da math geométrica do engine — os casos NÃO-triviais que faltavam:
// coverArtCanvas de fato faz center-crop (sem distorção), e perspectiveWarp
// posiciona no quad deslocado e estreita de verdade em perspectiva (trapézio).
// O compose.test já cobre só o caso identidade; aqui vem o resto.

import { describe, it, expect } from 'vitest';
import { perspectiveWarp, coverArtCanvas } from '@visant/psd-engine';
import { cc, solid, pixel } from './helpers.js';

/** Art com metades horizontais de cores distintas (topo/baixo), pra flagrar crop vertical. */
function halvesTopBottom(w: number, h: number, top: string, bottom: string): any {
  const c = cc(w, h);
  const ctx = c.getContext('2d');
  ctx.fillStyle = top;
  ctx.fillRect(0, 0, w, h / 2);
  ctx.fillStyle = bottom;
  ctx.fillRect(0, h / 2, w, h / 2);
  return c;
}

/** Quantos pixels de uma linha y estão pintados (alpha > 0). */
function rowPaintedCount(canvas: any, y: number): number {
  const d = canvas.getContext('2d').getImageData(0, y, canvas.width, 1).data;
  let n = 0;
  for (let x = 0; x < canvas.width; x++) if (d[x * 4 + 3] > 0) n++;
  return n;
}

describe('coverArtCanvas — center-crop sem distorção', () => {
  it('arte alta (retrato) em alvo quadrado: corta topo/base, mantém a faixa central', () => {
    // 100×200: metade de cima verde, metade de baixo vermelha.
    const art = halvesTopBottom(100, 200, '#00ff00', '#ff0000');
    const out = coverArtCanvas(art, 100, 100, cc); // alvo quadrado

    // cover amostra a faixa vertical central (src y∈[50,150]) na largura cheia →
    // saída y<50 vem do verde (src y<100), y>50 vem do vermelho (src y>100).
    const [, gTop] = pixel(out, 50, 10);
    const [rBot, gBot] = pixel(out, 50, 90);
    expect(gTop).toBeGreaterThan(200); // topo continua verde
    expect(rBot).toBeGreaterThan(200); // base continua vermelha
    expect(gBot).toBeLessThan(80); // e NÃO verde embaixo (crop moveu o split pro meio)
  });
});

describe('perspectiveWarp — posicionamento e perspectiva', () => {
  it('quad deslocado: pinta só dentro do quad, transparente fora', () => {
    const src = solid(20, 20, '#ff0000');
    const out = cc(40, 40);
    // caixa 20×20 centrada em (10,10)..(30,30)
    perspectiveWarp(out.getContext('2d'), src, 20, 20, [
      { x: 10, y: 10 },
      { x: 30, y: 10 },
      { x: 30, y: 30 },
      { x: 10, y: 30 },
    ]);
    expect(pixel(out, 20, 20)[3]).toBe(255); // dentro: opaco
    expect(pixel(out, 20, 20)[0]).toBeGreaterThan(200); // e vermelho
    expect(pixel(out, 2, 2)[3]).toBe(0); // canto de fora: transparente
    expect(pixel(out, 37, 37)[3]).toBe(0); // outro canto de fora: transparente
  });

  it('trapézio (topo estreito, base larga): a linha do topo pinta menos que a de baixo', () => {
    const src = solid(40, 40, '#00ff00');
    const out = cc(40, 40);
    // TL,TR juntos no topo (largura ~10), BR,BL abertos na base (largura ~38)
    perspectiveWarp(out.getContext('2d'), src, 40, 40, [
      { x: 15, y: 0 },
      { x: 25, y: 0 },
      { x: 39, y: 39 },
      { x: 1, y: 39 },
    ]);
    const top = rowPaintedCount(out, 3);
    const bottom = rowPaintedCount(out, 36);
    expect(top).toBeGreaterThan(0);
    expect(bottom).toBeGreaterThan(0);
    expect(top).toBeLessThan(bottom); // perspectiva real: estreita no topo
  });
});

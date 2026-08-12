// Warp de MALHA do Photoshop (`placedLayer.warp.customEnvelopeWarp`).
//
// É a deformação que faz o pôster amassar, a caneca curvar e a etiqueta abraçar
// o vidro. O engine tinha só `perspectiveWarp`, de 4 cantos — homografia não
// entorta no meio, então a arte saía LISA em cima de uma superfície que o PSD
// amassa. Não era limitação da cena: o `composePsd` também ignorava o campo, e
// a diferença só aparecia contra o Photoshop, nunca contra nós mesmos.
//
// COMO O PHOTOSHOP GUARDA
//   uOrder/vOrder = 4  → superfície de Bézier CÚBICA (ordem 4 = grau 3);
//   deformNumRows/Cols = N → malha N×N de pontos de controle, em ROW-MAJOR;
//   `bounds` → o espaço dos pontos, que é o espaço INTERNO do smart object.
//
// Patches adjacentes COMPARTILHAM a borda, então N pontos por eixo formam
// (N−1)/3 patches: 13 → 4 patches, 4 → 1 patch (o warp padrão, sem subdividir).
// Um N que não satisfaz isso não é malha que sabemos ler — vira `null`, e o
// chamador cai no caminho de 4 cantos em vez de inventar geometria.

import type { CreateCanvas } from './types.js';
import { warpGrid } from './warp.js';

export interface EnvelopeMesh {
  /** Pontos de controle em row-major, no espaço interno do smart object. */
  points: Array<{ x: number; y: number }>;
  /** Pontos por eixo (13 no warp subdividido, 4 no padrão). */
  cols: number;
  rows: number;
  /** Patches cúbicos por eixo — `(n−1)/3`. */
  patchesU: number;
  patchesV: number;
  /** Retângulo que os pontos descrevem, em px do espaço interno. */
  width: number;
  height: number;
}

function numero(v: any): number | null {
  if (typeof v === 'number' && isFinite(v)) return v;
  if (v && typeof v.value === 'number' && isFinite(v.value)) return v.value;
  return null;
}

/**
 * Lê a malha de um `placedLayer`. Devolve `null` quando não há warp, quando o
 * estilo não é `custom` (arc/arch/flag/… são fórmulas, não malha) ou quando a
 * contagem de pontos não fecha com a grade declarada.
 */
export function parseEnvelopeWarp(placedLayer: any): EnvelopeMesh | null {
  const w = placedLayer?.warp;
  if (!w || w.style !== 'custom') return null;

  const env = w.customEnvelopeWarp;
  const pontos: any[] = env?.meshPoints;
  if (!Array.isArray(pontos) || pontos.length < 16) return null;

  const cols = w.deformNumCols ?? Math.round(Math.sqrt(pontos.length));
  const rows = w.deformNumRows ?? Math.round(Math.sqrt(pontos.length));
  if (cols * rows !== pontos.length) return null;
  if ((cols - 1) % 3 !== 0 || (rows - 1) % 3 !== 0) return null;

  const largura = numero(w.bounds?.right);
  const altura = numero(w.bounds?.bottom);
  const esquerda = numero(w.bounds?.left) ?? 0;
  const topo = numero(w.bounds?.top) ?? 0;
  if (largura === null || altura === null) return null;
  const width = largura - esquerda;
  const height = altura - topo;
  if (!(width > 0) || !(height > 0)) return null;

  const points = pontos.map((p) => ({ x: numero(p?.x) ?? 0, y: numero(p?.y) ?? 0 }));
  if (points.some((p) => !isFinite(p.x) || !isFinite(p.y))) return null;

  const mesh: EnvelopeMesh = {
    points,
    cols,
    rows,
    patchesU: (cols - 1) / 3,
    patchesV: (rows - 1) / 3,
    width,
    height,
  };

  // Malha IDENTIDADE é o caso comum: o Photoshop grava a grade mesmo quando
  // ninguém entortou nada (o `[BOXY]` deste acervo tem desvio 0,00px). Deformar
  // por ela seria reamostrar a arte inteira para não mudar um pixel — perde
  // nitidez e tempo, e some com o caminho afim puro que existe justamente para
  // evitar o crosshatch das bordas de triângulo.
  if (meshDeviation(mesh) < 0.5) return null;

  return mesh;
}

/** Base de Bernstein cúbica. */
function bernstein(t: number): [number, number, number, number] {
  const s = 1 - t;
  return [s * s * s, 3 * s * s * t, 3 * s * t * t, t * t * t];
}

/**
 * Avalia a superfície em `(u,v) ∈ [0,1]²` e devolve o ponto no espaço INTERNO.
 *
 * A avaliação é por patch: `u·patchesU` diz em qual patch cair e qual é o `t`
 * local. Interpolar bilinearmente os 169 pontos seria mais simples e erraria
 * exatamente onde o vinco é forte — que é o caso que motiva existir isto.
 */
export function evaluateMesh(mesh: EnvelopeMesh, u: number, v: number): { x: number; y: number } {
  const su = Math.min(Math.max(u, 0), 1) * mesh.patchesU;
  const sv = Math.min(Math.max(v, 0), 1) * mesh.patchesV;
  const pu = Math.min(mesh.patchesU - 1, Math.floor(su));
  const pv = Math.min(mesh.patchesV - 1, Math.floor(sv));
  const bu = bernstein(su - pu);
  const bv = bernstein(sv - pv);

  let x = 0;
  let y = 0;
  for (let j = 0; j < 4; j++) {
    const linha = (3 * pv + j) * mesh.cols;
    const peso = bv[j];
    if (peso === 0) continue;
    for (let i = 0; i < 4; i++) {
      const p = mesh.points[linha + 3 * pu + i];
      const w = peso * bu[i];
      x += p.x * w;
      y += p.y * w;
    }
  }
  return { x, y };
}

/**
 * Desenha `src` deformada pela malha e depois posicionada pelo `mapear`, que
 * leva o espaço interno para o destino (tipicamente a homografia do quad).
 *
 * A composição é feita num mapeamento SÓ, sem canvas intermediário: warpar para
 * um buffer e depois deformar de novo custaria uma reamostragem a mais e
 * comeria a nitidez justamente nas dobras.
 */
export function meshWarp(
  ctx: any,
  src: any,
  srcW: number,
  srcH: number,
  mesh: EnvelopeMesh,
  mapear: (x: number, y: number) => { x: number; y: number },
  gridSize = 96
) {
  warpGrid(
    ctx,
    src,
    srcW,
    srcH,
    (u, v) => {
      const m = evaluateMesh(mesh, u, v);
      // A malha vive no retângulo da própria malha; normaliza antes de sair
      // dele, senão um smart object cujo `bounds` difere do tamanho colocado
      // sai deslocado.
      return mapear(m.x / mesh.width, m.y / mesh.height);
    },
    gridSize
  );
}

/** Só para diagnóstico: o quanto a malha foge de um retângulo, em px. */
export function meshDeviation(mesh: EnvelopeMesh): number {
  let max = 0;
  for (let j = 0; j < mesh.rows; j++) {
    for (let i = 0; i < mesh.cols; i++) {
      const p = mesh.points[j * mesh.cols + i];
      const idealX = (i / (mesh.cols - 1)) * mesh.width;
      const idealY = (j / (mesh.rows - 1)) * mesh.height;
      max = Math.max(max, Math.abs(p.x - idealX), Math.abs(p.y - idealY));
    }
  }
  return max;
}

export type { CreateCanvas };

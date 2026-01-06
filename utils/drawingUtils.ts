import { getStroke } from 'perfect-freehand';

/**
 * Converte um array de pontos em SVG path usando perfect-freehand
 * Implementação baseada na documentação oficial do perfect-freehand
 * @param points Array de pontos [x, y] ou [x, y, pressure]
 * @param size Tamanho do traço (default: 2)
 * @param closed Se o path deve ser fechado (default: true)
 * @returns String SVG path data
 */
export function getSvgPathFromStroke(
  points: number[][],
  size: number = 2,
  closed: boolean = true
): string {
  if (points.length === 0) return '';

  const strokePoints = getStroke(points, {
    size,
    thinning: 0.5,
    smoothing: 0.5,
    streamline: 0.5,
  });

  if (strokePoints.length < 4) {
    return '';
  }

  const average = (a: number, b: number) => (a + b) / 2;

  let a = strokePoints[0];
  let b = strokePoints[1];
  const c = strokePoints[2];

  let result = `M${a[0].toFixed(2)},${a[1].toFixed(2)} Q${b[0].toFixed(
    2
  )},${b[1].toFixed(2)} ${average(b[0], c[0]).toFixed(2)},${average(
    b[1],
    c[1]
  ).toFixed(2)} T`;

  for (let i = 2, max = strokePoints.length - 1; i < max; i++) {
    a = strokePoints[i];
    b = strokePoints[i + 1];
    result += `${average(a[0], b[0]).toFixed(2)},${average(a[1], b[1]).toFixed(
      2
    )} `;
  }

  if (closed) {
    result += 'Z';
  }

  return result;
}

/**
 * Calcula os bounds (limites) de um desenho baseado nos pontos
 * @param points Array de pontos [x, y]
 * @returns Objeto com x, y, width, height
 */
export function calculateBounds(points: number[][]): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  if (points.length === 0) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }

  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);

  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}



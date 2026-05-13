export interface ShapeParams {
  shape: 'circle' | 'triangle' | 'square' | 'diamond' | 'airfoil';
  gridSize: number;
  canvasWidth: number;
  canvasHeight: number;
}

function IX(i: number, j: number, N: number): number {
  return i + (N + 2) * j;
}

export function rasterizeShapeToObstacles(p: ShapeParams): boolean[] {
  const N = p.gridSize;
  const size = (N + 2) * (N + 2);
  const obs = new Array<boolean>(size).fill(false);
  const cx = N / 2;
  const cy = N / 2;
  const r = N * 0.15;

  for (let j = 1; j <= N; j++) {
    for (let i = 1; i <= N; i++) {
      const x = i - cx;
      const y = j - cy;
      let inside = false;

      switch (p.shape) {
        case 'circle':
          inside = x * x + y * y <= r * r;
          break;
        case 'square':
          inside = Math.abs(x) <= r && Math.abs(y) <= r;
          break;
        case 'diamond':
          inside = Math.abs(x) + Math.abs(y) <= r * 1.2;
          break;
        case 'triangle': {
          const h = r * 1.4;
          const base = r * 1.6;
          const ty = y + h * 0.4;
          if (ty >= 0 && ty <= h) {
            const halfW = base * (1 - ty / h) / 2;
            inside = Math.abs(x) <= halfW;
          }
          break;
        }
        case 'airfoil': {
          const chord = r * 3;
          const nx = (x + chord * 0.4) / chord;
          if (nx >= 0 && nx <= 1) {
            const thickness = 0.12 * chord * (
              2.98 * Math.sqrt(nx) - 1.32 * nx - 3.286 * nx * nx + 2.441 * nx * nx * nx - 0.815 * nx * nx * nx * nx
            );
            inside = Math.abs(y) <= thickness;
          }
          break;
        }
      }

      if (inside) obs[IX(i, j, N)] = true;
    }
  }

  const dilated = [...obs];
  for (let j = 1; j <= N; j++)
    for (let i = 1; i <= N; i++)
      if (obs[IX(i, j, N)])
        for (let dj = -1; dj <= 1; dj++)
          for (let di = -1; di <= 1; di++) {
            const ni = i + di, nj = j + dj;
            if (ni >= 1 && ni <= N && nj >= 1 && nj <= N)
              dilated[IX(ni, nj, N)] = true;
          }

  return dilated;
}

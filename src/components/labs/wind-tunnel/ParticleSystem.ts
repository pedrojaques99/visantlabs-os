import type { FluidSolver } from './FluidSolver';

export class ParticleSystem {
  private maxParticles: number;
  private gridSize: number;
  private x: Float64Array;
  private y: Float64Array;
  private vx: Float64Array;
  private vy: Float64Array;
  private life: Float64Array;
  private maxLife: Float64Array;
  private speed: Float64Array;
  private trailX: Float64Array[];
  private trailY: Float64Array[];
  private trailLen: number;
  private active: number = 0;

  constructor(maxParticles: number, size: number, trailLength: number = 16) {
    this.maxParticles = maxParticles;
    this.gridSize = size;
    this.trailLen = trailLength;
    this.x = new Float64Array(maxParticles);
    this.y = new Float64Array(maxParticles);
    this.vx = new Float64Array(maxParticles);
    this.vy = new Float64Array(maxParticles);
    this.life = new Float64Array(maxParticles);
    this.maxLife = new Float64Array(maxParticles);
    this.speed = new Float64Array(maxParticles);
    this.trailX = [];
    this.trailY = [];
    for (let t = 0; t < trailLength; t++) {
      this.trailX.push(new Float64Array(maxParticles));
      this.trailY.push(new Float64Array(maxParticles));
    }
  }

  emit(x: number, y: number, count: number, baseVx: number = 0): void {
    for (let c = 0; c < count; c++) {
      if (this.active >= this.maxParticles) return;
      const idx = this.active;
      this.x[idx] = x;
      this.y[idx] = y;
      this.vx[idx] = baseVx + (Math.random() - 0.5) * baseVx * 0.3;
      this.vy[idx] = (Math.random() - 0.5) * baseVx * 0.1;
      const ml = 200 + Math.random() * 200;
      this.life[idx] = ml;
      this.maxLife[idx] = ml;
      this.speed[idx] = 0;
      for (let t = 0; t < this.trailLen; t++) {
        this.trailX[t][idx] = -1;
        this.trailY[t][idx] = -1;
      }
      this.active++;
    }
  }

  update(solver: FluidSolver, dt: number, width: number, height: number): void {
    const N = this.gridSize;
    const scaleX = width / N;
    let writeIdx = 0;

    for (let i = 0; i < this.active; i++) {
      this.life[i] -= 1;

      if (this.life[i] <= 0 || this.x[i] < -10 || this.x[i] > width + 10 || this.y[i] < -10 || this.y[i] > height + 10) {
        continue;
      }

      for (let t = this.trailLen - 1; t > 0; t--) {
        this.trailX[t][i] = this.trailX[t - 1][i];
        this.trailY[t][i] = this.trailY[t - 1][i];
      }
      this.trailX[0][i] = this.x[i];
      this.trailY[0][i] = this.y[i];

      const gi = Math.max(1, Math.min(N, Math.floor((this.x[i] / width) * N) + 1));
      const gj = Math.max(1, Math.min(N, Math.floor((this.y[i] / height) * N) + 1));
      const [fu, fv] = solver.getVelocity(gi, gj);

      this.vx[i] = this.vx[i] * 0.92 + fu * scaleX * 0.8;
      this.vy[i] = this.vy[i] * 0.92 + fv * scaleX * 0.8;

      this.x[i] += this.vx[i] * dt;
      this.y[i] += this.vy[i] * dt;

      this.speed[i] = Math.sqrt(this.vx[i] * this.vx[i] + this.vy[i] * this.vy[i]);

      if (writeIdx !== i) {
        this.x[writeIdx] = this.x[i];
        this.y[writeIdx] = this.y[i];
        this.vx[writeIdx] = this.vx[i];
        this.vy[writeIdx] = this.vy[i];
        this.life[writeIdx] = this.life[i];
        this.maxLife[writeIdx] = this.maxLife[i];
        this.speed[writeIdx] = this.speed[i];
        for (let t = 0; t < this.trailLen; t++) {
          this.trailX[t][writeIdx] = this.trailX[t][i];
          this.trailY[t][writeIdx] = this.trailY[t][i];
        }
      }
      writeIdx++;
    }
    this.active = writeIdx;
  }

  render(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    colorMode: 'velocity' | 'uniform' | 'density' | 'rainbow',
    baseColor: string,
    particleSize: number,
    solver?: FluidSolver,
    renderMode: 'particles' | 'streamlines' = 'particles'
  ): void {
    if (this.active === 0) return;

    if (renderMode === 'streamlines') {
      this.renderStreamlines(ctx, width, height, colorMode, particleSize);
    } else {
      this.renderParticles(ctx, width, height, colorMode, baseColor, particleSize);
    }
  }

  private renderParticles(
    ctx: CanvasRenderingContext2D,
    _width: number, _height: number,
    colorMode: string, baseColor: string, size: number
  ): void {
    for (let i = 0; i < this.active; i++) {
      const alpha = this.getAlpha(i);
      if (alpha < 0.02) continue;
      ctx.fillStyle = this.getColor(i, alpha, colorMode, baseColor);
      ctx.fillRect(this.x[i] - size * 0.5, this.y[i] - size * 0.5, size, size);
    }
  }

  private renderStreamlines(
    ctx: CanvasRenderingContext2D,
    _width: number, _height: number,
    colorMode: string, lineWidth: number
  ): void {
    ctx.lineWidth = Math.max(0.5, lineWidth * 0.6);
    ctx.lineCap = 'round';

    for (let i = 0; i < this.active; i++) {
      const baseAlpha = this.getAlpha(i);
      if (baseAlpha < 0.02) continue;

      let hasSegment = false;
      ctx.beginPath();
      ctx.moveTo(this.x[i], this.y[i]);

      for (let t = 0; t < this.trailLen; t++) {
        const tx = this.trailX[t][i];
        const ty = this.trailY[t][i];
        if (tx < 0) break;
        ctx.lineTo(tx, ty);
        hasSegment = true;
      }

      if (!hasSegment) continue;

      ctx.strokeStyle = this.getColor(i, baseAlpha * 0.6, colorMode, '');
      ctx.stroke();
    }
  }

  private getAlpha(i: number): number {
    const lifeRatio = this.life[i] / this.maxLife[i];
    if (lifeRatio < 0.15) return lifeRatio / 0.15;
    if (lifeRatio > 0.9) return (1 - lifeRatio) / 0.1;
    return 1;
  }

  private getColor(i: number, alpha: number, colorMode: string, baseColor: string): string {
    const maxSpeed = 150;
    const t = Math.min(this.speed[i] / maxSpeed, 1);

    if (colorMode === 'rainbow') {
      const hue = (1 - t) * 240;
      return `hsla(${hue}, 95%, ${45 + t * 15}%, ${alpha})`;
    }
    if (colorMode === 'velocity') {
      const hue = 220 - t * 220;
      return `hsla(${hue}, 85%, 55%, ${alpha})`;
    }
    if (colorMode === 'density') {
      const b = 30 + t * 50;
      return `hsla(200, 80%, ${b}%, ${alpha})`;
    }
    if (baseColor) {
      const match = baseColor.match(/[\d.]+/g);
      if (match && match.length >= 3) {
        return `rgba(${match[0]}, ${match[1]}, ${match[2]}, ${alpha})`;
      }
    }
    return `rgba(100, 180, 255, ${alpha})`;
  }

  clear(): void {
    this.active = 0;
  }

  getActiveCount(): number {
    return this.active;
  }
}

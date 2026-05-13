// Jos Stam's "Stable Fluids" (1999)

export class FluidSolver {
  private N: number;
  private size: number;
  private u: Float64Array;
  private v: Float64Array;
  private u0: Float64Array;
  private v0: Float64Array;
  private dens: Float64Array;
  private dens0: Float64Array;
  private obstacle: Uint8Array;
  private visc: number = 0.0001;
  private diff: number = 0.0001;

  constructor(N: number) {
    this.N = N;
    this.size = (N + 2) * (N + 2);
    this.u = new Float64Array(this.size);
    this.v = new Float64Array(this.size);
    this.u0 = new Float64Array(this.size);
    this.v0 = new Float64Array(this.size);
    this.dens = new Float64Array(this.size);
    this.dens0 = new Float64Array(this.size);
    this.obstacle = new Uint8Array(this.size);
  }

  private IX(i: number, j: number): number {
    return i + (this.N + 2) * j;
  }

  setViscosity(v: number): void {
    this.visc = v;
  }

  setDiffusion(d: number): void {
    this.diff = d;
  }

  addVelocity(x: number, y: number, amountX: number, amountY: number): void {
    if (x < 1 || x > this.N || y < 1 || y > this.N) return;
    const idx = this.IX(x, y);
    this.u0[idx] += amountX;
    this.v0[idx] += amountY;
  }

  addDensity(x: number, y: number, amount: number): void {
    if (x < 1 || x > this.N || y < 1 || y > this.N) return;
    this.dens0[this.IX(x, y)] += amount;
  }

  setObstacle(x: number, y: number, solid: boolean): void {
    if (x < 1 || x > this.N || y < 1 || y > this.N) return;
    this.obstacle[this.IX(x, y)] = solid ? 1 : 0;
  }

  clearObstacles(): void {
    this.obstacle.fill(0);
  }

  getVelocity(x: number, y: number): [number, number] {
    if (x < 1 || x > this.N || y < 1 || y > this.N) return [0, 0];
    const idx = this.IX(x, y);
    return [this.u[idx], this.v[idx]];
  }

  getDensity(x: number, y: number): number {
    if (x < 1 || x > this.N || y < 1 || y > this.N) return 0;
    return this.dens[this.IX(x, y)];
  }

  reset(): void {
    this.u.fill(0);
    this.v.fill(0);
    this.u0.fill(0);
    this.v0.fill(0);
    this.dens.fill(0);
    this.dens0.fill(0);
  }

  step(dt: number): void {
    this.addSource(this.u, this.u0, dt);
    this.addSource(this.v, this.v0, dt);

    for (let i = 0; i < this.size; i++) {
      if (this.obstacle[i]) { this.u[i] = 0; this.v[i] = 0; }
    }

    this.swap(this.u, this.u0);
    this.diffuse(1, this.u, this.u0, this.visc, dt);
    this.swap(this.v, this.v0);
    this.diffuse(2, this.v, this.v0, this.visc, dt);

    this.project(this.u, this.v, this.u0, this.v0);

    this.swap(this.u, this.u0);
    this.swap(this.v, this.v0);
    this.advect(1, this.u, this.u0, this.u0, this.v0, dt);
    this.advect(2, this.v, this.v0, this.u0, this.v0, dt);

    this.project(this.u, this.v, this.u0, this.v0);

    this.addSource(this.dens, this.dens0, dt);
    this.swap(this.dens, this.dens0);
    this.diffuse(0, this.dens, this.dens0, this.diff, dt);
    this.swap(this.dens, this.dens0);
    this.advect(0, this.dens, this.dens0, this.u, this.v, dt);

    this.u0.fill(0);
    this.v0.fill(0);
    this.dens0.fill(0);
  }

  private addSource(x: Float64Array, s: Float64Array, dt: number): void {
    for (let i = 0; i < this.size; i++) {
      x[i] += dt * s[i];
    }
  }

  private temp: Float64Array;

  private swap(a: Float64Array, b: Float64Array): void {
    if (!this.temp || this.temp.length !== a.length) {
      this.temp = new Float64Array(a.length);
    }
    this.temp.set(a);
    a.set(b);
    b.set(this.temp);
  }

  private setBnd(b: number, x: Float64Array): void {
    const N = this.N;
    for (let i = 1; i <= N; i++) {
      x[this.IX(0, i)] = b === 1 ? -x[this.IX(1, i)] : x[this.IX(1, i)];
      x[this.IX(N + 1, i)] = b === 1 ? -x[this.IX(N, i)] : x[this.IX(N, i)];
      x[this.IX(i, 0)] = b === 2 ? -x[this.IX(i, 1)] : x[this.IX(i, 1)];
      x[this.IX(i, N + 1)] = b === 2 ? -x[this.IX(i, N)] : x[this.IX(i, N)];
    }
    x[this.IX(0, 0)] = 0.5 * (x[this.IX(1, 0)] + x[this.IX(0, 1)]);
    x[this.IX(0, N + 1)] = 0.5 * (x[this.IX(1, N + 1)] + x[this.IX(0, N)]);
    x[this.IX(N + 1, 0)] = 0.5 * (x[this.IX(N, 0)] + x[this.IX(N + 1, 1)]);
    x[this.IX(N + 1, N + 1)] = 0.5 * (x[this.IX(N, N + 1)] + x[this.IX(N + 1, N)]);

    for (let i = 1; i <= N; i++) {
      for (let j = 1; j <= N; j++) {
        if (this.obstacle[this.IX(i, j)]) {
          if (b === 1) {
            x[this.IX(i, j)] = this.obstacle[this.IX(i - 1, j)] ? 0 : -x[this.IX(i - 1, j)];
          } else if (b === 2) {
            x[this.IX(i, j)] = this.obstacle[this.IX(i, j - 1)] ? 0 : -x[this.IX(i, j - 1)];
          } else {
            x[this.IX(i, j)] = 0;
          }
        }
      }
    }
  }

  private diffuse(b: number, x: Float64Array, x0: Float64Array, diff: number, dt: number): void {
    const N = this.N;
    const a = dt * diff * N * N;
    const denom = 1 + 4 * a;

    for (let k = 0; k < 20; k++) {
      for (let i = 1; i <= N; i++) {
        for (let j = 1; j <= N; j++) {
          if (this.obstacle[this.IX(i, j)]) {
            x[this.IX(i, j)] = 0;
            continue;
          }
          x[this.IX(i, j)] = (
            x0[this.IX(i, j)] +
            a * (
              x[this.IX(i - 1, j)] +
              x[this.IX(i + 1, j)] +
              x[this.IX(i, j - 1)] +
              x[this.IX(i, j + 1)]
            )
          ) / denom;
        }
      }
      this.setBnd(b, x);
    }
  }

  private advect(b: number, d: Float64Array, d0: Float64Array, u: Float64Array, v: Float64Array, dt: number): void {
    const N = this.N;
    const dt0 = dt * N;

    for (let i = 1; i <= N; i++) {
      for (let j = 1; j <= N; j++) {
        if (this.obstacle[this.IX(i, j)]) {
          d[this.IX(i, j)] = 0;
          continue;
        }

        let x = i - dt0 * u[this.IX(i, j)];
        let y = j - dt0 * v[this.IX(i, j)];

        if (x < 0.5) x = 0.5;
        if (x > N + 0.5) x = N + 0.5;
        if (y < 0.5) y = 0.5;
        if (y > N + 0.5) y = N + 0.5;

        const i0 = Math.floor(x);
        const i1 = i0 + 1;
        const j0 = Math.floor(y);
        const j1 = j0 + 1;

        const s1 = x - i0;
        const s0 = 1 - s1;
        const t1 = y - j0;
        const t0 = 1 - t1;

        d[this.IX(i, j)] =
          s0 * (t0 * d0[this.IX(i0, j0)] + t1 * d0[this.IX(i0, j1)]) +
          s1 * (t0 * d0[this.IX(i1, j0)] + t1 * d0[this.IX(i1, j1)]);
      }
    }
    this.setBnd(b, d);
  }

  private project(u: Float64Array, v: Float64Array, p: Float64Array, div: Float64Array): void {
    const N = this.N;
    for (let i = 1; i <= N; i++) {
      for (let j = 1; j <= N; j++) {
        if (this.obstacle[this.IX(i, j)]) {
          div[this.IX(i, j)] = 0;
          p[this.IX(i, j)] = 0;
          continue;
        }
        div[this.IX(i, j)] = -0.5 * (
          u[this.IX(i + 1, j)] - u[this.IX(i - 1, j)] +
          v[this.IX(i, j + 1)] - v[this.IX(i, j - 1)]
        ) / N;
        p[this.IX(i, j)] = 0;
      }
    }
    this.setBnd(0, div);
    this.setBnd(0, p);

    for (let k = 0; k < 20; k++) {
      for (let i = 1; i <= N; i++) {
        for (let j = 1; j <= N; j++) {
          if (this.obstacle[this.IX(i, j)]) continue;
          p[this.IX(i, j)] = (
            div[this.IX(i, j)] +
            p[this.IX(i - 1, j)] +
            p[this.IX(i + 1, j)] +
            p[this.IX(i, j - 1)] +
            p[this.IX(i, j + 1)]
          ) / 4;
        }
      }
      this.setBnd(0, p);
    }

    for (let i = 1; i <= N; i++) {
      for (let j = 1; j <= N; j++) {
        if (this.obstacle[this.IX(i, j)]) {
          u[this.IX(i, j)] = 0;
          v[this.IX(i, j)] = 0;
          continue;
        }
        u[this.IX(i, j)] -= 0.5 * N * (p[this.IX(i + 1, j)] - p[this.IX(i - 1, j)]);
        v[this.IX(i, j)] -= 0.5 * N * (p[this.IX(i, j + 1)] - p[this.IX(i, j - 1)]);
      }
    }
    this.setBnd(1, u);
    this.setBnd(2, v);
  }
}

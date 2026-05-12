import { useRef, useEffect, useCallback, useImperativeHandle, forwardRef } from 'react';
import { FluidSolver } from './FluidSolver';
import { ParticleSystem } from './ParticleSystem';
import { rasterizeTextToObstacles, autoFontSize } from './TextObstacles';
import { rasterizeShapeToObstacles } from './ShapeObstacles';

export interface WindTunnelConfig {
  obstacleType: 'text' | 'circle' | 'triangle' | 'square' | 'diamond' | 'airfoil';
  text: string;
  fontFamily: string;
  bold: boolean;
  windSpeed: number;
  viscosity: number;
  particleCount: number;
  particleSize: number;
  colorMode: 'velocity' | 'uniform' | 'density' | 'rainbow';
  renderMode: 'particles' | 'streamlines';
  baseColor: string;
  showObstacles: boolean;
  perspective: number;
}

export interface WindTunnelHandle {
  getActiveCount: () => number;
}

const GRID_SIZE = 96;
const MAX_PARTICLES = 8000;
const TRAIL_LENGTH = 16;

export const WindTunnelCanvas = forwardRef<WindTunnelHandle, { config: WindTunnelConfig }>(
  ({ config }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const solverRef = useRef<FluidSolver | null>(null);
    const particlesRef = useRef<ParticleSystem | null>(null);
    const animRef = useRef<number>(0);
    const configRef = useRef(config);
    const activeCountRef = useRef(0);
    const obstaclesRef = useRef<boolean[]>([]);
    configRef.current = config;

    useImperativeHandle(ref, () => ({
      getActiveCount: () => activeCountRef.current,
    }));

    const rebuildObstacles = useCallback((width: number, height: number) => {
      const solver = solverRef.current;
      if (!solver) return;

      const cfg = configRef.current;
      const N = GRID_SIZE;
      let obstacles: boolean[];

      if (cfg.obstacleType === 'text') {
        if (!cfg.text.trim()) {
          solver.clearObstacles();
          obstaclesRef.current = [];
          return;
        }
        const fontSize = autoFontSize(cfg.text, width, height, cfg.fontFamily);
        obstacles = rasterizeTextToObstacles({
          text: cfg.text,
          fontFamily: cfg.fontFamily,
          fontSize,
          gridSize: N,
          canvasWidth: width,
          canvasHeight: height,
          bold: cfg.bold,
        });
      } else {
        obstacles = rasterizeShapeToObstacles({
          shape: cfg.obstacleType,
          gridSize: N,
          canvasWidth: width,
          canvasHeight: height,
        });
      }

      solver.clearObstacles();
      for (let j = 1; j <= N; j++)
        for (let i = 1; i <= N; i++)
          solver.setObstacle(i, j, obstacles[i + (N + 2) * j]);

      obstaclesRef.current = obstacles;
    }, []);

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext('2d', { alpha: false })!;
      const dpr = window.devicePixelRatio || 1;
      let w = 0, h = 0;

      const resize = () => {
        const rect = canvas.getBoundingClientRect();
        w = rect.width;
        h = rect.height;
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        rebuildObstacles(w, h);
      };

      const solver = new FluidSolver(GRID_SIZE);
      const particles = new ParticleSystem(MAX_PARTICLES, GRID_SIZE, TRAIL_LENGTH);
      solverRef.current = solver;
      particlesRef.current = particles;

      resize();

      // Seed the entire canvas with particles on init
      const cfg0 = configRef.current;
      const initCount = Math.min(cfg0.particleCount, MAX_PARTICLES);
      for (let i = 0; i < initCount; i++) {
        particles.emit(Math.random() * w, Math.random() * h, 1, cfg0.windSpeed * 0.3);
      }

      // Pre-warm the solver so particles move immediately
      for (let warm = 0; warm < 30; warm++) {
        const N = GRID_SIZE;
        const wf = cfg0.windSpeed * 3;
        for (let j = 1; j <= N; j++) solver.addVelocity(1, j, wf, 0);
        solver.step(0.016);
      }

      const observer = new ResizeObserver(resize);
      observer.observe(canvas);

      let lastTime = performance.now();

      const loop = (now: number) => {
        const dt = Math.min((now - lastTime) / 1000, 0.04);
        lastTime = now;

        const cfg = configRef.current;

        solver.setViscosity(cfg.viscosity * 0.001);
        solver.setDiffusion(0.00001);

        const N = GRID_SIZE;
        const windForce = cfg.windSpeed * 5;
        for (let j = 1; j <= N; j++) {
          solver.addVelocity(1, j, windForce, (Math.random() - 0.5) * windForce * 0.03);
          // Add ambient horizontal push across the whole field
          if (j % 4 === 0) {
            for (let col = 2; col <= N; col += 8) {
              solver.addVelocity(col, j, windForce * 0.3, 0);
            }
          }
        }

        solver.step(dt);

        const target = cfg.particleCount;
        const current = particles.getActiveCount();
        if (current < target) {
          const deficit = target - current;
          const batch = Math.min(Math.ceil(deficit / 10), 100);
          for (let i = 0; i < batch; i++) {
            if (Math.random() < 0.7) {
              // 70% from left edge (wind source)
              particles.emit(0, Math.random() * h, 1, cfg.windSpeed * 0.4);
            } else {
              // 30% scattered across canvas (fill gaps)
              particles.emit(Math.random() * w * 0.3, Math.random() * h, 1, cfg.windSpeed * 0.2);
            }
          }
        }

        particles.update(solver, dt, w, h);
        activeCountRef.current = particles.getActiveCount();

        ctx.fillStyle = '#0a0a0a';
        ctx.fillRect(0, 0, w, h);

        if (cfg.showObstacles && obstaclesRef.current.length > 0) {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
          const cellW = w / N;
          const cellH = h / N;
          const obs = obstaclesRef.current;
          for (let j = 1; j <= N; j++)
            for (let i = 1; i <= N; i++)
              if (obs[i + (N + 2) * j])
                ctx.fillRect((i - 1) * cellW, (j - 1) * cellH, cellW, cellH);
        }

        particles.render(ctx, w, h, cfg.colorMode, cfg.baseColor, cfg.particleSize, solver, cfg.renderMode);

        animRef.current = requestAnimationFrame(loop);
      };

      animRef.current = requestAnimationFrame(loop);

      return () => {
        cancelAnimationFrame(animRef.current);
        observer.disconnect();
      };
    }, [rebuildObstacles]);

    const prevTextRef = useRef(config.text);
    const prevFontRef = useRef(config.fontFamily);
    const prevBoldRef = useRef(config.bold);
    const prevShapeRef = useRef(config.obstacleType);

    useEffect(() => {
      if (
        config.text !== prevTextRef.current ||
        config.fontFamily !== prevFontRef.current ||
        config.bold !== prevBoldRef.current ||
        config.obstacleType !== prevShapeRef.current
      ) {
        prevTextRef.current = config.text;
        prevFontRef.current = config.fontFamily;
        prevBoldRef.current = config.bold;
        prevShapeRef.current = config.obstacleType;
        const canvas = canvasRef.current;
        if (canvas) {
          const rect = canvas.getBoundingClientRect();
          rebuildObstacles(rect.width, rect.height);
        }
      }
    }, [config.text, config.fontFamily, config.bold, config.obstacleType, rebuildObstacles]);

    return (
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full block"
      />
    );
  }
);

WindTunnelCanvas.displayName = 'WindTunnelCanvas';

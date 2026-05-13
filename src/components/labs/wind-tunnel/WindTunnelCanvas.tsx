import { useRef, useEffect, useCallback, useImperativeHandle, forwardRef } from 'react';
import { FluidSolver } from './FluidSolver';
import { ParticleSystem } from './ParticleSystem';
import { rasterizeTextToObstacles, autoFontSize } from './TextObstacles';
import { rasterizeShapeToObstacles } from './ShapeObstacles';
import { rasterizeImageToObstacles } from './ImageObstacles';

export interface WindTunnelConfig {
  obstacleType: 'text' | 'circle' | 'triangle' | 'square' | 'diamond' | 'airfoil' | 'image';
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
  obstacleImage?: HTMLImageElement;
  paused?: boolean;
}

export interface WindTunnelHandle {
  getActiveCount: () => number;
  getFps: () => number;
  getCanvasRef: () => HTMLCanvasElement | null;
  resetSimulation: () => void;
}

const GRID_SIZE = 96;
const MAX_PARTICLES = 15000;
const TRAIL_LENGTH = 16;

export const WindTunnelCanvas = forwardRef<WindTunnelHandle, { config: WindTunnelConfig }>(
  ({ config }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const solverRef = useRef<FluidSolver | null>(null);
    const particlesRef = useRef<ParticleSystem | null>(null);
    const animRef = useRef<number>(0);
    const configRef = useRef(config);
    const activeCountRef = useRef(0);
    const fpsRef = useRef(0);
    const obstaclesRef = useRef<boolean[]>([]);
    const sizeRef = useRef({ w: 0, h: 0 });
    configRef.current = config;

    useImperativeHandle(ref, () => ({
      getActiveCount: () => activeCountRef.current,
      getFps: () => fpsRef.current,
      getCanvasRef: () => canvasRef.current,
      resetSimulation: () => {
        const solver = solverRef.current;
        const particles = particlesRef.current;
        if (!solver || !particles) return;
        solver.reset();
        particles.clear();
        const { w, h } = sizeRef.current;
        const cfg = configRef.current;
        const initCount = Math.min(cfg.particleCount, MAX_PARTICLES);
        for (let i = 0; i < initCount; i++) {
          particles.emit(Math.random() * w, Math.random() * h, 1, cfg.windSpeed * 0.3);
        }
        for (let warm = 0; warm < 30; warm++) {
          const N = GRID_SIZE;
          const wf = cfg.windSpeed * 3;
          for (let j = 1; j <= N; j++) solver.addVelocity(1, j, wf, 0);
          solver.step(0.016);
        }
      },
    }));

    const rebuildObstacles = useCallback((width: number, height: number) => {
      const solver = solverRef.current;
      if (!solver) return;

      const cfg = configRef.current;
      const N = GRID_SIZE;
      let obstacles: boolean[];

      if (cfg.obstacleType === 'image') {
        if (!cfg.obstacleImage) {
          solver.clearObstacles();
          obstaclesRef.current = [];
          return;
        }
        obstacles = rasterizeImageToObstacles(cfg.obstacleImage, N, width, height);
      } else if (cfg.obstacleType === 'text') {
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

      let resizeTimer: ReturnType<typeof setTimeout> | null = null;

      const resize = () => {
        const rect = canvas.getBoundingClientRect();
        sizeRef.current = { w: rect.width, h: rect.height };
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        rebuildObstacles(rect.width, rect.height);
      };

      const debouncedResize = () => {
        if (resizeTimer) clearTimeout(resizeTimer);
        resizeTimer = setTimeout(resize, 150);
      };

      const solver = new FluidSolver(GRID_SIZE);
      const particles = new ParticleSystem(MAX_PARTICLES, GRID_SIZE, TRAIL_LENGTH);
      solverRef.current = solver;
      particlesRef.current = particles;

      resize();

      const cfg0 = configRef.current;
      const { w, h } = sizeRef.current;
      const initCount = Math.min(cfg0.particleCount, MAX_PARTICLES);
      for (let i = 0; i < initCount; i++) {
        particles.emit(Math.random() * w, Math.random() * h, 1, cfg0.windSpeed * 0.3);
      }

      for (let warm = 0; warm < 30; warm++) {
        const N = GRID_SIZE;
        const wf = cfg0.windSpeed * 3;
        for (let j = 1; j <= N; j++) solver.addVelocity(1, j, wf, 0);
        solver.step(0.016);
      }

      const observer = new ResizeObserver(debouncedResize);
      observer.observe(canvas);

      let lastTime = performance.now();
      let frameCount = 0;
      let fpsAccum = 0;

      const loop = (now: number) => {
        const dt = Math.min((now - lastTime) / 1000, 0.04);
        lastTime = now;

        frameCount++;
        fpsAccum += dt;
        if (fpsAccum >= 0.5) {
          fpsRef.current = Math.round(frameCount / fpsAccum);
          frameCount = 0;
          fpsAccum = 0;
        }

        const cfg = configRef.current;
        const { w: cw, h: ch } = sizeRef.current;

        if (!cfg.paused) {
          solver.setViscosity(cfg.viscosity * 0.001);
          solver.setDiffusion(0.00001);

          const N = GRID_SIZE;
          const windForce = cfg.windSpeed * 5;
          for (let j = 1; j <= N; j++) {
            solver.addVelocity(1, j, windForce, (Math.random() - 0.5) * windForce * 0.03);
            if (j % 4 === 0) {
              for (let col = 2; col <= N; col += 8) {
                solver.addVelocity(col, j, windForce * 0.3, 0);
              }
            }
          }

          solver.step(dt);

          const target = Math.min(cfg.particleCount, MAX_PARTICLES);
          const current = particles.getActiveCount();
          if (current < target) {
            const deficit = target - current;
            const batch = Math.min(Math.ceil(deficit / 10), 100);
            for (let i = 0; i < batch; i++) {
              if (Math.random() < 0.7) {
                particles.emit(0, Math.random() * ch, 1, cfg.windSpeed * 0.4);
              } else {
                particles.emit(Math.random() * cw * 0.3, Math.random() * ch, 1, cfg.windSpeed * 0.2);
              }
            }
          }

          particles.update(solver, dt, cw, ch);
        }

        activeCountRef.current = particles.getActiveCount();

        ctx.fillStyle = '#0a0a0a';
        ctx.fillRect(0, 0, cw, ch);

        const perspective = cfg.perspective / 100;
        if (perspective > 0) {
          ctx.save();
          const cx = cw / 2;
          const cy = ch / 2;
          ctx.translate(cx, cy);
          const skewX = perspective * 0.15;
          const scaleY = 1 - perspective * 0.25;
          ctx.transform(1, skewX * 0.3, 0, scaleY, 0, perspective * cy * 0.15);
          ctx.translate(-cx, -cy);
        }

        if (cfg.showObstacles && obstaclesRef.current.length > 0) {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
          const N = GRID_SIZE;
          const cellW = cw / N;
          const cellH = ch / N;
          const obs = obstaclesRef.current;
          for (let j = 1; j <= N; j++)
            for (let i = 1; i <= N; i++)
              if (obs[i + (N + 2) * j])
                ctx.fillRect((i - 1) * cellW, (j - 1) * cellH, cellW, cellH);
        }

        particles.render(ctx, cw, ch, cfg.colorMode, cfg.baseColor, cfg.particleSize, solver, cfg.renderMode);

        if (perspective > 0) {
          ctx.restore();
        }

        animRef.current = requestAnimationFrame(loop);
      };

      animRef.current = requestAnimationFrame(loop);

      return () => {
        cancelAnimationFrame(animRef.current);
        observer.disconnect();
        if (resizeTimer) clearTimeout(resizeTimer);
      };
    }, [rebuildObstacles]);

    const prevTextRef = useRef(config.text);
    const prevFontRef = useRef(config.fontFamily);
    const prevBoldRef = useRef(config.bold);
    const prevShapeRef = useRef(config.obstacleType);
    const prevImageRef = useRef(config.obstacleImage);

    useEffect(() => {
      if (
        config.text !== prevTextRef.current ||
        config.fontFamily !== prevFontRef.current ||
        config.bold !== prevBoldRef.current ||
        config.obstacleType !== prevShapeRef.current ||
        config.obstacleImage !== prevImageRef.current
      ) {
        prevTextRef.current = config.text;
        prevFontRef.current = config.fontFamily;
        prevBoldRef.current = config.bold;
        prevShapeRef.current = config.obstacleType;
        prevImageRef.current = config.obstacleImage;
        const canvas = canvasRef.current;
        if (canvas) {
          const rect = canvas.getBoundingClientRect();
          rebuildObstacles(rect.width, rect.height);
        }
      }
    }, [config.text, config.fontFamily, config.bold, config.obstacleType, config.obstacleImage, rebuildObstacles]);

    return (
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full block"
      />
    );
  }
);

WindTunnelCanvas.displayName = 'WindTunnelCanvas';

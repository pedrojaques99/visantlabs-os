import { useRef, useEffect, useCallback, useImperativeHandle, forwardRef } from 'react';
import { FluidSolver } from './FluidSolver';
import { ParticleSystem } from './ParticleSystem';
import { rasterizeTextToObstacles, autoFontSize } from './TextObstacles';
import { rasterizeShapeToObstacles } from './ShapeObstacles';
import { rasterizeImageToObstacles, type ImageTransform } from './ImageObstacles';

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
  obstacleScale: number;
  obstacleOffsetX: number;
  obstacleOffsetY: number;
  bgColor: string;
  showGrid: boolean;
  glowIntensity: number;
  particleLifetime: number;
  trailLength: number;
  spread: number;
}

export interface WindTunnelHandle {
  getActiveCount: () => number;
  getFps: () => number;
  getCanvasRef: () => HTMLCanvasElement | null;
  resetSimulation: () => void;
  exportAtResolution: (multiplier: number) => string | null;
}

interface TouchState {
  startX: number;
  startY: number;
  startOffsetX: number;
  startOffsetY: number;
  startDist: number;
  startScale: number;
}

function renderObstacleOverlay(
  ctx: CanvasRenderingContext2D, cw: number, ch: number, cfg: WindTunnelConfig
) {
  ctx.save();
  ctx.globalAlpha = 0.04;
  ctx.fillStyle = '#fff';

  const scale = cfg.obstacleScale / 100;
  const ox = cfg.obstacleOffsetX / 100 * cw;
  const oy = cfg.obstacleOffsetY / 100 * ch;

  if (cfg.obstacleType === 'image' && cfg.obstacleImage) {
    const img = cfg.obstacleImage;
    const s = scale * 0.6;
    const aspect = img.naturalWidth / img.naturalHeight;
    const canvasAspect = cw / ch;
    let dw: number, dh: number;
    if (aspect > canvasAspect) { dw = cw * s; dh = dw / aspect; }
    else { dh = ch * s; dw = dh * aspect; }
    ctx.globalAlpha = 0.06;
    ctx.drawImage(img, (cw - dw) / 2 + ox, (ch - dh) / 2 + oy, dw, dh);
  } else if (cfg.obstacleType === 'text' && cfg.text.trim()) {
    const weight = cfg.bold ? 'bold ' : '';
    const target = cw * 0.6 * scale;
    let size = Math.floor((target / cfg.text.length) * 1.5);
    ctx.font = `${size}px ${cfg.fontFamily}`;
    const measured = ctx.measureText(cfg.text).width;
    size = Math.floor(size * (target / measured));
    size = Math.min(size, Math.floor(ch * 0.8 * scale));
    ctx.font = `${weight}${size}px ${cfg.fontFamily}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(cfg.text, cw / 2 + ox, ch / 2 + oy);
  } else if (cfg.obstacleType !== 'text' && cfg.obstacleType !== 'image') {
    const cx = cw / 2 + ox, cy = ch / 2 + oy;
    const minDim = Math.min(cw, ch);
    const rPixels = minDim * 0.15 * scale;
    const rx = rPixels;
    const ry = rPixels;
    ctx.beginPath();
    switch (cfg.obstacleType) {
      case 'circle':
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        break;
      case 'square':
        ctx.rect(cx - rx, cy - ry, rx * 2, ry * 2);
        break;
      case 'diamond':
        ctx.moveTo(cx, cy - ry * 1.2); ctx.lineTo(cx + rx * 1.2, cy);
        ctx.lineTo(cx, cy + ry * 1.2); ctx.lineTo(cx - rx * 1.2, cy);
        ctx.closePath();
        break;
      case 'triangle': {
        const h = ry * 1.4;
        const base = rx * 1.6;
        ctx.moveTo(cx, cy - h * 0.6);
        ctx.lineTo(cx + base, cy + h * 0.4);
        ctx.lineTo(cx - base, cy + h * 0.4);
        ctx.closePath();
        break;
      }
      case 'airfoil': {
        const chord = rx * 3;
        ctx.moveTo(cx - chord * 0.4, cy);
        for (let t = 0; t <= 1; t += 0.02) {
          const x = cx - chord * 0.4 + t * chord;
          const thickness = 0.12 * ry * 3 * (
            2.98 * Math.sqrt(t) - 1.32 * t - 3.286 * t * t + 2.441 * t * t * t - 0.815 * t * t * t * t
          );
          ctx.lineTo(x, cy - thickness);
        }
        for (let t = 1; t >= 0; t -= 0.02) {
          const x = cx - chord * 0.4 + t * chord;
          const thickness = 0.12 * ry * 3 * (
            2.98 * Math.sqrt(t) - 1.32 * t - 3.286 * t * t + 2.441 * t * t * t - 0.815 * t * t * t * t
          );
          ctx.lineTo(x, cy + thickness);
        }
        ctx.closePath();
        break;
      }
    }
    ctx.fill();
  }
  ctx.restore();
}

function renderBackgroundGrid(ctx: CanvasRenderingContext2D, cw: number, ch: number) {
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
  ctx.lineWidth = 0.5;
  const step = 40;
  for (let x = step; x < cw; x += step) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, ch); ctx.stroke();
  }
  for (let y = step; y < ch; y += step) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(cw, y); ctx.stroke();
  }
  ctx.restore();
}

const GRID_SIZE = 160;
const MAX_PARTICLES = 15000;
const TRAIL_LENGTH = 16;

export const WindTunnelCanvas = forwardRef<WindTunnelHandle, {
  config: WindTunnelConfig;
  onConfigChange?: (partial: Partial<WindTunnelConfig>) => void;
}>(
  ({ config, onConfigChange }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const solverRef = useRef<FluidSolver | null>(null);
    const particlesRef = useRef<ParticleSystem | null>(null);
    const animRef = useRef<number>(0);
    const configRef = useRef(config);
    const activeCountRef = useRef(0);
    const fpsRef = useRef(0);
    const obstaclesRef = useRef<boolean[]>([]);
    const sizeRef = useRef({ w: 0, h: 0 });
    const glowCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const touchRef = useRef<TouchState | null>(null);
    configRef.current = config;

    useImperativeHandle(ref, () => ({
      getActiveCount: () => activeCountRef.current,
      getFps: () => fpsRef.current,
      getCanvasRef: () => canvasRef.current,
      exportAtResolution: (multiplier: number) => {
        const srcCanvas = canvasRef.current;
        if (!srcCanvas) return null;
        const { w, h } = sizeRef.current;
        const expW = Math.round(w * multiplier);
        const expH = Math.round(h * multiplier);
        const offscreen = document.createElement('canvas');
        offscreen.width = expW;
        offscreen.height = expH;
        const oc = offscreen.getContext('2d')!;
        oc.scale(multiplier, multiplier);
        const cfg = configRef.current;
        oc.fillStyle = cfg.bgColor || '#0a0a0a';
        oc.fillRect(0, 0, w, h);
        if (cfg.showGrid) renderBackgroundGrid(oc, w, h);
        const perspective = cfg.perspective / 100;
        if (perspective > 0) {
          oc.save();
          const cx = w / 2, cy = h / 2;
          oc.translate(cx, cy);
          oc.transform(1, perspective * 0.15 * 0.3, 0, 1 - perspective * 0.25, 0, perspective * cy * 0.15);
          oc.translate(-cx, -cy);
        }
        if (cfg.showObstacles) renderObstacleOverlay(oc, w, h, cfg);
        const glow = cfg.glowIntensity;
        const solver = solverRef.current;
        const particles = particlesRef.current;
        if (particles && solver) {
          if (glow > 0) {
            const gc = document.createElement('canvas');
            gc.width = expW; gc.height = expH;
            const gctx = gc.getContext('2d')!;
            gctx.scale(multiplier, multiplier);
            particles.render(gctx, w, h, cfg.colorMode, cfg.baseColor, cfg.particleSize, solver, cfg.renderMode);
            oc.filter = `blur(${glow * multiplier}px)`;
            oc.globalAlpha = 0.6;
            oc.drawImage(gc, 0, 0);
            oc.filter = 'none';
            oc.globalAlpha = 1;
          }
          particles.render(oc, w, h, cfg.colorMode, cfg.baseColor, cfg.particleSize, solver, cfg.renderMode);
        }
        if (perspective > 0) oc.restore();
        oc.save();
        oc.globalAlpha = 0.08;
        oc.fillStyle = '#fff';
        oc.font = `${9}px Manrope, sans-serif`;
        oc.textAlign = 'right';
        oc.textBaseline = 'bottom';
        oc.fillText('VSN LABS', w - 8, h - 6);
        oc.restore();
        return offscreen.toDataURL('image/png');
      },
      resetSimulation: () => {
        const solver = solverRef.current;
        const particles = particlesRef.current;
        if (!solver || !particles) return;
        solver.reset();
        particles.clear();
        const { w, h } = sizeRef.current;
        const cfg = configRef.current;
        particles.setTrailLength(cfg.trailLength);
        const initCount = Math.min(cfg.particleCount, MAX_PARTICLES);
        for (let i = 0; i < initCount; i++) {
          particles.emit(Math.random() * w, Math.random() * h, 1, cfg.windSpeed * 0.3, cfg.particleLifetime, cfg.spread);
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

      const transform: ImageTransform = {
        scale: cfg.obstacleScale / 100,
        offsetX: cfg.obstacleOffsetX / 100,
        offsetY: cfg.obstacleOffsetY / 100,
      };

      if (cfg.obstacleType === 'image') {
        if (!cfg.obstacleImage) {
          solver.clearObstacles();
          obstaclesRef.current = [];
          return;
        }
        obstacles = rasterizeImageToObstacles(cfg.obstacleImage, N, width, height, transform);
      } else if (cfg.obstacleType === 'text') {
        if (!cfg.text.trim()) {
          solver.clearObstacles();
          obstaclesRef.current = [];
          return;
        }
        const fontSize = autoFontSize(cfg.text, width, height, cfg.fontFamily, transform.scale);
        obstacles = rasterizeTextToObstacles({
          text: cfg.text,
          fontFamily: cfg.fontFamily,
          fontSize,
          gridSize: N,
          canvasWidth: width,
          canvasHeight: height,
          bold: cfg.bold,
          offsetX: transform.offsetX,
          offsetY: transform.offsetY,
        });
      } else {
        obstacles = rasterizeShapeToObstacles({
          shape: cfg.obstacleType,
          gridSize: N,
          canvasWidth: width,
          canvasHeight: height,
          scale: transform.scale,
          offsetX: transform.offsetX,
          offsetY: transform.offsetY,
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
        particles.emit(Math.random() * w, Math.random() * h, 1, cfg0.windSpeed * 0.3, cfg0.particleLifetime, cfg0.spread);
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
          particles.setTrailLength(cfg.trailLength);
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

          // Von Kármán vortex shedding — periodic perturbation behind obstacles
          const vortexPhase = (now * 0.003) % (Math.PI * 2);
          const vortexAmp = windForce * 0.15;
          const obs = obstaclesRef.current;
          if (obs.length > 0) {
            for (let j = 2; j < N; j++) {
              for (let i = 2; i < N; i++) {
                if (obs[i - 1 + (N + 2) * j] && !obs[i + (N + 2) * j]) {
                  const offset = Math.sin(vortexPhase + j * 0.4) * vortexAmp;
                  solver.addVelocity(i, j, 0, offset);
                  if (i + 1 <= N) solver.addVelocity(i + 1, j, 0, offset * 0.5);
                }
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
                particles.emit(0, Math.random() * ch, 1, cfg.windSpeed * 0.4, cfg.particleLifetime, cfg.spread);
              } else {
                particles.emit(Math.random() * cw * 0.3, Math.random() * ch, 1, cfg.windSpeed * 0.2, cfg.particleLifetime, cfg.spread);
              }
            }
          }

          particles.update(solver, dt, cw, ch);
        }

        activeCountRef.current = particles.getActiveCount();

        ctx.fillStyle = cfg.bgColor || '#0a0a0a';
        ctx.fillRect(0, 0, cw, ch);

        if (cfg.showGrid) {
          renderBackgroundGrid(ctx, cw, ch);
        }

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

        if (cfg.showObstacles) {
          renderObstacleOverlay(ctx, cw, ch, cfg);
        }

        const glow = cfg.glowIntensity;

        if (glow > 0) {
          if (!glowCanvasRef.current || glowCanvasRef.current.width !== cw || glowCanvasRef.current.height !== ch) {
            glowCanvasRef.current = document.createElement('canvas');
            glowCanvasRef.current.width = cw;
            glowCanvasRef.current.height = ch;
          }
          const gc = glowCanvasRef.current.getContext('2d')!;
          gc.clearRect(0, 0, cw, ch);
          particles.render(gc, cw, ch, cfg.colorMode, cfg.baseColor, cfg.particleSize, solver, cfg.renderMode);
          ctx.filter = `blur(${glow}px)`;
          ctx.globalAlpha = 0.6;
          ctx.drawImage(glowCanvasRef.current, 0, 0);
          ctx.filter = 'none';
          ctx.globalAlpha = 1;
        }

        particles.render(ctx, cw, ch, cfg.colorMode, cfg.baseColor, cfg.particleSize, solver, cfg.renderMode);

        if (perspective > 0) {
          ctx.restore();
        }

        // Watermark
        ctx.save();
        ctx.globalAlpha = 0.08;
        ctx.fillStyle = '#fff';
        ctx.font = '9px Manrope, sans-serif';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'bottom';
        ctx.fillText('VSN LABS', cw - 8, ch - 6);
        ctx.restore();

        animRef.current = requestAnimationFrame(loop);
      };

      animRef.current = requestAnimationFrame(loop);

      return () => {
        cancelAnimationFrame(animRef.current);
        observer.disconnect();
        if (resizeTimer) clearTimeout(resizeTimer);
        glowCanvasRef.current = null;
      };
    }, [rebuildObstacles]);

    const prevTextRef = useRef(config.text);
    const prevFontRef = useRef(config.fontFamily);
    const prevBoldRef = useRef(config.bold);
    const prevShapeRef = useRef(config.obstacleType);
    const prevImageRef = useRef(config.obstacleImage);
    const prevScaleRef = useRef(config.obstacleScale);
    const prevOxRef = useRef(config.obstacleOffsetX);
    const prevOyRef = useRef(config.obstacleOffsetY);

    useEffect(() => {
      if (
        config.text !== prevTextRef.current ||
        config.fontFamily !== prevFontRef.current ||
        config.bold !== prevBoldRef.current ||
        config.obstacleType !== prevShapeRef.current ||
        config.obstacleImage !== prevImageRef.current ||
        config.obstacleScale !== prevScaleRef.current ||
        config.obstacleOffsetX !== prevOxRef.current ||
        config.obstacleOffsetY !== prevOyRef.current
      ) {
        prevTextRef.current = config.text;
        prevFontRef.current = config.fontFamily;
        prevBoldRef.current = config.bold;
        prevShapeRef.current = config.obstacleType;
        prevImageRef.current = config.obstacleImage;
        prevScaleRef.current = config.obstacleScale;
        prevOxRef.current = config.obstacleOffsetX;
        prevOyRef.current = config.obstacleOffsetY;
        const canvas = canvasRef.current;
        if (canvas) {
          const rect = canvas.getBoundingClientRect();
          rebuildObstacles(rect.width, rect.height);
        }
      }
    }, [config.text, config.fontFamily, config.bold, config.obstacleType, config.obstacleImage, config.obstacleScale, config.obstacleOffsetX, config.obstacleOffsetY, rebuildObstacles]);

    const handleTouchStart = useCallback((e: React.TouchEvent) => {
      if (!onConfigChange) return;
      if (e.touches.length === 1) {
        const t = e.touches[0];
        touchRef.current = {
          startX: t.clientX, startY: t.clientY,
          startOffsetX: configRef.current.obstacleOffsetX,
          startOffsetY: configRef.current.obstacleOffsetY,
          startDist: 0, startScale: configRef.current.obstacleScale,
        };
      } else if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        touchRef.current = {
          startX: 0, startY: 0,
          startOffsetX: configRef.current.obstacleOffsetX,
          startOffsetY: configRef.current.obstacleOffsetY,
          startDist: dist, startScale: configRef.current.obstacleScale,
        };
      }
    }, [onConfigChange]);

    const handleTouchMove = useCallback((e: React.TouchEvent) => {
      if (!onConfigChange || !touchRef.current) return;
      e.preventDefault();
      const { w, h } = sizeRef.current;
      if (e.touches.length === 1 && touchRef.current.startDist === 0) {
        const t = e.touches[0];
        const deltaX = ((t.clientX - touchRef.current.startX) / w) * 100;
        const deltaY = ((t.clientY - touchRef.current.startY) / h) * 100;
        onConfigChange({
          obstacleOffsetX: Math.max(-50, Math.min(50, touchRef.current.startOffsetX + deltaX)),
          obstacleOffsetY: Math.max(-50, Math.min(50, touchRef.current.startOffsetY + deltaY)),
        });
      } else if (e.touches.length === 2 && touchRef.current.startDist > 0) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const ratio = dist / touchRef.current.startDist;
        onConfigChange({
          obstacleScale: Math.max(10, Math.min(250, touchRef.current.startScale * ratio)),
        });
      }
    }, [onConfigChange]);

    const handleTouchEnd = useCallback(() => {
      touchRef.current = null;
    }, []);

    return (
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full block touch-none"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
      />
    );
  }
);

WindTunnelCanvas.displayName = 'WindTunnelCanvas';

import { useRef, useEffect } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import type { Group } from 'three';

export const introComplete = { current: false };

interface IntroAnimationProps {
  type: 'none' | 'zoom' | 'fade';
  duration: number;
  from: { zoom?: number; opacity?: number };
  to: { zoom?: number; opacity?: number };
  onComplete?: () => void;
}

export function IntroAnimation({ type, duration, from, to, onComplete }: IntroAnimationProps) {
  const { camera, gl } = useThree();
  const progress = useRef(0);
  const initialized = useRef(false);
  const completeFired = useRef(false);

  if (!initialized.current && type !== 'none') {
    initialized.current = true;
    introComplete.current = false;
    camera.position.z = from.zoom ?? 18;
    gl.domElement.style.opacity = String(from.opacity ?? 0);
  }
  if (type === 'none' && !initialized.current) {
    initialized.current = true;
    introComplete.current = true;
    camera.position.z = to.zoom ?? 8;
    gl.domElement.style.opacity = '1';
  }

  useFrame((_, delta) => {
    if (type === 'none' || progress.current >= 1) return;
    progress.current = Math.min(1, progress.current + delta / duration);
    const t = 1 - Math.pow(1 - progress.current, 4);
    const fromZ = from.zoom ?? 18;
    const toZ = to.zoom ?? 8;
    const fromOpacity = from.opacity ?? 0;
    const toOpacity = to.opacity ?? 1;

    if (type === 'zoom') {
      camera.position.z = fromZ + (toZ - fromZ) * t;
      gl.domElement.style.opacity = String(fromOpacity + (toOpacity - fromOpacity) * Math.min(1, t * 1.5));
    } else if (type === 'fade') {
      camera.position.z = toZ;
      gl.domElement.style.opacity = String(fromOpacity + (toOpacity - fromOpacity) * t);
    }

    if (progress.current >= 1) {
      introComplete.current = true;
      gl.domElement.style.opacity = '1';
      camera.position.z = toZ;
      if (!completeFired.current) {
        completeFired.current = true;
        onComplete?.();
      }
    }
  });

  return null;
}

type AnimationType = 'none' | 'spin' | 'float' | 'pulse' | 'wobble' | 'swing' | 'spinFloat' | 'physicsFall';
type EasingType = 'linear' | 'easeIn' | 'easeOut' | 'easeInOut';

interface LoopAnimationProps {
  type: AnimationType;
  speed: number;
  reverse: boolean;
  easing: EasingType;
  meshRef: React.RefObject<Group | null>;
}

const easings = {
  linear: (t: number) => t,
  easeIn: (t: number) => t * t,
  easeOut: (t: number) => t * (2 - t),
  easeInOut: (t: number) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
};

export function LoopAnimation({ type, speed, reverse, easing, meshRef }: LoopAnimationProps) {
  const elapsed = useRef(0);
  const initialY = useRef<number | null>(null);
  const dir = reverse ? -1 : 1;

  useFrame((_, delta) => {
    if (type === 'none' || !meshRef.current) return;
    elapsed.current += delta * speed;
    
    // Period is usually 2*PI for sin-based, or we can just use 1.0 as a cycle for ease
    const cycle = 2 * Math.PI;
    const rawT = elapsed.current;
    const normalizedT = (rawT % cycle) / cycle;
    const easedT = easings[easing](normalizedT) * cycle;
    
    // For cumulative animations like spin, we need to handle the jumps at cycle boundaries
    // or just apply easing to the delta? No, easing the phase is better for loops.
    // However, for 'spin', normalizedT jumping from 1.0 to 0.0 will cause a backward jump.
    // To avoid this, we can add the number of full cycles back.
    const fullCycles = Math.floor(rawT / cycle);
    const t = (fullCycles * cycle) + easedT;

    if (initialY.current === null) {
      initialY.current = meshRef.current.position.y;
    }

    switch (type) {
      case 'spin':
        // For spin, we use the eased t directly for rotation
        meshRef.current.rotation.y = t * 0.5 * dir;
        break;
      case 'float':
        meshRef.current.position.y = initialY.current + Math.sin(t * 1.5) * 0.3;
        break;
      case 'pulse': {
        const pulse = 1 + Math.sin(t * 2) * 0.05;
        meshRef.current.scale.set(pulse, pulse, pulse);
        break;
      }
      case 'wobble':
        meshRef.current.rotation.z = Math.sin(t * 2) * 0.1 * dir;
        break;
      case 'swing':
        meshRef.current.rotation.y = Math.sin(t * 1.5) * 0.26 * dir;
        break;
      case 'spinFloat':
        meshRef.current.rotation.y = t * 0.4 * dir;
        meshRef.current.position.y = initialY.current + Math.sin(t * 1.2) * 0.25;
        break;
    }
  });

  return null;
}

interface SmoothControlsProps {
  rotationX: number;
  rotationY: number;
  meshRef: React.RefObject<Group | null>;
  cursorOrbit: boolean;
  orbitStrength: number;
  draggable: boolean;
  scrollZoom: boolean;
  zoom: number;
  resetOnIdle: boolean;
  resetDelay: number;
  resetKey?: number;
}

export function SmoothControls({
  rotationX, rotationY, meshRef, cursorOrbit, orbitStrength,
  draggable, scrollZoom, zoom, resetOnIdle, resetDelay, resetKey,
}: SmoothControlsProps) {
  const { gl, camera } = useThree();
  const isDragging = useRef(false);
  const isPanning = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });
  const baseRotation = useRef({ x: rotationX, y: rotationY });
  const targetRotation = useRef({ x: rotationX, y: rotationY });
  const targetZoom = useRef(zoom);
  const panOffset = useRef({ x: 0, y: 0 });
  const targetPan = useRef({ x: 0, y: 0 });
  const velocity = useRef({ x: 0, y: 0 });
  const cursorOffset = useRef({ x: 0, y: 0 });
  const lastInteraction = useRef(performance.now());
  const isResetting = useRef(false);
  const cursorInWindow = useRef(true);

  const damping = 0.08;
  const friction = 0.92;
  const orbitDamping = 0.04;
  const resetDamping = 0.03;

  const markActive = () => {
    lastInteraction.current = performance.now();
    isResetting.current = false;
  };

  useEffect(() => {
    baseRotation.current = { x: rotationX, y: rotationY };
    targetRotation.current = { x: rotationX, y: rotationY };
    velocity.current = { x: 0, y: 0 };
    targetPan.current = { x: 0, y: 0 };
  }, [rotationX, rotationY, resetKey]);

  useEffect(() => { targetZoom.current = zoom; }, [zoom]);

  useFrame(() => {
    if (!meshRef.current) return;

    let resetting = false;
    if (resetOnIdle && introComplete.current) {
      const idle = performance.now() - lastInteraction.current;
      resetting = !isDragging.current && (!cursorInWindow.current || idle > resetDelay * 1e3);
    }

    if (!isDragging.current && !resetting) {
      velocity.current.x *= friction;
      velocity.current.y *= friction;
      if (Math.abs(velocity.current.x) > 1e-4 || Math.abs(velocity.current.y) > 1e-4) {
        baseRotation.current.x += velocity.current.x;
        baseRotation.current.y += velocity.current.y;
      }
    }

    if (resetting) {
      velocity.current = { x: 0, y: 0 };
      baseRotation.current.x += (rotationX - baseRotation.current.x) * resetDamping;
      baseRotation.current.y += (rotationY - baseRotation.current.y) * resetDamping;
      cursorOffset.current.x += (0 - cursorOffset.current.x) * resetDamping;
      cursorOffset.current.y += (0 - cursorOffset.current.y) * resetDamping;
      targetZoom.current += (zoom - targetZoom.current) * resetDamping;
      targetPan.current.x += (0 - targetPan.current.x) * resetDamping;
      targetPan.current.y += (0 - targetPan.current.y) * resetDamping;
    }

    targetRotation.current.x = baseRotation.current.x + (cursorOrbit ? cursorOffset.current.x : 0);
    targetRotation.current.y = baseRotation.current.y + (cursorOrbit ? cursorOffset.current.y : 0);

    const cur = meshRef.current.rotation;
    cur.x += (targetRotation.current.x - cur.x) * (cursorOrbit && !isDragging.current ? orbitDamping : damping);
    cur.y += (targetRotation.current.y - cur.y) * (cursorOrbit && !isDragging.current ? orbitDamping : damping);

    if (introComplete.current) {
      const aspect = gl.domElement.clientWidth / (gl.domElement.clientHeight || 1);
      const responsiveFactor = aspect < 1 ? 1 / aspect : 1;
      camera.position.z += (targetZoom.current * responsiveFactor - camera.position.z) * damping;
    }

    panOffset.current.x += (targetPan.current.x - panOffset.current.x) * damping;
    panOffset.current.y += (targetPan.current.y - panOffset.current.y) * damping;
    camera.position.x = panOffset.current.x;
    camera.position.y = panOffset.current.y;
  });

  useEffect(() => {
    if (!resetOnIdle) return;
    const onDocLeave = () => { cursorInWindow.current = false; };
    const onDocEnter = () => { cursorInWindow.current = true; markActive(); };
    document.addEventListener('mouseleave', onDocLeave);
    document.addEventListener('mouseenter', onDocEnter);
    return () => {
      document.removeEventListener('mouseleave', onDocLeave);
      document.removeEventListener('mouseenter', onDocEnter);
    };
  }, [resetOnIdle]);

  useEffect(() => {
    if (!cursorOrbit) { cursorOffset.current = { x: 0, y: 0 }; return; }
    const onMouseMove = (e: MouseEvent) => {
      if (isDragging.current) return;
      if (resetOnIdle) markActive();
      const nx = (e.clientX / window.innerWidth - 0.5) * 2;
      const ny = (e.clientY / window.innerHeight - 0.5) * 2;
      cursorOffset.current = { x: ny * orbitStrength, y: nx * orbitStrength };
    };
    window.addEventListener('mousemove', onMouseMove);
    return () => window.removeEventListener('mousemove', onMouseMove);
  }, [cursorOrbit, orbitStrength, resetOnIdle]);

  useEffect(() => {
    const canvas = gl.domElement;
    const activeTouches = new Set<number>();
    const isPinching = () => activeTouches.size >= 2;

    const setCursor = (c: string) => { canvas.style.cursor = c; };
    if (draggable) setCursor('grab');

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Shift' && !isDragging.current) setCursor('move');
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift' && !isDragging.current) setCursor('grab');
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    const onPointerDown = (e: PointerEvent) => {
      activeTouches.add(e.pointerId);
      if (!draggable || isPinching()) return;
      isDragging.current = true;
      isPanning.current = e.shiftKey || e.button === 1;
      lastPos.current = { x: e.clientX, y: e.clientY };
      velocity.current = { x: 0, y: 0 };
      canvas.setPointerCapture(e.pointerId);
      setCursor(isPanning.current ? 'move' : 'grabbing');
      if (resetOnIdle) markActive();
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!isDragging.current || isPinching()) return;
      const dx = e.clientX - lastPos.current.x;
      const dy = e.clientY - lastPos.current.y;
      lastPos.current = { x: e.clientX, y: e.clientY };
      if (isPanning.current || e.shiftKey) {
        if (!isPanning.current) { isPanning.current = true; setCursor('move'); }
        const panSensitivity = 0.01 * (camera.position.z / 8);
        targetPan.current.x -= dx * panSensitivity;
        targetPan.current.y += dy * panSensitivity;
      } else {
        const sensitivity = 0.01;
        baseRotation.current.x += dy * sensitivity;
        baseRotation.current.y += dx * sensitivity;
        velocity.current = { x: dy * sensitivity, y: dx * sensitivity };
      }
    };
    const onPointerUp = (e: PointerEvent) => {
      activeTouches.delete(e.pointerId);
      if (!isDragging.current) return;
      if (activeTouches.size > 0) velocity.current = { x: 0, y: 0 };
      isDragging.current = false;
      isPanning.current = false;
      canvas.releasePointerCapture(e.pointerId);
      setCursor(e.shiftKey ? 'move' : 'grab');
      if (resetOnIdle) markActive();
    };
    const onWheel = (e: WheelEvent) => {
      if (!scrollZoom) return;
      e.preventDefault();
      targetZoom.current = Math.max(2, Math.min(20, targetZoom.current + e.deltaY * 0.01));
      if (resetOnIdle) markActive();
    };

    let lastPinchDist = 0;
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        lastPinchDist = Math.sqrt(dx * dx + dy * dy);
      }
    };
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && scrollZoom) {
        e.preventDefault();
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const delta = lastPinchDist - dist;
        targetZoom.current = Math.max(2, Math.min(20, targetZoom.current + delta * 0.03));
        lastPinchDist = dist;
        if (resetOnIdle) markActive();
      }
    };

    const onContextMenu = (e: MouseEvent) => e.preventDefault();
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('contextmenu', onContextMenu);
    if (scrollZoom) {
      canvas.addEventListener('wheel', onWheel, { passive: false });
      canvas.addEventListener('touchstart', onTouchStart, { passive: false });
      canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    }
    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('contextmenu', onContextMenu);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      canvas.style.cursor = '';
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove', onTouchMove);
    };
  }, [gl, draggable, scrollZoom, resetOnIdle]);

  return null;
}

import { useRef, useEffect, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { CameraControls, GizmoHelper, GizmoViewport } from '@react-three/drei';
import { useStudio3DStore } from '@/stores/studio3dStore';
import type CameraControlsImpl from 'camera-controls';

const CAMERA_VIEWS: Record<string, { position: [number, number, number]; target: [number, number, number] }> = {
  front: { position: [0, 0, 10], target: [0, 0, 0] },
  back: { position: [0, 0, -10], target: [0, 0, 0] },
  top: { position: [0, 10, 0], target: [0, 0, 0] },
  right: { position: [10, 0, 0], target: [0, 0, 0] },
  iso: { position: [7, 5, 7], target: [0, 0, 0] },
};

const toDeg = (r: number) => Math.round((r * 180) / Math.PI);
const DEG15 = (15 * Math.PI) / 180;
const THROTTLE_MS = 100;

export function CameraBridge() {
  const controlsRef = useRef<CameraControlsImpl>(null);
  const lastUpdate = useRef(0);
  const lastPolar = useRef(0);
  const lastAzimuth = useRef(0);
  const lastDist = useRef(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    useStudio3DStore.setState({ _cameraControlsRef: controlsRef });
  }, []);

  // Delay controls activation so SVG3D intro animation finishes first
  useEffect(() => {
    const timer = setTimeout(() => {
      setReady(true);
      controlsRef.current?.saveState();
    }, 700);
    return () => clearTimeout(timer);
  }, []);

  useFrame(() => {
    const controls = controlsRef.current;
    if (!controls || !ready) return;

    const now = performance.now();
    if (now - lastUpdate.current < THROTTLE_MS) return;

    const polar = toDeg(controls.polarAngle);
    const azimuth = toDeg(controls.azimuthAngle);
    const dist = Math.round(controls.distance * 10) / 10;

    if (polar === lastPolar.current && azimuth === lastAzimuth.current && dist === lastDist.current) return;

    lastPolar.current = polar;
    lastAzimuth.current = azimuth;
    lastDist.current = dist;
    lastUpdate.current = now;

    useStudio3DStore.setState({
      _cameraInfo: { polar, azimuth, distance: dist, view: null },
    });
  });

  return (
    <>
      <CameraControls
        ref={controlsRef}
        makeDefault
        enabled={ready}
        smoothTime={0.25}
        draggingSmoothTime={0.1}
        minDistance={2}
        maxDistance={50}
      />
      {ready && (
        <GizmoHelper alignment="bottom-left" margin={[60, 60]} renderPriority={2}>
          <GizmoViewport axisColors={['#ff3366', '#00ff88', '#4a9eff']} labelColor="white" />
        </GizmoHelper>
      )}
    </>
  );
}

export function setCameraView(view: string) {
  const ref = useStudio3DStore.getState()._cameraControlsRef;
  const controls = ref?.current as CameraControlsImpl | undefined;
  if (!controls) return;
  const v = CAMERA_VIEWS[view];
  if (!v) return;
  controls.setLookAt(v.position[0], v.position[1], v.position[2], v.target[0], v.target[1], v.target[2], true);
  const prev = useStudio3DStore.getState()._cameraInfo;
  useStudio3DStore.setState({
    _cameraInfo: { polar: 0, azimuth: 0, distance: 10, ...prev, view },
  });
}

export function resetCamera() {
  const ref = useStudio3DStore.getState()._cameraControlsRef;
  const controls = ref?.current as CameraControlsImpl | undefined;
  if (!controls) return;
  controls.reset(true);
  const prev = useStudio3DStore.getState()._cameraInfo;
  if (prev) useStudio3DStore.setState({ _cameraInfo: { ...prev, view: null } });
}

export function dollyCamera(delta: number) {
  const ref = useStudio3DStore.getState()._cameraControlsRef;
  const controls = ref?.current as CameraControlsImpl | undefined;
  if (!controls) return;
  controls.dolly(delta, true);
}

export function rotateCamera(azimuth: number, polar: number) {
  const ref = useStudio3DStore.getState()._cameraControlsRef;
  const controls = ref?.current as CameraControlsImpl | undefined;
  if (!controls) return;
  controls.rotate(azimuth, polar, true);
}

export { CAMERA_VIEWS, DEG15 };

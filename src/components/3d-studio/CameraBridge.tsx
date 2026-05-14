import { useStudio3DStore } from '@/stores/studio3dStore';

const DEG15 = (15 * Math.PI) / 180;

const CAMERA_VIEWS: Record<string, { rotationX: number; rotationY: number; zoom: number }> = {
  front: { rotationX: 0, rotationY: 0, zoom: 8 },
  back: { rotationX: 0, rotationY: Math.PI, zoom: 8 },
  top: { rotationX: -Math.PI / 2, rotationY: 0, zoom: 8 },
  right: { rotationX: 0, rotationY: Math.PI / 2, zoom: 8 },
  iso: { rotationX: -0.5, rotationY: 0.7, zoom: 10 },
};

export function CameraBridge() {
  return null;
}

export function setCameraView(view: string) {
  const v = CAMERA_VIEWS[view];
  if (!v) return;
  const store = useStudio3DStore.getState();
  store.setRotationX(v.rotationX);
  store.setRotationY(v.rotationY);
  store.setZoom(v.zoom);
  useStudio3DStore.setState({
    _cameraInfo: { polar: 0, azimuth: 0, distance: v.zoom, view },
  });
}

export function resetCamera() {
  setCameraView('front');
}

export function dollyCamera(delta: number) {
  const store = useStudio3DStore.getState();
  store.setZoom(Math.max(2, Math.min(50, store.zoom - delta)));
}

export function rotateCamera(azimuth: number, polar: number) {
  const store = useStudio3DStore.getState();
  store.setRotationY(store.rotationY + azimuth);
  store.setRotationX(store.rotationX + polar);
}

export { CAMERA_VIEWS, DEG15 };

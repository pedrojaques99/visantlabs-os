import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { SCENE_PRESETS } from '@/stores/studio3dStore';
import { materialPresets } from './engine/materials';

const SIZE = 64;
const CACHE_KEY = 'studio3d-preset-thumbs-v1';

function loadCached(): Record<string, string> | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Object.keys(parsed).length !== Object.keys(SCENE_PRESETS).length) return null;
    return parsed;
  } catch { return null; }
}

function saveCached(thumbs: Record<string, string>) {
  try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(thumbs)); } catch {}
}

export function usePresetPreviews() {
  const [thumbs, setThumbs] = useState<Record<string, string>>(() => loadCached() || {});
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current || Object.keys(thumbs).length > 0) return;
    ran.current = true;

    const schedule = typeof requestIdleCallback === 'function' ? requestIdleCallback : (cb: () => void) => setTimeout(cb, 200);
    schedule(() => {
      const canvas = document.createElement('canvas');
      canvas.width = SIZE;
      canvas.height = SIZE;

      const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false });
      renderer.setSize(SIZE, SIZE);
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.2;

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
      camera.position.set(0, 0, 3.5);

      const ambient = new THREE.AmbientLight(0xffffff, 0.5);
      const key = new THREE.DirectionalLight(0xffffff, 1.2);
      key.position.set(5, 5, 5);
      const fill = new THREE.DirectionalLight(0xffffff, 0.4);
      fill.position.set(-3, 2, -2);
      scene.add(ambient, key, fill);

      const geo = new THREE.SphereGeometry(1, 32, 32);
      const mesh = new THREE.Mesh(geo);
      scene.add(mesh);

      const result: Record<string, string> = {};

      for (const [name, preset] of Object.entries(SCENE_PRESETS)) {
        const mp = materialPresets[preset.material] ?? materialPresets.default;
        const isGold = preset.material === 'gold';

        mesh.material = new THREE.MeshPhysicalMaterial({
          color: isGold ? '#d4af37' : preset.color,
          metalness: isGold ? 1 : preset.metalness,
          roughness: isGold ? 0.12 : preset.roughness,
          clearcoat: mp.clearcoat ?? 0,
          clearcoatRoughness: 0.05,
        });

        scene.background = new THREE.Color(preset.background);
        key.intensity = preset.lightIntensity;
        ambient.intensity = preset.ambientIntensity;

        renderer.render(scene, camera);
        result[name] = canvas.toDataURL('image/webp', 0.6);

        (mesh.material as THREE.MeshPhysicalMaterial).dispose();
      }

      geo.dispose();
      renderer.dispose();

      saveCached(result);
      setThumbs(result);
    });
  }, []);

  return thumbs;
}

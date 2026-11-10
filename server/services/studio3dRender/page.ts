/**
 * Browser side of the headless Studio3D renderer. Bundled by esbuild (see
 * renderer.ts) and run inside Chromium via puppeteer. Pure three.js + the same
 * @visant/extrude3d geometry/material code the Studio3D engine uses — no React,
 * no R3F, no wall clock: every frame is a pure function of its index, so a
 * render is deterministic and can't drop frames.
 */
import * as THREE from 'three';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { buildExtrudedGeometry } from '../../../packages/extrude3d/src/geometry.js';
import { resolveMaterial, materialPresets } from '../../../packages/extrude3d/src/materials.js';
import type { PageJob } from './spec.js';

const TONE_MAP: Record<string, THREE.ToneMapping> = {
  ACES: THREE.ACESFilmicToneMapping,
  AgX: THREE.AgXToneMapping,
  Neutral: THREE.NeutralToneMapping,
  Reinhard: THREE.ReinhardToneMapping,
  Cineon: THREE.CineonToneMapping,
  Linear: THREE.LinearToneMapping,
};

const EASE: Record<string, (t: number) => number> = {
  linear: (t) => t,
  easeIn: (t) => t * t * t,
  easeOut: (t) => 1 - Math.pow(1 - t, 3),
  easeInOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
};

const DEG = Math.PI / 180;

function b64ToArrayBuffer(b64: string): ArrayBuffer {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}

let renderer: THREE.WebGLRenderer;
let scene: THREE.Scene;
let camera: THREE.PerspectiveCamera;
let pivot: THREE.Group;
let job: PageJob;

function setup(j: PageJob): { shapeCount: number } {
  job = j;
  const s = j.scene;
  const canvas = document.createElement('canvas');
  canvas.width = j.canvasWidth;
  canvas.height = j.canvasHeight;
  document.body.appendChild(canvas);

  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    preserveDrawingBuffer: true,
  });
  renderer.setPixelRatio(1);
  renderer.setSize(j.canvasWidth, j.canvasHeight, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = TONE_MAP[s.toneMapping] ?? THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = s.toneMappingExposure;
  if (j.transparent) renderer.setClearColor(0x000000, 0);
  else renderer.setClearColor(new THREE.Color(s.background), 1);

  scene = new THREE.Scene();

  // Image-based lighting: the app's own HDRI (fetched by Node, passed as base64),
  // falling back to three's procedural RoomEnvironment when unavailable.
  const pmrem = new THREE.PMREMGenerator(renderer);
  if (j.hdrBase64) {
    const tex = new HDRLoader().parse(b64ToArrayBuffer(j.hdrBase64)) as any;
    const dt = new THREE.DataTexture(tex.data, tex.width, tex.height, THREE.RGBAFormat, tex.type);
    dt.colorSpace = THREE.LinearSRGBColorSpace;
    dt.mapping = THREE.EquirectangularReflectionMapping;
    dt.minFilter = THREE.LinearFilter;
    dt.magFilter = THREE.LinearFilter;
    dt.generateMipmaps = false;
    dt.flipY = true;
    dt.needsUpdate = true;
    scene.environment = pmrem.fromEquirectangular(dt).texture;
    dt.dispose();
  } else {
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  }
  scene.environmentIntensity = s.hdriIntensity;
  scene.environmentRotation.y = s.hdriRotation * DEG;

  // Same light rig as SceneCanvas.tsx (ambient + key/fill/bounce + point).
  scene.add(new THREE.AmbientLight(0xffffff, s.ambientIntensity));
  const key = new THREE.DirectionalLight(0xffffff, s.lightIntensity);
  key.position.set(...s.lightPosition);
  const fill = new THREE.DirectionalLight(0xffffff, s.fillLightIntensity);
  fill.position.set(...s.fillLightPosition);
  const bounce = new THREE.DirectionalLight(0xffffff, s.bounceLightIntensity);
  bounce.position.set(...s.bounceLightPosition);
  const point = new THREE.PointLight(0xffffff, s.pointLightIntensity);
  point.position.set(...s.pointLightPosition);
  scene.add(key, fill, bounce, point);

  const result = buildExtrudedGeometry(j.svg, {
    depth: s.depth,
    smoothness: s.smoothness,
    bevelEnabled: s.bevelEnabled,
    bevelThickness: s.bevelThickness,
    bevelSize: s.bevelSize,
  });
  if (!result) throw new Error('SVG produced no extrudable shapes');

  // Material mapping mirrors ExtrudedSVG.tsx (standard shape, no textures).
  const m = resolveMaterial(s.material, {
    metalness: s.metalness,
    roughness: s.roughness,
    opacity: s.opacity,
  });
  const preset = materialPresets[s.material] ?? materialPresets.default;
  const isGold = s.material === 'gold';
  const wantsTransparency = m.transparent || m.opacity < 1;
  const emissiveIntensity = preset.emissiveIntensity ?? 0;
  const material = new THREE.MeshPhysicalMaterial({
    color: isGold ? '#d4a017' : s.color,
    metalness: m.metalness,
    roughness: wantsTransparency ? Math.max(0.02, m.roughness * 0.3) : m.roughness,
    transmission: m.transmission ?? (wantsTransparency ? 1 - m.opacity : 0),
    thickness: m.thickness ?? (wantsTransparency ? 2.5 : 0),
    ior: m.ior ?? (wantsTransparency ? 1.5 : 1.45),
    emissive: emissiveIntensity > 0 ? s.color : '#000000',
    emissiveIntensity,
    clearcoat: m.clearcoat ?? (wantsTransparency ? 1 : 0),
    clearcoatRoughness: m.clearcoatRoughness ?? 0.05,
    sheen: m.sheen ?? 0,
    sheenRoughness: m.sheenRoughness ?? 0,
    sheenColor: m.sheenColor ?? '#000000',
    iridescence: m.iridescence ?? 0,
    iridescenceIOR: m.iridescenceIOR ?? 1.3,
    reflectivity: m.reflectivity ?? 0.5,
    envMapIntensity: isGold ? 2.2 : s.envMapIntensity,
    side: THREE.FrontSide,
  });

  const mesh = new THREE.Mesh(result.geometry, material);
  mesh.position.set(-result.center.x, -result.center.y, -result.center.z);
  const flip = new THREE.Group(); // SVG is y-down: same [s, -s, s] flip as the engine
  flip.scale.set(result.baseScale, -result.baseScale, result.baseScale);
  flip.add(mesh);
  pivot = new THREE.Group();
  pivot.scale.setScalar(s.objectScale);
  pivot.add(flip);
  scene.add(pivot);

  camera = new THREE.PerspectiveCamera(j.camera.fov, j.width / j.height, 0.1, 200);
  return { shapeCount: result.shapeCount };
}

/** Place camera + object for frame `i`. Pure function of i — no clock. */
function pose(i: number) {
  const c = job.camera;
  const t = job.frames <= 1 ? job.stillAt : i / job.frames; // [0,1): loops close cleanly
  const e = (EASE[c.easing] ?? EASE.easeInOut)(t);
  let az = c.azimuth;
  let el = c.elevation;
  let dist = c.distance;
  let spin = c.spin * t; // extra object rotation (deg) across the clip, always linear

  switch (c.move) {
    case 'turntable':
      spin += c.angle * t; // object turns, camera holds — linear so it loops
      break;
    case 'orbit':
      az += c.angle * e;
      break;
    case 'push':
    case 'pull': {
      const a = c.move === 'push' ? c.from : c.to;
      const b = c.move === 'push' ? c.to : c.from;
      dist = a + (b - a) * e;
      az += c.angle * (e - 0.5);
      break;
    }
    case 'sweep':
      az += c.angle * (e - 0.5);
      el = c.elevation + c.elevationTo * (1 - e) - c.elevationTo * 0.5;
      break;
    case 'static':
    default:
      break;
  }

  pivot.rotation.set(0, spin * DEG, 0);
  const azr = az * DEG;
  const elr = el * DEG;
  camera.position.set(
    dist * Math.cos(elr) * Math.sin(azr),
    dist * Math.sin(elr),
    dist * Math.cos(elr) * Math.cos(azr)
  );
  camera.lookAt(0, c.targetY, 0);
}

function frame(i: number): string {
  pose(i);
  renderer.render(scene, camera);
  return renderer.domElement.toDataURL('image/png');
}

(window as any).__s3d = { setup, frame };

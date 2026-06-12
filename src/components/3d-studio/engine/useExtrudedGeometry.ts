import { useRef, useEffect, useState, useCallback } from 'react';
import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {
  parseShapesFromSVG,
  measureFlatMaxDim,
  buildExtrudeSettings,
  smoothCreaseNormals,
  recomputeTriplanarUVs,
} from '@visant/extrude3d';

const BATCH_SIZE = 20;

function yieldToMain() {
  return new Promise<void>((resolve) => setTimeout(resolve, 0));
}

export interface ExtrudedGeometryResult {
  geometries: THREE.BufferGeometry[];
  center: THREE.Vector3;
  baseScale: number;
  loading: boolean;
  progress: number;
  cancel: () => void;
}

const EMPTY_RESULT = {
  geometries: [] as THREE.BufferGeometry[],
  center: new THREE.Vector3(),
  baseScale: 1,
};

export interface BevelOptions {
  bevelEnabled?: boolean;
  bevelThickness?: number;
  bevelSize?: number;
}

/**
 * React wrapper around @visant/extrude3d's pure geometry pipeline. The geometry
 * math (SVG parse, extrude settings, crease-normal smoothing, triplanar UVs,
 * center + scale) lives in the package; this hook owns the React-specific bits:
 * loading/progress state, cancellation, batched yielding for large SVGs, and
 * disposal of superseded geometries.
 */
export function useExtrudedGeometry(
  svgString: string,
  depth: number,
  smoothness: number,
  bevelOpts: BevelOptions = {}
): ExtrudedGeometryResult {
  const [result, setResult] = useState(EMPTY_RESULT);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const cancelRef = useRef(false);
  const versionRef = useRef(0);
  const prevGeosRef = useRef<THREE.BufferGeometry[]>([]);

  useEffect(() => {
    const oldGeos = prevGeosRef.current;
    prevGeosRef.current = result.geometries;
    return () => {
      oldGeos.forEach((g) => g.dispose());
    };
  }, [result]);

  const cancel = useCallback(() => {
    cancelRef.current = true;
  }, []);

  useEffect(() => {
    if (!svgString) {
      setResult(EMPTY_RESULT);
      setLoading(false);
      setProgress(0);
      return;
    }

    const version = ++versionRef.current;
    cancelRef.current = false;
    setLoading(true);
    setProgress(0);

    (async () => {
      const allShapes = parseShapesFromSVG(svgString);
      if (allShapes.length === 0 || cancelRef.current || version !== versionRef.current) {
        setResult(EMPTY_RESULT);
        setLoading(false);
        return;
      }

      const maxFlatDim = measureFlatMaxDim(allShapes);
      const extrudeSettings = buildExtrudeSettings(maxFlatDim, allShapes.length, {
        depth,
        smoothness,
        ...bevelOpts,
      });

      const individualGeos: THREE.ExtrudeGeometry[] = [];
      for (let i = 0; i < allShapes.length; i++) {
        if (cancelRef.current || version !== versionRef.current) {
          individualGeos.forEach((g) => g.dispose());
          setLoading(false);
          return;
        }
        individualGeos.push(new THREE.ExtrudeGeometry(allShapes[i], extrudeSettings));
        if ((i + 1) % BATCH_SIZE === 0) {
          setProgress(Math.round(((i + 1) / allShapes.length) * 90));
          await yieldToMain();
        }
      }

      if (cancelRef.current || version !== versionRef.current) {
        individualGeos.forEach((g) => g.dispose());
        setLoading(false);
        return;
      }

      setProgress(92);
      await yieldToMain();

      let merged = BufferGeometryUtils.mergeGeometries(individualGeos, false);
      individualGeos.forEach((g) => g.dispose());

      if (!merged || cancelRef.current || version !== versionRef.current) {
        setResult(EMPTY_RESULT);
        setLoading(false);
        return;
      }

      setProgress(96);
      await yieldToMain();

      // Smooth curved side walls while keeping sharp edges crisp (30 degree crease threshold)
      const smoothed = smoothCreaseNormals(merged, Math.PI / 6);
      merged.dispose();
      merged = smoothed;

      merged.computeBoundingBox();
      recomputeTriplanarUVs(merged, merged.boundingBox!);

      const bb = merged.boundingBox!;
      const ctr = new THREE.Vector3();
      bb.getCenter(ctr);
      const size = new THREE.Vector3();
      bb.getSize(size);
      const maxDim = Math.max(size.x, size.y, size.z);
      const s = maxDim > 0 ? 4 / maxDim : 1;

      if (cancelRef.current || version !== versionRef.current) {
        merged.dispose();
        setLoading(false);
        return;
      }

      setProgress(100);
      setResult({ geometries: [merged], center: ctr, baseScale: s });
      setLoading(false);
    })();

    return () => {
      cancelRef.current = true;
    };
  }, [
    svgString,
    depth,
    smoothness,
    bevelOpts.bevelEnabled,
    bevelOpts.bevelThickness,
    bevelOpts.bevelSize,
  ]);

  return { ...result, loading, progress, cancel };
}

import { createContext, useContext } from 'react';
import type { Scene, WebGLRenderer, Camera } from 'three';

export interface SceneHandle {
  scene: Scene;
  gl: WebGLRenderer;
  camera: Camera;
}

export const SceneRefContext = createContext<SceneHandle | null>(null);

export function useSceneHandle(): SceneHandle | null {
  return useContext(SceneRefContext);
}

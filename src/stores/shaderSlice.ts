/**
 * Shader Zustand Slice — Composable into any app store
 *
 * Usage in any store:
 *   import { createShaderSlice, type ShaderSlice } from '@/stores/shaderSlice';
 *   const useMyStore = create<MyState & ShaderSlice>()((...a) => ({
 *     ...myState(...a),
 *     ...createShaderSlice(...a),
 *   }));
 */

import type { StateCreator } from 'zustand';
import type { ShaderType, HalftoneVariant } from '@/utils/shaders/shaderRegistry';
import type { ShaderSettings } from '@/utils/shaders/shaderRenderer';
import { SHADER_DEFINITIONS_MAP, buildShaderSettings } from '@/utils/shaders/shaderParams';

export interface ShaderSlice {
  // State
  shaderEnabled: boolean;
  shaderType: ShaderType;
  shaderValues: Record<string, any>;

  // Actions
  setShaderEnabled: (v: boolean) => void;
  setShaderType: (t: ShaderType) => void;
  setShaderValue: (key: string, value: any) => void;
  resetShaderValues: () => void;
  getShaderSettings: () => ShaderSettings;
}

export const createShaderSlice: StateCreator<ShaderSlice, [], [], ShaderSlice> = (set, get) => ({
  shaderEnabled: false,
  shaderType: 'halftone',
  shaderValues: {},

  setShaderEnabled: (v) => set({ shaderEnabled: v }),

  setShaderType: (t) => set({ shaderType: t, shaderValues: {} }),

  setShaderValue: (key, value) =>
    set((s) => ({ shaderValues: { ...s.shaderValues, [key]: value } })),

  resetShaderValues: () => set({ shaderValues: {} }),

  getShaderSettings: () => {
    const { shaderType, shaderValues } = get();
    return buildShaderSettings(shaderType, shaderValues);
  },
});

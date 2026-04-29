import { create } from 'zustand';
import { temporal } from 'zundo';
import { persist, createJSONStorage } from 'zustand/middleware';
import type {
  CreativeFormat,
  CreativeLayer,
  CreativeLayerData,
  CreativeOverlay,
  CreativePage,
  CreativeStatus,
  CreativeTool,
} from './creativeTypes';
import type { GeminiModel, SeedreamModel, ImageProvider, Resolution } from '@/types/types';
import { GEMINI_MODELS } from '@/constants/geminiModels';
import { trackCreativeEvent, shallowDiff } from '@/lib/creativeEvents';
import { calculateBoundingBox, type Rect } from '@/lib/pixel';

interface CreativeStore {
  // Setup
  brandId: string | null;
  prompt: string;
  format: CreativeFormat;
  backgroundMode: 'ai' | 'upload' | 'brand';
  uploadedBackgroundUrl: string | null;
  modelId: GeminiModel | SeedreamModel | string;
  provider: ImageProvider;
  resolution: Resolution;

  // Editor
  status: CreativeStatus;
  creativeId: string | null;
  projectName: string;
  backgroundUrl: string | null;
  overlay: CreativeOverlay | null;
  layers: CreativeLayer[];
  selectedLayerIds: string[];
  backgroundSelected: boolean;
  activeTool: CreativeTool;
  lassoRegion: { x: number; y: number; w: number; h: number } | null;
  gridEnabled: boolean;
  gridSize: number;

  // Setup actions
  setBrandId: (id: string | null) => void;
  setPrompt: (p: string) => void;
  setFormat: (f: CreativeFormat) => void;
  setBackgroundMode: (m: 'ai' | 'upload' | 'brand') => void;
  setUploadedBackgroundUrl: (url: string | null) => void;
  setModel: (modelId: GeminiModel | SeedreamModel, provider: ImageProvider) => void;
  setResolution: (r: Resolution) => void;

  // Card/Page system
  pages: CreativePage[];
  activePageIndex: number;

  // Editor actions
  setStatus: (s: CreativeStatus) => void;
  setProjectName: (name: string) => void;
  setCreativeId: (id: string | null) => void;
  setActivePageIndex: (index: number) => void;
  addPage: (format?: CreativeFormat) => void;
  removePage: (index: number) => void;
  duplicatePage: (index: number) => void;
  renamePage: (index: number, name: string) => void;
  reorderPages: (from: number, to: number) => void;
  
  hydrateFromAI: (payload: {
    backgroundUrl: string;
    overlay: CreativeOverlay | null;
    layers: CreativeLayerData[];
  }) => void;

  setBackgroundSelected: (v: boolean) => void;
  setBackgroundUrl: (url: string | null) => void;
  setActiveTool: (t: CreativeTool) => void;
  setLassoRegion: (r: { x: number; y: number; w: number; h: number } | null) => void;
  setGridEnabled: (v: boolean) => void;
  setGridSize: (n: number) => void;
  setSelectedLayerIds: (ids: string[], extend?: boolean) => void;
  updateLayer: (id: string, updates: Partial<CreativeLayerData>) => void;
  updateLayerMeta: (id: string, updates: Partial<Pick<CreativeLayer, 'visible' | 'zIndex' | 'locked'>>) => void;
  addLayer: (data: CreativeLayerData) => void;
  removeLayer: (id: string) => void;
  duplicateLayer: (id: string) => void;
  groupSelected: () => void;
  ungroupSelected: () => void;
  reorderLayer: (id: string, direction: 'up' | 'down' | 'top' | 'bottom') => void;
  alignLayers: (axis: 'left' | 'center-h' | 'right' | 'top' | 'center-v' | 'bottom') => void;
  distributeLayers: (axis: 'horizontal' | 'vertical') => void;
  reset: () => void;
}

let layerCounter = 0;
const nextLayerId = () => `layer_${Date.now()}_${++layerCounter}`;
const nextCreativeId = () =>
  `creative_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
let pageCounter = 0;
const nextPageId = () => `page_${Date.now()}_${++pageCounter}`;

/**
 * Mirror the active page's layers/bg/overlay back to root state. Pages are
 * the source of truth; root state is a cached view kept atomically in sync.
 */
function rootMirrorOf(pages: CreativePage[], idx: number) {
  const p = pages[idx];
  if (!p) return { layers: [], backgroundUrl: null, overlay: null };
  return { layers: p.layers, backgroundUrl: p.backgroundUrl, overlay: p.overlay };
}

/**
 * Patch the active page with `patch` and return the matching state slice
 * (pages updated + root mirrored). Use this in EVERY action that touches
 * page-scoped data so root and pages never drift.
 */
function applyToActivePage(
  pages: CreativePage[],
  activePageIndex: number,
  patch: Partial<CreativePage>
): { pages: CreativePage[]; layers: CreativeLayer[]; backgroundUrl: string | null; overlay: CreativeOverlay | null } | null {
  if (!pages[activePageIndex]) return null;
  const newPages = pages.map((p, i) => (i === activePageIndex ? { ...p, ...patch } : p));
  return { pages: newPages, ...rootMirrorOf(newPages, activePageIndex) };
}

const defaultPageName = (idx: number) => `Página ${idx + 1}`;

export const useCreativeStore = create<CreativeStore>()(
  persist(
    temporal(
      (set) => ({
        brandId: null,
        prompt: '',
        format: '1:1',
        backgroundMode: 'ai',
        uploadedBackgroundUrl: null,
        modelId: GEMINI_MODELS.NB2,
        provider: 'gemini',
        resolution: '2K',

        status: 'setup',
        creativeId: null,
        projectName: 'Untitled Creative',
        backgroundUrl: null,
        overlay: null,
        layers: [],
        selectedLayerIds: [],
        backgroundSelected: false,
        activeTool: 'select',
        lassoRegion: null,
        gridEnabled: false,
        gridSize: 16,
        pages: [],
        activePageIndex: 0,

        setBrandId: (brandId) => set({ brandId }),
        setProjectName: (projectName) => set({ projectName }),
        setCreativeId: (creativeId) => set({ creativeId }),
        setPrompt: (prompt) => set({ prompt }),
        setFormat: (format) => set({ format }),
        setBackgroundMode: (backgroundMode) => set({ backgroundMode }),
        setUploadedBackgroundUrl: (uploadedBackgroundUrl) => set({ uploadedBackgroundUrl }),
        setModel: (modelId, provider) => set({ modelId, provider }),
        setResolution: (resolution) => set({ resolution }),

        setStatus: (status) => set({ status }),
        setBackgroundSelected: (backgroundSelected) => set(backgroundSelected ? { backgroundSelected, selectedLayerIds: [] } : { backgroundSelected }),
        setBackgroundUrl: (backgroundUrl) => set((state) => {
          const patch = applyToActivePage(state.pages, state.activePageIndex, { backgroundUrl });
          return patch ?? { backgroundUrl };
        }),
        setActiveTool: (activeTool) => set({ activeTool, lassoRegion: null }),
        setLassoRegion: (lassoRegion) => set({ lassoRegion }),
        setGridEnabled: (gridEnabled) => set({ gridEnabled }),
        setGridSize: (gridSize) => set({ gridSize: Math.max(2, Math.round(gridSize)) }),

        setActivePageIndex: (index) => set((state) => {
          if (index < 0 || index >= state.pages.length) return state;
          // Switch the canvas: load the target page's data into root mirror
          // and clear cross-page selection (ids from page A don't exist in B).
          return {
            activePageIndex: index,
            ...rootMirrorOf(state.pages, index),
            selectedLayerIds: [],
            backgroundSelected: false,
          };
        }),

        addPage: (format) => set((state) => {
          const newFormat = format || state.format;
          const newPage: CreativePage = {
            id: nextPageId(),
            name: defaultPageName(state.pages.length),
            format: newFormat,
            layers: [],
            backgroundUrl: state.backgroundUrl, // Inherit background
            overlay: state.overlay,
          };
          const pages = [...state.pages, newPage];
          const activePageIndex = pages.length - 1;
          return {
            pages,
            activePageIndex,
            ...rootMirrorOf(pages, activePageIndex),
            selectedLayerIds: [],
            backgroundSelected: false,
          };
        }),

        removePage: (index) => set((state) => {
          if (state.pages.length <= 1) return state;
          const pages = state.pages.filter((_, i) => i !== index);
          // If removing the active page (or one before it), shift index left.
          let activePageIndex = state.activePageIndex;
          if (index < activePageIndex) activePageIndex--;
          else if (index === activePageIndex) activePageIndex = Math.min(activePageIndex, pages.length - 1);
          return {
            pages,
            activePageIndex,
            ...rootMirrorOf(pages, activePageIndex),
            selectedLayerIds: [],
            backgroundSelected: false,
          };
        }),

        duplicatePage: (index) => set((state) => {
          const src = state.pages[index];
          if (!src) return state;
          // Re-id the layers so subsequent edits don't mutate both pages.
          const cloneLayers = src.layers.map((l) => ({ ...l, id: nextLayerId() }));
          const clone: CreativePage = {
            id: nextPageId(),
            name: src.name ? `${src.name} cópia` : defaultPageName(state.pages.length),
            format: src.format,
            layers: cloneLayers,
            backgroundUrl: src.backgroundUrl,
            overlay: src.overlay,
          };
          const pages = [
            ...state.pages.slice(0, index + 1),
            clone,
            ...state.pages.slice(index + 1),
          ];
          const activePageIndex = index + 1;
          return {
            pages,
            activePageIndex,
            ...rootMirrorOf(pages, activePageIndex),
            selectedLayerIds: [],
            backgroundSelected: false,
          };
        }),

        renamePage: (index, name) => set((state) => {
          const trimmed = name.trim();
          if (!state.pages[index]) return state;
          const pages = state.pages.map((p, i) =>
            i === index ? { ...p, name: trimmed || undefined } : p
          );
          return { pages };
        }),

        reorderPages: (from, to) => set((state) => {
          if (from === to || from < 0 || to < 0 || from >= state.pages.length || to >= state.pages.length) {
            return state;
          }
          const pages = state.pages.slice();
          const [moved] = pages.splice(from, 1);
          pages.splice(to, 0, moved);
          // Track the active page through the move.
          let activePageIndex = state.activePageIndex;
          if (state.activePageIndex === from) activePageIndex = to;
          else {
            if (from < state.activePageIndex) activePageIndex--;
            if (to <= state.activePageIndex) activePageIndex++;
          }
          activePageIndex = Math.max(0, Math.min(pages.length - 1, activePageIndex));
          return {
            pages,
            activePageIndex,
            ...rootMirrorOf(pages, activePageIndex),
          };
        }),

        hydrateFromAI: ({ backgroundUrl, overlay, layers }) => {
          const creativeId = nextCreativeId();
          set((state) => {
            const initialLayers = layers.map((data, i) => ({
              id: nextLayerId(),
              visible: true,
              zIndex: i + 1,
              data,
            }));

            const firstPage: CreativePage = {
              id: nextPageId(),
              name: defaultPageName(0),
              format: state.format,
              layers: initialLayers,
              backgroundUrl,
              overlay,
            };

            trackCreativeEvent({
              brandId: state.brandId,
              creativeId,
              type: 'ai_generate',
              after: { backgroundUrl, layerCount: layers.length },
              isCorrection: false,
            });

            return {
              creativeId,
              backgroundUrl,
              overlay,
              layers: initialLayers,
              pages: [firstPage],
              activePageIndex: 0,
              status: 'editing',
              selectedLayerIds: [],
            };
          });
        },

        setSelectedLayerIds: (selectedLayerIds, extend) => set((state) => {
          if (extend) {
            const existing = state.selectedLayerIds;
            const newSelection = [...existing];
            selectedLayerIds.forEach(id => {
              if (newSelection.includes(id)) {
                newSelection.splice(newSelection.indexOf(id), 1);
              } else {
                newSelection.push(id);
              }
            });
            return { selectedLayerIds: newSelection, backgroundSelected: false };
          }
          return { selectedLayerIds, backgroundSelected: false };
        }),

        updateLayer: (id, updates) =>
          set((state) => {
            const prev = state.layers.find((l) => l.id === id);
            if (prev && state.creativeId && state.status === 'editing') {
              const before = prev.data as unknown as Record<string, unknown>;
              const after = { ...before, ...(updates as Record<string, unknown>) };
              trackCreativeEvent({
                brandId: state.brandId,
                creativeId: state.creativeId,
                type: 'layer_update',
                layerId: id,
                layerRole: (prev.data as { role?: string }).role,
                diff: shallowDiff(before, after),
                isCorrection: true,
              });
            }
            const layers = state.layers.map((l) =>
              l.id === id ? { ...l, data: { ...l.data, ...updates } as CreativeLayerData } : l
            );
            return applyToActivePage(state.pages, state.activePageIndex, { layers }) ?? { layers };
          }),

        updateLayerMeta: (id, updates) =>
          set((state) => {
            const prev = state.layers.find((l) => l.id === id);
            if (prev && state.creativeId && state.status === 'editing') {
              trackCreativeEvent({
                brandId: state.brandId,
                creativeId: state.creativeId,
                type: 'layer_meta',
                layerId: id,
                layerRole: (prev.data as { role?: string }).role,
                diff: shallowDiff(
                  { visible: prev.visible, zIndex: prev.zIndex },
                  { visible: prev.visible, zIndex: prev.zIndex, ...updates }
                ),
                isCorrection: true,
              });
            }
            const layers = state.layers.map((l) => (l.id === id ? { ...l, ...updates } : l));
            return applyToActivePage(state.pages, state.activePageIndex, { layers }) ?? { layers };
          }),

        addLayer: (data) =>
          set((state) => {
            const newId = nextLayerId();
            if (state.creativeId && state.status === 'editing') {
              trackCreativeEvent({
                brandId: state.brandId,
                creativeId: state.creativeId,
                type: 'layer_add',
                layerId: newId,
                layerRole: (data as { role?: string }).role,
                after: data as unknown as Record<string, unknown>,
                isCorrection: true,
              });
            }
            const layers = [
              ...state.layers,
              { id: newId, visible: true, zIndex: state.layers.length + 1, data },
            ];
            return applyToActivePage(state.pages, state.activePageIndex, { layers }) ?? { layers };
          }),

        removeLayer: (id) =>
          set((state) => {
            const prev = state.layers.find((l) => l.id === id);
            if (prev && state.creativeId && state.status === 'editing') {
              trackCreativeEvent({
                brandId: state.brandId,
                creativeId: state.creativeId,
                type: 'layer_remove',
                layerId: id,
                layerRole: (prev.data as { role?: string }).role,
                before: prev.data as unknown as Record<string, unknown>,
                isCorrection: true,
              });
            }
            const layers = state.layers.filter((l) => l.id !== id);
            const selectedLayerIds = state.selectedLayerIds.filter((sid) => sid !== id);
            const patch = applyToActivePage(state.pages, state.activePageIndex, { layers });
            return { ...(patch ?? { layers }), selectedLayerIds };
          }),

        duplicateLayer: (id) =>
          set((state) => {
            const source = state.layers.find((l) => l.id === id);
            if (!source) return state;
            const newId = nextLayerId();
            const newData = {
              ...source.data,
              position: {
                x: source.data.position.x + 0.02,
                y: source.data.position.y + 0.02,
              },
            } as CreativeLayerData;
            const layers = [
              ...state.layers,
              { id: newId, visible: true, zIndex: state.layers.length + 1, data: newData },
            ];
            const patch = applyToActivePage(state.pages, state.activePageIndex, { layers });
            return { ...(patch ?? { layers }), selectedLayerIds: [newId] };
          }),

        groupSelected: () => set((state) => {
          const selectedIds = state.selectedLayerIds;
          if (selectedIds.length < 2) return state;

          const selectedLayers = state.layers.filter(l => selectedIds.includes(l.id));
          const bbox = calculateBoundingBox(selectedLayers.map(l => ({
            x: l.data.position.x,
            y: l.data.position.y,
            w: l.data.size?.w || 0,
            h: l.data.size?.h || 0
          })));

          const groupId = nextLayerId();
          const newGroup: CreativeLayer = {
            id: groupId,
            visible: true,
            // Sit above children so the wrapper is the topmost — preserves
            // children zIndex on ungroup (they remain in state.layers untouched).
            zIndex: Math.max(...selectedLayers.map(l => l.zIndex)) + 1,
            data: {
              type: 'group',
              children: selectedIds,
              position: { x: bbox.x, y: bbox.y },
              size: { w: bbox.w, h: bbox.h },
            }
          };

          const layers = [...state.layers, newGroup];
          const patch = applyToActivePage(state.pages, state.activePageIndex, { layers });
          return { ...(patch ?? { layers }), selectedLayerIds: [groupId] };
        }),

        ungroupSelected: () => set((state) => {
          const selectedId = state.selectedLayerIds[0];
          const group = state.layers.find(l => l.id === selectedId);
          if (!group || group.data.type !== 'group') return state;

          const layers = state.layers.filter(l => l.id !== selectedId);
          const patch = applyToActivePage(state.pages, state.activePageIndex, { layers });
          return { ...(patch ?? { layers }), selectedLayerIds: group.data.children };
        }),

        reorderLayer: (id, direction) =>
          set((state) => {
            const sorted = [...state.layers].sort((a, b) => a.zIndex - b.zIndex);
            const idx = sorted.findIndex((l) => l.id === id);
            if (idx === -1) return state;

            let newIdx = idx;
            if (direction === 'up') newIdx = Math.min(idx + 1, sorted.length - 1);
            else if (direction === 'down') newIdx = Math.max(idx - 1, 0);
            else if (direction === 'top') newIdx = sorted.length - 1;
            else if (direction === 'bottom') newIdx = 0;

            if (newIdx === idx) return state;
            const item = sorted.splice(idx, 1)[0];
            sorted.splice(newIdx, 0, item);

            const layers = state.layers.map((l) => ({
              ...l,
              zIndex: sorted.findIndex((s) => s.id === l.id) + 1,
            }));
            return applyToActivePage(state.pages, state.activePageIndex, { layers }) ?? { layers };
          }),

        alignLayers: (axis) =>
          set((state) => {
            const ids = state.selectedLayerIds;
            const selected = state.layers.filter((l) => ids.includes(l.id));
            if (selected.length === 0) return state;

            const isSingle = selected.length === 1;

            const bbox = calculateBoundingBox(selected.map(l => ({
              x: l.data.position.x,
              y: l.data.position.y,
              w: l.data.size?.w || 0,
              h: l.data.size?.h || 0
            })));

            const layers = state.layers.map((l) => {
              if (!ids.includes(l.id)) return l;
              const pos = { x: l.data.position.x, y: l.data.position.y };

              if (axis === 'left') pos.x = isSingle ? 0 : bbox.x;
              else if (axis === 'right') pos.x = isSingle ? 1 - (l.data.size?.w || 0) : bbox.x + bbox.w - (l.data.size?.w || 0);
              else if (axis === 'center-h') pos.x = isSingle ? (1 - (l.data.size?.w || 0)) / 2 : (bbox.x + bbox.x + bbox.w) / 2 - (l.data.size?.w || 0) / 2;
              else if (axis === 'top') pos.y = isSingle ? 0 : bbox.y;
              else if (axis === 'bottom') pos.y = isSingle ? 1 - (l.data.size?.h || 0) : bbox.y + bbox.h - (l.data.size?.h || 0);
              else if (axis === 'center-v') pos.y = isSingle ? (1 - (l.data.size?.h || 0)) / 2 : (bbox.y + bbox.y + bbox.h) / 2 - (l.data.size?.h || 0) / 2;

              return { ...l, data: { ...l.data, position: pos } as CreativeLayerData };
            });
            return applyToActivePage(state.pages, state.activePageIndex, { layers }) ?? { layers };
          }),

        distributeLayers: (axis) =>
          set((state) => {
            const ids = state.selectedLayerIds;
            const selected = state.layers
              .filter((l) => ids.includes(l.id))
              .sort((a, b) =>
                axis === 'horizontal'
                  ? a.data.position.x - b.data.position.x
                  : a.data.position.y - b.data.position.y
              );
            if (selected.length < 3) return state;

            const first = selected[0];
            const last = selected[selected.length - 1];
            const updates = new Map<string, { x: number; y: number }>();

            if (axis === 'horizontal') {
              const startCenter = first.data.position.x + (first.data.size?.w || 0) / 2;
              const endCenter = last.data.position.x + (last.data.size?.w || 0) / 2;
              const step = (endCenter - startCenter) / (selected.length - 1);
              selected.forEach((l, i) => {
                updates.set(l.id, { x: startCenter + step * i - (l.data.size?.w || 0) / 2, y: l.data.position.y });
              });
            } else {
              const startCenter = first.data.position.y + (first.data.size?.h || 0) / 2;
              const endCenter = last.data.position.y + (last.data.size?.h || 0) / 2;
              const step = (endCenter - startCenter) / (selected.length - 1);
              selected.forEach((l, i) => {
                updates.set(l.id, { x: l.data.position.x, y: startCenter + step * i - (l.data.size?.h || 0) / 2 });
              });
            }

            const layers = state.layers.map((l) =>
              updates.has(l.id)
                ? { ...l, data: { ...l.data, position: updates.get(l.id)! } as CreativeLayerData }
                : l
            );
            return applyToActivePage(state.pages, state.activePageIndex, { layers }) ?? { layers };
          }),

        reset: () =>
          set({
            brandId: null,
            prompt: '',
            format: '1:1',
            backgroundMode: 'ai',
            uploadedBackgroundUrl: null,
            modelId: GEMINI_MODELS.NB2,
            provider: 'gemini',
            resolution: '2K',
            status: 'setup',
            creativeId: null,
            projectName: 'Untitled Creative',
            backgroundUrl: null,
            overlay: null,
            layers: [],
            selectedLayerIds: [],
            backgroundSelected: false,
            activeTool: 'select',
            lassoRegion: null,
            gridEnabled: false,
            gridSize: 16,
            pages: [],
            activePageIndex: 0,
          }),
      }),
      {
        partialize: (state) => ({
          layers: state.layers,
          overlay: state.overlay,
          backgroundUrl: state.backgroundUrl,
        }),
        limit: 50,
      }
    ),
    {
      name: 'vsn-creative-setup-cache',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      // Older snapshots that predate the schema bump get dropped quietly —
      // safer than restoring a partial shape that mismatches the runtime store.
      migrate: (persisted, version) => {
        if (version === 1) return persisted as Partial<CreativeStore>;
        return undefined;
      },
      partialize: (state) => {
        // Blob URLs (blob:... from URL.createObjectURL) die with the page — persisting
        // them causes ERR_FILE_NOT_FOUND on reload. Drop them; the user re-uploads.
        const dropBlob = (u: string | null | undefined) =>
          u && u.startsWith('blob:') ? null : u ?? null;
        return {
          brandId: state.brandId,
          prompt: state.prompt,
          format: state.format,
          backgroundMode: state.backgroundMode,
          uploadedBackgroundUrl: dropBlob(state.uploadedBackgroundUrl),
          modelId: state.modelId,
          provider: state.provider,
          resolution: state.resolution,
          // Editor state — survives refresh until cloud save completes
          status: state.status,
          creativeId: state.creativeId,
          projectName: state.projectName,
          backgroundUrl: dropBlob(state.backgroundUrl),
          overlay: state.overlay,
          layers: state.layers,
          pages: state.pages,
          activePageIndex: state.activePageIndex,
        };
      },
    }
  )
);

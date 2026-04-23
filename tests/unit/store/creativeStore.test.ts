import { describe, it, expect, beforeEach } from 'vitest';
import { useCreativeStore } from '@/components/creative/store/creativeStore';

describe('Creative Store Logic', () => {
  beforeEach(() => {
    useCreativeStore.getState().reset();
  });

  it('initializes with default values', () => {
    const state = useCreativeStore.getState();
    expect(state.status).toBe('setup');
    expect(state.layers).toHaveLength(0);
    expect(state.format).toBe('1:1');
  });

  it('adds and removes layers', () => {
    const store = useCreativeStore.getState();
    store.addLayer({ type: 'text', position: { x: 0, y: 0 }, content: 'Test' } as any);
    
    let state = useCreativeStore.getState();
    expect(state.layers).toHaveLength(1);
    const layerId = state.layers[0].id;
    
    store.removeLayer(layerId);
    state = useCreativeStore.getState();
    expect(state.layers).toHaveLength(0);
  });

  it('updates layer data', () => {
    const store = useCreativeStore.getState();
    store.addLayer({ type: 'text', position: { x: 0, y: 0 }, content: 'Old' } as any);
    const layerId = useCreativeStore.getState().layers[0].id;
    
    store.updateLayer(layerId, { content: 'New' } as any);
    const state = useCreativeStore.getState();
    expect((state.layers[0].data as any).content).toBe('New');
  });

  it('manages selection', () => {
    const store = useCreativeStore.getState();
    store.setSelectedLayerIds(['1', '2']);
    expect(useCreativeStore.getState().selectedLayerIds).toEqual(['1', '2']);
    
    store.setSelectedLayerIds(['3'], true); // Extend selection
    expect(useCreativeStore.getState().selectedLayerIds).toContain('1');
    expect(useCreativeStore.getState().selectedLayerIds).toContain('2');
    expect(useCreativeStore.getState().selectedLayerIds).toContain('3');
    
    store.setSelectedLayerIds(['1'], true); // Toggle existing
    expect(useCreativeStore.getState().selectedLayerIds).not.toContain('1');
  });

  it('aligns layers correctly using pixel intelligence', () => {
    const store = useCreativeStore.getState();
    // Add two layers at different positions
    store.addLayer({ type: 'text', position: { x: 0.1, y: 0.1 }, size: { w: 0.1, h: 0.1 } } as any);
    store.addLayer({ type: 'text', position: { x: 0.5, y: 0.5 }, size: { w: 0.1, h: 0.1 } } as any);
    
    const ids = useCreativeStore.getState().layers.map(l => l.id);
    store.setSelectedLayerIds(ids);
    
    // Align left (should both go to minX = 0.1)
    store.alignLayers('left');
    
    const layers = useCreativeStore.getState().layers;
    expect(layers[0].data.position.x).toBe(0.1);
    expect(layers[1].data.position.x).toBe(0.1);
  });
});

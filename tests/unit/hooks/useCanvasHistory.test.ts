import { describe, it, expect } from 'vitest';
import { 
  historyReducer, 
  deepClone, 
  removeFunctions,
  type HistoryState,
  type HistoryEntry 
} from '@/hooks/canvas/useCanvasHistory';

describe('Canvas History Intelligence (useCanvasHistory logic)', () => {
  describe('deepClone & removeFunctions', () => {
    it('removes functions from objects', () => {
      const input = {
        id: '1',
        fn: () => console.log('hello'),
        nested: {
          active: true,
          clear: () => {}
        }
      };
      const cleaned = removeFunctions(input);
      expect(cleaned.id).toBe('1');
      expect(cleaned.fn).toBeUndefined();
      expect(cleaned.nested.active).toBe(true);
      expect(cleaned.nested.clear).toBeUndefined();
    });

    it('clones objects deeply without functions', () => {
      const input = { a: 1, b: { c: 2 }, d: () => {} };
      const clone = deepClone(input);
      expect(clone).toEqual({ a: 1, b: { c: 2 } });
      expect(clone).not.toBe(input);
      expect(clone.b).not.toBe(input.b);
    });
  });

  describe('historyReducer', () => {
    const mockEntry: HistoryEntry = { nodes: [], edges: [] };
    const initialState: HistoryState = { entries: [], index: -1 };

    it('initializes history', () => {
      const state = historyReducer(initialState, { type: 'INIT', entry: mockEntry });
      expect(state.entries).toHaveLength(1);
      expect(state.index).toBe(0);
      expect(state.entries[0]).toBe(mockEntry);
    });

    it('adds new entries and updates index', () => {
      const s1 = historyReducer(initialState, { type: 'INIT', entry: mockEntry });
      const nextEntry: HistoryEntry = { nodes: [{ id: '1' } as any], edges: [] };
      const s2 = historyReducer(s1, { type: 'ADD', entry: nextEntry });
      
      expect(s2.entries).toHaveLength(2);
      expect(s2.index).toBe(1);
      expect(s2.entries[1].nodes).toHaveLength(1);
    });

    it('performs undo and redo', () => {
      let state = historyReducer(initialState, { type: 'INIT', entry: { nodes: [], edges: [] } });
      state = historyReducer(state, { type: 'ADD', entry: { nodes: [{ id: '1' } as any], edges: [] } });
      
      expect(state.index).toBe(1);
      
      state = historyReducer(state, { type: 'UNDO' });
      expect(state.index).toBe(0);
      
      state = historyReducer(state, { type: 'REDO' });
      expect(state.index).toBe(1);
    });

    it('slices forward history on new ADD after UNDO', () => {
      let state = historyReducer(initialState, { type: 'INIT', entry: { nodes: [], edges: [] } }); // index 0
      state = historyReducer(state, { type: 'ADD', entry: { nodes: [{ id: '1' } as any], edges: [] } }); // index 1
      state = historyReducer(state, { type: 'UNDO' }); // index 0
      
      const branchingEntry: HistoryEntry = { nodes: [{ id: '2' } as any], edges: [] };
      state = historyReducer(state, { type: 'ADD', entry: branchingEntry });
      
      expect(state.entries).toHaveLength(2);
      expect(state.index).toBe(1);
      expect((state.entries[1].nodes[0] as any).id).toBe('2');
    });

    it('respects max history size', () => {
      let state = historyReducer(initialState, { type: 'INIT', entry: mockEntry });
      for (let i = 0; i < 60; i++) {
        state = historyReducer(state, { type: 'ADD', entry: { nodes: [{ id: `${i}` } as any], edges: [] } });
      }
      
      expect(state.entries).toHaveLength(50);
      expect(state.index).toBe(49);
    });
  });
});

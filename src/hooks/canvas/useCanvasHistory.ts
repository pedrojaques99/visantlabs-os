import { useReducer, useCallback, useRef, useEffect } from 'react';
import type { Node, Edge } from '@xyflow/react';
import type { FlowNodeData } from '@/types/reactFlow';
import type { DrawingStroke } from './useCanvasDrawing';
import { toast } from 'sonner';

const maxHistorySize = 50;

// Helper function to remove functions from an object recursively
const removeFunctions = (obj: any): any => {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'function') {
    return undefined; // Remove functions
  }

  if (Array.isArray(obj)) {
    return obj.map(removeFunctions).filter(item => item !== undefined);
  }

  if (typeof obj === 'object') {
    const cleaned: any = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const value = removeFunctions(obj[key]);
        if (value !== undefined) {
          cleaned[key] = value;
        }
      }
    }
    return cleaned;
  }

  return obj;
};

// Efficient deep clone - uses structuredClone if available, otherwise falls back to JSON
// Strips functions before cloning since structuredClone can't clone them
const deepClone = <T>(obj: T): T => {
  const cleaned = removeFunctions(obj);

  if (typeof structuredClone !== 'undefined') {
    try {
      return structuredClone(cleaned) as T;
    } catch (error) {
      return JSON.parse(JSON.stringify(cleaned)) as T;
    }
  }
  return JSON.parse(JSON.stringify(cleaned)) as T;
};

type HistoryEntry = {
  nodes: Node<FlowNodeData>[];
  edges: Edge[];
  drawings?: DrawingStroke[];
};

type HistoryState = {
  entries: HistoryEntry[];
  index: number;
};

type HistoryAction =
  | { type: 'INIT'; entry: HistoryEntry }
  | { type: 'ADD'; entry: HistoryEntry }
  | { type: 'UNDO' }
  | { type: 'REDO' };

const initialState: HistoryState = { entries: [], index: -1 };

function historyReducer(state: HistoryState, action: HistoryAction): HistoryState {
  switch (action.type) {
    case 'INIT':
      return { entries: [action.entry], index: 0 };

    case 'ADD': {
      // Slice off any forward history (actions after an undo)
      const base = state.entries.slice(0, state.index + 1);
      const next = [...base, action.entry];

      if (next.length > maxHistorySize) {
        next.shift();
        return { entries: next, index: maxHistorySize - 1 };
      }

      return { entries: next, index: next.length - 1 };
    }

    case 'UNDO':
      if (state.index <= 0) return state;
      return { ...state, index: state.index - 1 };

    case 'REDO':
      if (state.index >= state.entries.length - 1) return state;
      return { ...state, index: state.index + 1 };

    default:
      return state;
  }
}

export const useCanvasHistory = (
  nodes: Node<FlowNodeData>[],
  edges: Edge[],
  setNodes: (nodes: Node<FlowNodeData>[]) => void,
  setEdges: (edges: Edge[]) => void,
  drawings?: DrawingStroke[],
  setDrawings?: (drawings: DrawingStroke[]) => void
) => {
  const [state, dispatch] = useReducer(historyReducer, initialState);
  const hasInitializedHistory = useRef(false);

  // Initialize history with current state (only once after initial load)
  useEffect(() => {
    if (hasInitializedHistory.current) return;
    hasInitializedHistory.current = true;

    dispatch({
      type: 'INIT',
      entry: {
        nodes: deepClone(nodes),
        edges: deepClone(edges),
        drawings: drawings ? deepClone(drawings) : undefined,
      },
    });
  }, [nodes.length, edges.length, drawings?.length]);

  const addToHistory = useCallback((
    newNodes: Node<FlowNodeData>[],
    newEdges: Edge[],
    newDrawings?: DrawingStroke[]
  ) => {
    dispatch({
      type: 'ADD',
      entry: {
        nodes: deepClone(newNodes),
        edges: deepClone(newEdges),
        drawings: newDrawings ? deepClone(newDrawings) : undefined,
      },
    });
  }, []);

  const handleUndo = useCallback(() => {
    if (state.index <= 0) {
      toast.info('Nothing to undo', { duration: 1500 });
      return;
    }

    const entry = state.entries[state.index - 1];
    if (entry) {
      setNodes(entry.nodes);
      setEdges(entry.edges);
      if (setDrawings && entry.drawings !== undefined) {
        setDrawings(entry.drawings);
      }
      dispatch({ type: 'UNDO' });
      toast.success('Undone', { duration: 1500 });
    }
  }, [state, setNodes, setEdges, setDrawings]);

  const handleRedo = useCallback(() => {
    if (state.index >= state.entries.length - 1) {
      toast.info('Nothing to redo', { duration: 1500 });
      return;
    }

    const entry = state.entries[state.index + 1];
    if (entry) {
      setNodes(entry.nodes);
      setEdges(entry.edges);
      if (setDrawings && entry.drawings !== undefined) {
        setDrawings(entry.drawings);
      }
      dispatch({ type: 'REDO' });
      toast.success('Redone', { duration: 1500 });
    }
  }, [state, setNodes, setEdges, setDrawings]);

  return {
    addToHistory,
    handleUndo,
    handleRedo,
  };
};

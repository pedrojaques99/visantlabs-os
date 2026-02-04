import { useState, useCallback, useRef, useEffect } from 'react';
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
  // Remove functions first
  const cleaned = removeFunctions(obj);

  if (typeof structuredClone !== 'undefined') {
    try {
      return structuredClone(cleaned) as T;
    } catch (error) {
      // If structuredClone fails, fall back to JSON
      return JSON.parse(JSON.stringify(cleaned)) as T;
    }
  }
  return JSON.parse(JSON.stringify(cleaned)) as T;
};

export const useCanvasHistory = (
  nodes: Node<FlowNodeData>[],
  edges: Edge[],
  setNodes: (nodes: Node<FlowNodeData>[]) => void,
  setEdges: (edges: Edge[]) => void,
  drawings?: DrawingStroke[],
  setDrawings?: (drawings: DrawingStroke[]) => void
) => {
  const [history, setHistory] = useState<Array<{ nodes: Node<FlowNodeData>[]; edges: Edge[]; drawings?: DrawingStroke[] }>>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const hasInitializedHistory = useRef(false);

  // Add to history when nodes, edges, or drawings change
  const addToHistory = useCallback((newNodes: Node<FlowNodeData>[], newEdges: Edge[], newDrawings?: DrawingStroke[]) => {
    console.log('[History] addToHistory called', {
      nodesCount: newNodes.length,
      edgesCount: newEdges.length,
      drawingsCount: newDrawings?.length || 0,
      currentHistoryIndex: historyIndex
    });
    setHistory((prev) => {
      // Remove any history after current index (when user does something after undo)
      const newHistory = prev.slice(0, historyIndex + 1);

      // Add new state
      const updatedHistory = [
        ...newHistory,
        {
          nodes: deepClone(newNodes),
          edges: deepClone(newEdges),
          drawings: newDrawings ? deepClone(newDrawings) : undefined,
        },
      ];

      // Limit history size
      if (updatedHistory.length > maxHistorySize) {
        updatedHistory.shift();
        return updatedHistory;
      }

      console.log('[History] History updated, new length:', updatedHistory.length);
      return updatedHistory;
    });

    setHistoryIndex((prev) => {
      const newIndex = prev + 1;
      const finalIndex = newIndex >= maxHistorySize ? maxHistorySize - 1 : newIndex;
      console.log('[History] History index updated:', prev, '->', finalIndex);
      return finalIndex;
    });
  }, [historyIndex]);

  // Initialize history with current state (only once after initial load)
  useEffect(() => {
    if (hasInitializedHistory.current) return;

    // Always initialize history, even with empty state
    hasInitializedHistory.current = true;
    console.log('[History] Initializing history with initial state', { nodes: nodes.length, edges: edges.length, drawings: drawings?.length });
    // Initialize history with current state
    setHistory([{
      nodes: deepClone(nodes),
      edges: deepClone(edges),
      drawings: drawings ? deepClone(drawings) : undefined
    }]);
    setHistoryIndex(0);
  }, [nodes.length, edges.length, drawings?.length]);

  // Undo function
  const handleUndo = useCallback(() => {
    console.log('[History] handleUndo called', { historyIndex, historyLength: history.length });
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      const state = history[newIndex];
      console.log('[History] Undoing to index', newIndex, 'state exists:', !!state);
      if (state) {
        setNodes(state.nodes);
        setEdges(state.edges);
        if (setDrawings && state.drawings !== undefined) {
          setDrawings(state.drawings);
        }
        setHistoryIndex(newIndex);
        toast.success('Undone', { duration: 1500 });
      }
    } else {
      console.log('[History] Nothing to undo - historyIndex is 0');
      toast.info('Nothing to undo', { duration: 1500 });
    }
  }, [history, historyIndex, setNodes, setEdges, setDrawings]);

  // Redo function
  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      const state = history[newIndex];
      if (state) {
        setNodes(state.nodes);
        setEdges(state.edges);
        if (setDrawings && state.drawings !== undefined) {
          setDrawings(state.drawings);
        }
        setHistoryIndex(newIndex);
        toast.success('Redone', { duration: 1500 });
      }
    } else {
      toast.info('Nothing to redo', { duration: 1500 });
    }
  }, [history, historyIndex, setNodes, setEdges, setDrawings]);

  return {
    addToHistory,
    handleUndo,
    handleRedo,
  };
};





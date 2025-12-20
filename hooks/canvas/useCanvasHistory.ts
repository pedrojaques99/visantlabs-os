import { useState, useCallback, useRef, useEffect } from 'react';
import type { Node, Edge } from '@xyflow/react';
import type { FlowNodeData } from '../../types/reactFlow';
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
  setEdges: (edges: Edge[]) => void
) => {
  const [history, setHistory] = useState<Array<{ nodes: Node<FlowNodeData>[]; edges: Edge[] }>>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const hasInitializedHistory = useRef(false);

  // Add to history when nodes or edges change
  const addToHistory = useCallback((newNodes: Node<FlowNodeData>[], newEdges: Edge[]) => {
    setHistory((prev) => {
      // Remove any history after current index (when user does something after undo)
      const newHistory = prev.slice(0, historyIndex + 1);
      
      // Add new state
      const updatedHistory = [
        ...newHistory,
        {
          nodes: deepClone(newNodes),
          edges: deepClone(newEdges),
        },
      ];
      
      // Limit history size
      if (updatedHistory.length > maxHistorySize) {
        updatedHistory.shift();
        return updatedHistory;
      }
      
      return updatedHistory;
    });
    
    setHistoryIndex((prev) => {
      const newIndex = prev + 1;
      return newIndex >= maxHistorySize ? maxHistorySize - 1 : newIndex;
    });
  }, [historyIndex]);

  // Initialize history with current state (only once after initial load)
  useEffect(() => {
    if (hasInitializedHistory.current) return;
    if (nodes.length === 0 && edges.length === 0) return;
    
    hasInitializedHistory.current = true;
    // Initialize history with current state
    setHistory([{ nodes: deepClone(nodes), edges: deepClone(edges) }]);
    setHistoryIndex(0);
  }, [nodes.length, edges.length]);

  // Undo function
  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      const state = history[newIndex];
      if (state) {
        setNodes(state.nodes);
        setEdges(state.edges);
        setHistoryIndex(newIndex);
        toast.success('Undone', { duration: 1500 });
      }
    } else {
      toast.info('Nothing to undo', { duration: 1500 });
    }
  }, [history, historyIndex, setNodes, setEdges]);

  // Redo function
  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      const state = history[newIndex];
      if (state) {
        setNodes(state.nodes);
        setEdges(state.edges);
        setHistoryIndex(newIndex);
        toast.success('Redone', { duration: 1500 });
      }
    } else {
      toast.info('Nothing to redo', { duration: 1500 });
    }
  }, [history, historyIndex, setNodes, setEdges]);

  return {
    addToHistory,
    handleUndo,
    handleRedo,
  };
};





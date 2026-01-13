import { useState, useEffect, useCallback } from 'react';
import type { Node, Edge } from '@xyflow/react';
import type { FlowNode, FlowEdge } from '../types/reactFlow';

const STORAGE_KEY = 'reactflow-positions';

interface SavedFlowState {
  nodePositions: Record<string, { x: number; y: number }>;
  edges: FlowEdge[];
}

export const useReactFlowPositions = (
  initialNodes: FlowNode[],
  initialEdges: FlowEdge[]
) => {
  const [nodes, setNodes] = useState<FlowNode[]>(initialNodes);
  const [edges, setEdges] = useState<FlowEdge[]>(initialEdges);

  // Load saved positions from localStorage
  const loadPositions = useCallback((): SavedFlowState | null => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored) as SavedFlowState;
      }
    } catch (error) {
      console.error('Failed to load flow positions:', error);
    }
    return null;
  }, []);

  // Save positions to localStorage
  const savePositions = useCallback((nodePositions: Record<string, { x: number; y: number }>, edges: FlowEdge[]) => {
    try {
      const state: SavedFlowState = {
        nodePositions,
        edges,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      console.error('Failed to save flow positions:', error);
    }
  }, []);

  // Load saved positions on mount
  useEffect(() => {
    const saved = loadPositions();
    if (saved) {
      // Apply saved positions to nodes
      setNodes((prevNodes) =>
        prevNodes.map((node) => {
          const savedPos = saved.nodePositions[node.id];
          if (savedPos) {
            return {
              ...node,
              position: { x: savedPos.x, y: savedPos.y },
            };
          }
          return node;
        })
      );

      // Restore edges if they exist
      if (saved.edges && saved.edges.length > 0) {
        setEdges(saved.edges);
      }
    }
  }, [loadPositions]);

  // Save positions when nodes or edges change
  useEffect(() => {
    const nodePositions: Record<string, { x: number; y: number }> = {};
    nodes.forEach((node) => {
      if (node.position) {
        nodePositions[node.id] = { x: node.position.x, y: node.position.y };
      }
    });
    savePositions(nodePositions, edges);
  }, [nodes, edges, savePositions]);

  return {
    nodes,
    setNodes,
    edges,
    setEdges,
    savePositions: () => {
      const nodePositions: Record<string, { x: number; y: number }> = {};
      nodes.forEach((node) => {
        if (node.position) {
          nodePositions[node.id] = { x: node.position.x, y: node.position.y };
        }
      });
      savePositions(nodePositions, edges);
    },
  };
};







import { useEffect, useRef, useCallback } from 'react';
import { useStorage, useOthers, useMutation, useUpdateMyPresence, useStatus } from '../../config/liveblocks';
import { LiveList, LiveObject } from '@liveblocks/client';
import type { Node, Edge } from '@xyflow/react';
import type { FlowNodeData } from '@/types/reactFlow';
import { toast } from 'sonner';

export interface PresenceEnhancedHandlers {
  handleNodesChangeWithPresence: (changes: any[]) => void;
  handleNodeDragStart: () => void;
  handleNodeDragStop: () => void;
}

interface UseCanvasCollaborationProps {
  projectId: string | null;
  isCollaborative: boolean;
  nodes: Node<FlowNodeData>[];
  edges: Edge[];
  setNodes: (nodes: Node<FlowNodeData>[] | ((prev: Node<FlowNodeData>[]) => Node<FlowNodeData>[])) => void;
  setEdges: (edges: Edge[] | ((prev: Edge[]) => Edge[])) => void;
  onSave?: () => Promise<void>;
}

const SLIDER_PROPERTIES = [
  'dotSize', 'angle', 'contrast', 'spacing', 'halftoneThreshold',
  'tapeWaveIntensity', 'tapeCreaseIntensity', 'switchingNoiseIntensity',
  'bloomIntensity', 'acBeatIntensity', 'matrixSize', 'bias',
  'asciiCharSize', 'asciiThreshold',
];

function toLSON<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

export const useCanvasCollaboration = ({
  projectId,
  isCollaborative,
  nodes,
  edges,
  setNodes,
  setEdges,
  onSave,
}: UseCanvasCollaborationProps) => {
  const roomId = projectId ? `canvas-${projectId}` : null;

  // ── Refs ────────────────────────────────────────────────────────────────────
  const isInitializedRef      = useRef(false);
  const lastSavedNodesRef     = useRef<Node<FlowNodeData>[]>([]);
  const lastSavedEdgesRef     = useRef<Edge[]>([]);
  const lastSyncedNodesRef    = useRef<Node<FlowNodeData>[]>([]);
  const draggingNodeIdRef     = useRef<string | null>(null);
  const lastPresenceUpdateRef = useRef<{ nodeId: string; x: number; y: number } | null>(null);

  // Stable debounce timers — not recreated on every render
  const liveblocksSyncTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const databaseSyncTimer    = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── All Liveblocks hooks — called unconditionally (Rules of Hooks) ──────────
  const status          = useStatus();
  const liveNodes       = useStorage((root) => root.nodes);
  const liveEdges       = useStorage((root) => root.edges);
  const others          = useOthers();
  const updateMyPresence = useUpdateMyPresence();

  const initializeStorage = useMutation(({ storage }, n: Node<FlowNodeData>[], e: Edge[]) => {
    if (isInitializedRef.current) return;
    storage.set('nodes', new LiveList(n.map(node => new LiveObject(toLSON(node) as any))));
    storage.set('edges', new LiveList(e.map(edge => new LiveObject(toLSON(edge) as any))));
    isInitializedRef.current = true;
  }, []);

  // Atomic replace — one Liveblocks op instead of N deletes + M pushes
  const updateNodes = useMutation(({ storage }, newNodes: Node<FlowNodeData>[]) => {
    storage.set('nodes', new LiveList(newNodes.map(n => new LiveObject(toLSON(n) as any))));
  }, []);

  const updateEdges = useMutation(({ storage }, newEdges: Edge[]) => {
    storage.set('edges', new LiveList(newEdges.map(e => new LiveObject(toLSON(e) as any))));
  }, []);

  // ── Initialize storage when connected and ready ────────────────────────────
  useEffect(() => {
    if (!isCollaborative || !projectId || nodes.length === 0) return;
    if (isInitializedRef.current) return;
    if (status !== 'connected' || liveNodes === null || liveEdges === null) return;
    initializeStorage(nodes, edges);
  }, [isCollaborative, projectId, status, liveNodes, liveEdges, nodes, edges, initializeStorage]);

  // ── Sync FROM Liveblocks → local state (collaborative updates from others) ─
  useEffect(() => {
    if (!isCollaborative || !liveNodes || !liveEdges) return;
    if (!(liveNodes instanceof LiveList) || !(liveEdges instanceof LiveList)) return;

    const nodesArray = liveNodes.toArray().map((n: any) => n.toObject());
    const edgesArray = liveEdges.toArray().map((e: any) => e.toObject());

    const nodesChanged = JSON.stringify(nodesArray) !== JSON.stringify(nodes);
    const edgesChanged = JSON.stringify(edgesArray) !== JSON.stringify(edges);

    if (nodesChanged || edgesChanged) {
      setNodes(nodesArray);
      setEdges(edgesArray);
      if (nodesChanged) lastSyncedNodesRef.current = nodesArray;
    }
  }, [liveNodes, liveEdges, isCollaborative, setNodes, setEdges, nodes, edges]);

  // ── Sync TO Liveblocks + database on local changes ─────────────────────────
  const isOnlyPositionChange = useCallback((oldNodes: Node<FlowNodeData>[], newNodes: Node<FlowNodeData>[]): boolean => {
    if (oldNodes.length !== newNodes.length) return false;
    let hasPositionChange = false;
    for (const newNode of newNodes) {
      const oldNode = oldNodes.find(n => n.id === newNode.id);
      if (!oldNode) return false;
      if (oldNode.position.x !== newNode.position.x || oldNode.position.y !== newNode.position.y) {
        hasPositionChange = true;
      }
      const { position: _op, ...oldRest } = oldNode;
      const { position: _np, ...newRest } = newNode;
      if (JSON.stringify(oldRest) !== JSON.stringify(newRest)) return false;
    }
    return hasPositionChange;
  }, []);

  const isShaderSliderOnlyChange = useCallback((oldNodes: Node<FlowNodeData>[], newNodes: Node<FlowNodeData>[]): boolean => {
    if (oldNodes.length !== newNodes.length) return false;
    let hasSliderChange = false;
    for (const newNode of newNodes) {
      const oldNode = oldNodes.find(n => n.id === newNode.id);
      if (!oldNode) return false;
      if (oldNode.type === 'shader' && newNode.type === 'shader') {
        const oldData = oldNode.data as any;
        const newData = newNode.data as any;
        const sliderChanged = SLIDER_PROPERTIES.some(p => oldData[p] !== newData[p]);
        if (sliderChanged) {
          hasSliderChange = true;
          const strip = (data: any) => Object.fromEntries(Object.entries(data).filter(([k]) => !SLIDER_PROPERTIES.includes(k)));
          const { position: _op, ...oldRest } = oldNode;
          const { position: _np, ...newRest } = newNode;
          if (JSON.stringify({ ...oldRest, data: strip(oldData) }) !== JSON.stringify({ ...newRest, data: strip(newData) })) return false;
        }
      } else {
        const { position: _op, ...oldRest } = oldNode;
        const { position: _np, ...newRest } = newNode;
        if (JSON.stringify(oldRest) !== JSON.stringify(newRest)) return false;
      }
    }
    return hasSliderChange;
  }, []);

  useEffect(() => {
    if (!isCollaborative || !isInitializedRef.current) return;

    // Liveblocks sync: instant for position-only, debounced (100ms) otherwise
    if (liveblocksSyncTimer.current) clearTimeout(liveblocksSyncTimer.current);
    const isPositionOnly = lastSyncedNodesRef.current.length > 0 && isOnlyPositionChange(lastSyncedNodesRef.current, nodes);
    if (isPositionOnly) {
      updateNodes(nodes);
      updateEdges(edges);
      lastSyncedNodesRef.current = nodes;
    } else {
      liveblocksSyncTimer.current = setTimeout(() => {
        updateNodes(nodes);
        updateEdges(edges);
        lastSyncedNodesRef.current = nodes;
      }, 100);
    }

    // Database sync: debounced 2s, skip shader-slider-only changes
    if (databaseSyncTimer.current) clearTimeout(databaseSyncTimer.current);
    databaseSyncTimer.current = setTimeout(async () => {
      if (!onSave || !projectId) return;
      const nodesChanged = JSON.stringify(nodes) !== JSON.stringify(lastSavedNodesRef.current);
      const edgesChanged = JSON.stringify(edges) !== JSON.stringify(lastSavedEdgesRef.current);
      if (!nodesChanged && !edgesChanged) return;
      if (lastSavedNodesRef.current.length > 0 && isShaderSliderOnlyChange(lastSavedNodesRef.current, nodes)) {
        lastSavedNodesRef.current = nodes;
        lastSavedEdgesRef.current = edges;
        return;
      }
      lastSavedNodesRef.current = nodes;
      lastSavedEdgesRef.current = edges;
      try { await onSave(); } catch (err) { console.error('[canvas] DB save failed:', err); }
    }, 2000);
  }, [nodes, edges, isCollaborative, updateNodes, updateEdges, onSave, projectId, isOnlyPositionChange, isShaderSliderOnlyChange]);

  // Reset on project change
  useEffect(() => {
    if (!projectId) return;
    isInitializedRef.current = false;
    lastSavedNodesRef.current = [];
    lastSavedEdgesRef.current = [];
    lastSyncedNodesRef.current = [];
  }, [projectId]);

  // Cleanup timers on unmount
  useEffect(() => () => {
    if (liveblocksSyncTimer.current) clearTimeout(liveblocksSyncTimer.current);
    if (databaseSyncTimer.current) clearTimeout(databaseSyncTimer.current);
    if (draggingNodeIdRef.current) {
      updateMyPresence({ nodePosition: null, isMoving: false });
      draggingNodeIdRef.current = null;
    }
  }, [updateMyPresence]);

  // ── Presence helpers ───────────────────────────────────────────────────────
  const updateNodePositionInPresence = useCallback((nodeId: string, x: number, y: number) => {
    if (!isCollaborative) return;
    updateMyPresence({ nodePosition: { nodeId, x, y }, isMoving: true });
  }, [isCollaborative, updateMyPresence]);

  const clearNodePositionInPresence = useCallback(() => {
    if (!isCollaborative) return;
    updateMyPresence({ nodePosition: null, isMoving: false });
  }, [isCollaborative, updateMyPresence]);

  const isNodeBeingMovedByOthers = useCallback((nodeId: string): { isMoving: boolean; userId?: string; userName?: string } => {
    if (!isCollaborative || !others.length) return { isMoving: false };
    for (const other of others) {
      const np = (other.presence as any)?.nodePosition as { nodeId: string; x: number; y: number } | null;
      if (np?.nodeId === nodeId && (other.presence as any)?.isMoving) {
        return { isMoving: true, userId: other.id, userName: other.info?.name || other.id };
      }
    }
    return { isMoving: false };
  }, [isCollaborative, others]);

  const getNodesBeingMovedByOthers = useCallback(() => {
    if (!isCollaborative || !others.length) return [];
    return others.flatMap(other => {
      const np = (other.presence as any)?.nodePosition as { nodeId: string; x: number; y: number } | null;
      if (!np || !(other.presence as any)?.isMoving) return [];
      return [{ nodeId: np.nodeId, userId: other.id, userName: other.info?.name || other.id, position: { x: np.x, y: np.y } }];
    });
  }, [isCollaborative, others]);

  const createPresenceEnhancedHandlers = useCallback((
    currentNodes: Node<FlowNodeData>[],
    originalOnNodesChange: (changes: any[]) => void,
    originalOnNodeDragStart: () => void,
    originalOnNodeDragStop: () => void,
    t: (key: string, params?: any) => string,
  ): PresenceEnhancedHandlers => ({
    handleNodesChangeWithPresence: (changes: any[]) => {
      if (!draggingNodeIdRef.current) {
        const posChange = changes.find((c: any) => c.type === 'position' && c.position);
        if (posChange) {
          const node = currentNodes.find(n => n.id === posChange.id);
          if (node) {
            const conflict = isNodeBeingMovedByOthers(posChange.id);
            if (conflict.isMoving) {
              toast.error(conflict.userName ? t('canvas.nodeBeingMovedBy', { userName: conflict.userName }) : t('canvas.nodeBeingMovedByAnother'), { duration: 2000 });
              originalOnNodesChange(changes.map((c: any) => c.id === posChange.id && c.type === 'position' ? { ...c, position: node.position } : c));
              return;
            }
            draggingNodeIdRef.current = posChange.id;
            updateNodePositionInPresence(posChange.id, node.position.x, node.position.y);
            lastPresenceUpdateRef.current = { nodeId: posChange.id, x: node.position.x, y: node.position.y };
          }
        }
      }
      originalOnNodesChange(changes);
      if (draggingNodeIdRef.current) {
        const posChange = changes.find((c: any) => c.type === 'position' && c.id === draggingNodeIdRef.current && c.position);
        if (posChange?.position) {
          const { x, y } = posChange.position;
          const last = lastPresenceUpdateRef.current;
          if (!last || last.nodeId !== draggingNodeIdRef.current || Math.abs(last.x - x) > 5 || Math.abs(last.y - y) > 5) {
            updateNodePositionInPresence(draggingNodeIdRef.current, x, y);
            lastPresenceUpdateRef.current = { nodeId: draggingNodeIdRef.current, x, y };
          }
        }
      }
    },
    handleNodeDragStart: originalOnNodeDragStart,
    handleNodeDragStop: () => {
      if (draggingNodeIdRef.current) {
        clearNodePositionInPresence();
        draggingNodeIdRef.current = null;
        lastPresenceUpdateRef.current = null;
      }
      originalOnNodeDragStop();
    },
  }), [isNodeBeingMovedByOthers, updateNodePositionInPresence, clearNodePositionInPresence]);

  // ── Non-collaborative early return (after all hooks) ───────────────────────
  if (!isCollaborative || !roomId) {
    return {
      others: [] as typeof others,
      isConnected: false,
      roomId: null,
      updateNodePositionInPresence: () => {},
      clearNodePositionInPresence: () => {},
      isNodeBeingMovedByOthers: () => ({ isMoving: false as const }),
      getNodesBeingMovedByOthers: () => [],
      createPresenceEnhancedHandlers: (
        _n: Node<FlowNodeData>[],
        onNodesChange: (c: any[]) => void,
        onDragStart: () => void,
        onDragStop: () => void,
      ) => ({ handleNodesChangeWithPresence: onNodesChange, handleNodeDragStart: onDragStart, handleNodeDragStop: onDragStop }),
    };
  }

  return {
    others,
    isConnected: status === 'connected',
    roomId,
    updateNodePositionInPresence,
    clearNodePositionInPresence,
    isNodeBeingMovedByOthers,
    getNodesBeingMovedByOthers,
    createPresenceEnhancedHandlers,
  };
};

import { useEffect, useRef, useCallback } from 'react';
import { useStorage, useOthers, useMutation, useRoom, useUpdateMyPresence, useStatus } from '../../config/liveblocks';
import { LiveList, LiveObject } from '@liveblocks/client';
import type { Node, Edge } from '@xyflow/react';
import type { FlowNodeData } from '@/types/reactFlow';

interface UseCanvasCollaborationProps {
  projectId: string | null;
  isCollaborative: boolean;
  nodes: Node<FlowNodeData>[];
  edges: Edge[];
  setNodes: (nodes: Node<FlowNodeData>[] | ((prev: Node<FlowNodeData>[]) => Node<FlowNodeData>[])) => void;
  setEdges: (edges: Edge[] | ((prev: Edge[]) => Edge[])) => void;
  onSave?: () => Promise<void>;
}

// Debounce function
function debounce<T extends (...args: any[]) => void>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
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
  const isInitializedRef = useRef(false);
  const lastSavedNodesRef = useRef<Node<FlowNodeData>[]>([]);
  const lastSavedEdgesRef = useRef<Edge[]>([]);
  const lastSyncedNodesRef = useRef<Node<FlowNodeData>[]>([]);

  // Get room instance (must be used inside RoomProvider)
  const room = useRoom();

  // Get connection status
  const status = useStatus();

  // Check if only positions changed (for instant sync)
  const isOnlyPositionChange = useCallback((oldNodes: Node<FlowNodeData>[], newNodes: Node<FlowNodeData>[]): boolean => {
    if (oldNodes.length !== newNodes.length) return false;

    let hasPositionChange = false;

    for (let i = 0; i < newNodes.length; i++) {
      const oldNode = oldNodes.find(n => n.id === newNodes[i].id);
      if (!oldNode) return false;

      // Check if position changed
      const positionChanged =
        oldNode.position.x !== newNodes[i].position.x ||
        oldNode.position.y !== newNodes[i].position.y;

      if (positionChanged) {
        hasPositionChange = true;
      }

      // Check if anything else changed (excluding position)
      const { position: oldPos, ...oldNodeWithoutPos } = oldNode;
      const { position: newPos, ...newNodeWithoutPos } = newNodes[i];

      const oldStr = JSON.stringify(oldNodeWithoutPos);
      const newStr = JSON.stringify(newNodeWithoutPos);

      if (oldStr !== newStr) return false;
    }

    // Only return true if there was at least one position change and nothing else changed
    return hasPositionChange;
  }, []);

  // Check if changes are only to shader slider properties
  // This includes all shader types: halftone, vhs, ascii, matrixDither
  const isShaderSliderOnlyChange = useCallback((oldNodes: Node<FlowNodeData>[], newNodes: Node<FlowNodeData>[]): boolean => {
    if (oldNodes.length !== newNodes.length) return false;

    // List of all shader slider properties that should be ignored
    const SLIDER_PROPERTIES = [
      'dotSize', 'angle', 'contrast', 'spacing', 'halftoneThreshold',
      'tapeWaveIntensity', 'tapeCreaseIntensity', 'switchingNoiseIntensity',
      'bloomIntensity', 'acBeatIntensity', 'matrixSize', 'bias',
      'asciiCharSize', 'asciiThreshold',
    ];

    let hasShaderSliderChange = false;

    for (let i = 0; i < newNodes.length; i++) {
      const oldNode = oldNodes.find(n => n.id === newNodes[i].id);
      if (!oldNode) return false;

      // Only check shader nodes
      if (oldNode.type === 'shader' && newNodes[i].type === 'shader') {
        const oldData = oldNode.data as any;
        const newData = newNodes[i].data as any;

        // Check if any shader slider properties changed
        let sliderPropsChanged = false;
        for (const prop of SLIDER_PROPERTIES) {
          const oldValue = oldData[prop];
          const newValue = newData[prop];

          // Compare values (handling undefined as equal to default)
          if (oldValue !== newValue && (oldValue !== undefined || newValue !== undefined)) {
            sliderPropsChanged = true;
            break;
          }
        }

        if (sliderPropsChanged) {
          hasShaderSliderChange = true;

          // Check if anything else changed (excluding slider properties and position)
          const oldDataCopy = { ...oldData };
          const newDataCopy = { ...newData };

          // Remove all slider properties for comparison
          for (const prop of SLIDER_PROPERTIES) {
            delete oldDataCopy[prop];
            delete newDataCopy[prop];
          }

          // Remove position from comparison
          const { position: oldPos, ...oldNodeWithoutPos } = oldNode;
          const { position: newPos, ...newNodeWithoutPos } = newNodes[i];

          // Compare data without slider properties
          const oldDataStr = JSON.stringify({ ...oldNodeWithoutPos, data: oldDataCopy });
          const newDataStr = JSON.stringify({ ...newNodeWithoutPos, data: newDataCopy });

          if (oldDataStr !== newDataStr) {
            // Something else changed besides slider properties
            return false;
          }
        }
      } else {
        // For non-shader nodes, check if anything changed (excluding position)
        const { position: oldPos, ...oldNodeWithoutPos } = oldNode;
        const { position: newPos, ...newNodeWithoutPos } = newNodes[i];

        const oldStr = JSON.stringify(oldNodeWithoutPos);
        const newStr = JSON.stringify(newNodeWithoutPos);

        if (oldStr !== newStr) {
          // Non-shader node changed
          return false;
        }
      }
    }

    // Only return true if there was at least one shader slider change and nothing else changed
    return hasShaderSliderChange;
  }, []);

  // Log connection state changes
  useEffect(() => {
    if (!isCollaborative || !roomId) return;

    console.log('[Liveblocks] 🔌 Connection state:', status, 'for room:', roomId);

    if (status === 'connected') {
      console.log('[Liveblocks] ✅ Connected to room:', roomId);
    } else if (status === 'connecting') {
      console.log('[Liveblocks] 🔄 Connecting to room:', roomId);
    } else if (status === 'reconnecting') {
      console.log('[Liveblocks] 🔄 Reconnecting to room:', roomId);
    } else if (status === 'initial') {
      console.log('[Liveblocks] ⏳ Initializing connection to room:', roomId);
    }
  }, [status, roomId, isCollaborative]);

  // Only proceed if collaborative mode is enabled
  if (!isCollaborative || !roomId) {
    console.log('[Liveblocks] ⏸️ Collaboration disabled or no roomId. isCollaborative:', isCollaborative, 'roomId:', roomId);
    return {
      others: [],
      isConnected: false,
      roomId: null,
    };
  }

  // Get storage for nodes and edges using selectors
  const liveNodes = useStorage((root) => root.nodes);
  const liveEdges = useStorage((root) => root.edges);

  // Get other users
  const others = useOthers();

  // Get presence update function
  const updateMyPresence = useUpdateMyPresence();

  // Refs to store latest values for debounced logging
  const liveNodesRef = useRef(liveNodes);
  const liveEdgesRef = useRef(liveEdges);
  const othersRef = useRef(others);

  // Update refs when values change
  useEffect(() => {
    liveNodesRef.current = liveNodes;
    liveEdgesRef.current = liveEdges;
    othersRef.current = others;
  }, [liveNodes, liveEdges, others]);

  // Debounced logging function to reduce console spam during node dragging
  const debouncedLogStorageState = useRef<ReturnType<typeof debounce> | null>(null);

  // Initialize debounced logger once
  useEffect(() => {
    if (!debouncedLogStorageState.current) {
      debouncedLogStorageState.current = debounce(() => {
        if (!isCollaborative || !roomId) return;

        const currentLiveNodes = liveNodesRef.current;
        const currentLiveEdges = liveEdgesRef.current;
        const currentOthers = othersRef.current;

        console.log('[Liveblocks] 📦 Storage available:', !!(currentLiveNodes || currentLiveEdges));
        try {
          const nodesCount = currentLiveNodes && typeof currentLiveNodes === 'object' && 'toArray' in currentLiveNodes
            ? (currentLiveNodes as any).toArray().length
            : 0;
          const edgesCount = currentLiveEdges && typeof currentLiveEdges === 'object' && 'toArray' in currentLiveEdges
            ? (currentLiveEdges as any).toArray().length
            : 0;
          console.log('[Liveblocks] 📊 Live nodes count:', nodesCount);
          console.log('[Liveblocks] 📊 Live edges count:', edgesCount);
        } catch (error) {
          console.log('[Liveblocks] 📊 Live nodes count: 0');
          console.log('[Liveblocks] 📊 Live edges count: 0');
        }
        console.log('[Liveblocks] 👥 Other users count:', currentOthers?.length ?? 0);

        if (currentOthers && currentOthers.length > 0) {
          console.log('[Liveblocks] 👥 Other users:', currentOthers.map(u => ({ id: u.id, name: u.info?.name })));
        }
      }, 500); // Debounce by 500ms to reduce logs during dragging
    }
  }, [isCollaborative, roomId]);

  // Log storage and others state (debounced to prevent spam during dragging)
  useEffect(() => {
    if (!isCollaborative || !roomId || !debouncedLogStorageState.current) return;

    // Trigger debounced logging
    debouncedLogStorageState.current();
  }, [liveNodes, liveEdges, others, isCollaborative, roomId]);

  // Initialize storage from database
  const initializeStorage = useMutation(
    ({ storage }) => {
      if (!isInitializedRef.current && nodes.length > 0) {
        // Convert to plain JSON objects to ensure LSON compatibility (removes functions, circular refs, etc.)
        const nodesList = new LiveList(
          nodes.map((node) => new LiveObject(JSON.parse(JSON.stringify(node))))
        );
        const edgesList = new LiveList(
          edges.map((edge) => new LiveObject(JSON.parse(JSON.stringify(edge))))
        );
        storage.set('nodes', nodesList);
        storage.set('edges', edgesList);
        isInitializedRef.current = true;
      }
    },
    [nodes, edges]
  );

  // Update nodes in Liveblocks
  const updateNodes = useMutation(
    ({ storage }, newNodes: Node<FlowNodeData>[]) => {
      const nodesList = storage.get('nodes');
      if (nodesList && nodesList instanceof LiveList) {
        // Clear and update
        while (nodesList.length > 0) {
          nodesList.delete(0);
        }
        newNodes.forEach((node) => {
          // Convert to plain JSON object to ensure LSON compatibility
          nodesList.push(new LiveObject(JSON.parse(JSON.stringify(node))));
        });
      }
    },
    []
  );

  // Update edges in Liveblocks
  const updateEdges = useMutation(
    ({ storage }, newEdges: Edge[]) => {
      const edgesList = storage.get('edges');
      if (edgesList && edgesList instanceof LiveList) {
        // Clear and update
        while (edgesList.length > 0) {
          edgesList.delete(0);
        }
        newEdges.forEach((edge) => {
          // Convert to plain JSON object to ensure LSON compatibility
          edgesList.push(new LiveObject(JSON.parse(JSON.stringify(edge))));
        });
      }
    },
    []
  );

  // Sync from Liveblocks to local state
  useEffect(() => {
    if (!isCollaborative || !liveNodes || !liveEdges) return;

    // Type guard: ensure liveNodes and liveEdges are LiveList instances
    if (!(liveNodes instanceof LiveList) || !(liveEdges instanceof LiveList)) {
      return;
    }

    const nodesArray = liveNodes.toArray().map((node: any) => node.toObject());
    const edgesArray = liveEdges.toArray().map((edge: any) => edge.toObject());

    // Only update if different to avoid infinite loops
    const nodesChanged = JSON.stringify(nodesArray) !== JSON.stringify(nodes);
    const edgesChanged = JSON.stringify(edgesArray) !== JSON.stringify(edges);

    if (nodesChanged || edgesChanged) {
      setNodes(nodesArray);
      setEdges(edgesArray);
      // Update lastSyncedNodesRef when receiving updates from Liveblocks
      if (nodesChanged) {
        lastSyncedNodesRef.current = nodesArray;
      }
    }
  }, [liveNodes, liveEdges, isCollaborative, setNodes, setEdges, nodes, edges]);

  // Initialize storage when collaborative mode is enabled
  useEffect(() => {
    // Wait for storage to be loaded before initializing
    // Storage is ready when useStorage returns non-null values
    // Skip if not in collaborative mode or missing requirements
    if (!isCollaborative || !projectId || nodes.length === 0 || isInitializedRef.current) {
      return;
    }

    // Wait for connection state to be connected AND storage to be available
    // useStorage returns null until storage is loaded, so we check both conditions
    const isStorageReady = liveNodes !== null && liveEdges !== null;

    if (status === 'connected' && isStorageReady) {
      console.log('[Liveblocks] 🚀 Initializing storage for room:', roomId, 'with', nodes.length, 'nodes and', edges.length, 'edges');
      try {
        initializeStorage();
        console.log('[Liveblocks] ✅ Storage initialized successfully');
      } catch (error) {
        console.error('[Liveblocks] ❌ Error initializing storage:', error);
      }
    } else {
      // Connection not yet connected or storage not ready
      if (status !== 'connected') {
        console.log('[Liveblocks] ⏳ Waiting for connection to open. Current state:', status);
      } else if (!isStorageReady) {
        console.log('[Liveblocks] ⏳ Waiting for storage to load...');
      }
    }
  }, [isCollaborative, projectId, nodes, edges, initializeStorage, status, roomId, liveNodes, liveEdges]);

  // Sync local changes to Liveblocks (instant for position changes, debounced for others)
  const syncToLiveblocksInstant = useCallback(
    (newNodes: Node<FlowNodeData>[], newEdges: Edge[]) => {
      if (!isCollaborative || !isInitializedRef.current) return;
      try {
        updateNodes(newNodes);
        updateEdges(newEdges);
        lastSyncedNodesRef.current = newNodes;
      } catch (error) {
        console.error('Error syncing to Liveblocks (instant):', error);
      }
    },
    [isCollaborative, updateNodes, updateEdges]
  );

  // Sync local changes to Liveblocks (debounced for non-position changes)
  const syncToLiveblocksDebounced = useCallback(
    debounce((newNodes: Node<FlowNodeData>[], newEdges: Edge[]) => {
      if (!isCollaborative || !isInitializedRef.current) return;
      try {
        updateNodes(newNodes);
        updateEdges(newEdges);
        lastSyncedNodesRef.current = newNodes;
      } catch (error) {
        console.error('Error syncing to Liveblocks (debounced):', error);
      }
    }, 100),
    [isCollaborative, updateNodes, updateEdges]
  );

  // Sync local changes to database (debounced, less frequent)
  const syncToDatabase = useCallback(
    debounce(async (newNodes: Node<FlowNodeData>[], newEdges: Edge[]) => {
      if (!isCollaborative || !projectId || !onSave) return;

      // Only save if there are actual changes
      const nodesChanged = JSON.stringify(newNodes) !== JSON.stringify(lastSavedNodesRef.current);
      const edgesChanged = JSON.stringify(newEdges) !== JSON.stringify(lastSavedEdgesRef.current);

      if (nodesChanged || edgesChanged) {
        // Skip save if changes are only to shader slider properties
        // This prevents authentication requests on every slider change
        // while still allowing visual updates and Liveblocks sync
        if (lastSavedNodesRef.current.length > 0 && isShaderSliderOnlyChange(lastSavedNodesRef.current, newNodes)) {
          // Update lastSavedNodesRef to prevent repeated checks, but don't save
          lastSavedNodesRef.current = newNodes;
          lastSavedEdgesRef.current = newEdges;
          return;
        }

        try {
          lastSavedNodesRef.current = newNodes;
          lastSavedEdgesRef.current = newEdges;
          await onSave();
        } catch (error) {
          console.error('Error syncing to database:', error);
        }
      }
    }, 2000), // Save to database every 2 seconds
    [isCollaborative, projectId, onSave, isShaderSliderOnlyChange]
  );

  // Watch for local changes and sync
  useEffect(() => {
    if (!isCollaborative || !isInitializedRef.current) return;

    // Check if this is only a position change for instant sync
    const isPositionOnly = lastSyncedNodesRef.current.length > 0 &&
      isOnlyPositionChange(lastSyncedNodesRef.current, nodes);

    if (isPositionOnly) {
      // Instant sync for position changes
      syncToLiveblocksInstant(nodes, edges);
    } else {
      // Debounced sync for other changes
      syncToLiveblocksDebounced(nodes, edges);
    }

    syncToDatabase(nodes, edges);
  }, [nodes, edges, isCollaborative, syncToLiveblocksInstant, syncToLiveblocksDebounced, syncToDatabase, isOnlyPositionChange]);

  // Reset initialization when project changes
  useEffect(() => {
    if (projectId) {
      isInitializedRef.current = false;
      lastSavedNodesRef.current = [];
      lastSavedEdgesRef.current = [];
      lastSyncedNodesRef.current = [];
    }
  }, [projectId]);

  // Initialize lastSyncedNodesRef when storage is initialized
  useEffect(() => {
    if (isInitializedRef.current && nodes.length > 0 && lastSyncedNodesRef.current.length === 0) {
      lastSyncedNodesRef.current = nodes;
    }
  }, [isInitializedRef.current, nodes]);

  // Update node position in presence during drag
  const updateNodePositionInPresence = useCallback(
    (nodeId: string, x: number, y: number) => {
      if (!isCollaborative) return;
      updateMyPresence({
        nodePosition: { nodeId, x, y },
        isMoving: true,
      });
    },
    [isCollaborative, updateMyPresence]
  );

  // Clear node position from presence when drag ends
  const clearNodePositionInPresence = useCallback(() => {
    if (!isCollaborative) return;
    updateMyPresence({
      nodePosition: null,
      isMoving: false,
    });
  }, [isCollaborative, updateMyPresence]);

  // Check if another user is currently moving a specific node
  const isNodeBeingMovedByOthers = useCallback(
    (nodeId: string): { isMoving: boolean; userId?: string; userName?: string } => {
      if (!isCollaborative || !others || others.length === 0) {
        return { isMoving: false };
      }

      for (const other of others) {
        const presence = other.presence as any;
        const nodePosition = presence?.nodePosition as { nodeId: string; x: number; y: number } | null | undefined;
        if (
          nodePosition?.nodeId === nodeId &&
          presence?.isMoving === true
        ) {
          return {
            isMoving: true,
            userId: other.id,
            userName: other.info?.name || other.id,
          };
        }
      }

      return { isMoving: false };
    },
    [isCollaborative, others]
  );

  // Get all nodes currently being moved by others
  const getNodesBeingMovedByOthers = useCallback((): Array<{
    nodeId: string;
    userId: string;
    userName: string;
    position: { x: number; y: number };
  }> => {
    if (!isCollaborative || !others || others.length === 0) {
      return [];
    }

    const movingNodes: Array<{
      nodeId: string;
      userId: string;
      userName: string;
      position: { x: number; y: number };
    }> = [];

    for (const other of others) {
      const presence = other.presence as any;
      const nodePosition = presence?.nodePosition as { nodeId: string; x: number; y: number } | null | undefined;
      if (
        nodePosition &&
        presence?.isMoving === true
      ) {
        movingNodes.push({
          nodeId: nodePosition.nodeId,
          userId: other.id,
          userName: other.info?.name || other.id,
          position: {
            x: nodePosition.x,
            y: nodePosition.y,
          },
        });
      }
    }

    return movingNodes;
  }, [isCollaborative, others]);

  return {
    others: others || [],
    isConnected: status === 'connected',
    roomId,
    updateNodePositionInPresence,
    clearNodePositionInPresence,
    isNodeBeingMovedByOthers,
    getNodesBeingMovedByOthers,
  };
};

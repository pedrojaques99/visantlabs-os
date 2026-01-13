// Define Liveblocks types for your application
// https://liveblocks.io/docs/api-reference/liveblocks-react#Typing-your-data
import type { Node, Edge } from '@xyflow/react';
import type { FlowNodeData } from './types/reactFlow';
import type { LiveList, LiveObject } from '@liveblocks/client';

// Create a serializable version of FlowNodeData by omitting function properties
type SerializableFlowNodeData = {
  [K in keyof FlowNodeData]: FlowNodeData[K] extends Function ? never : FlowNodeData[K];
};

declare global {
  interface Liveblocks {
    // Each user's Presence, for useMyPresence, useOthers, etc.
    Presence: {
      cursor: { x: number; y: number } | null;
      selectedNodeId: string | null;
      nodePosition: { nodeId: string; x: number; y: number } | null;
      isMoving: boolean;
    };

    // The Storage tree for the room, for useMutation, useStorage, etc.
    Storage: {
      nodes: LiveList<LiveObject<any>>;
      edges: LiveList<LiveObject<any>>;
    };

    // Custom user info set when authenticating with a secret key
    UserMeta: {
      id: string;
      info: {
        name: string;
        email?: string;
        picture?: string;
      };
    };

    // Custom events, for useBroadcastEvent, useEventListener
    RoomEvent: {};

    // Custom metadata set on threads, for useThreads, useCreateThread, etc.
    ThreadMetadata: {};

    // Custom room info set with resolveRoomsInfo, for useRoomInfo
    RoomInfo: {};
  }
}

export { };

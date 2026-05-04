import { createClient } from '@liveblocks/client';
import { createRoomContext } from '@liveblocks/react';
import { authService } from '../services/authService';
import { API_BASE } from './api';

const client = createClient({
  async resolveUsers({ userIds }) {
    console.log('[Liveblocks] resolveUsers called with userIds:', userIds);
    return userIds.map((userId) => ({
      name: userId,
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${userId}`,
    }));
  },
  async resolveMentionSuggestions({ text }) {
    return [];
  },
  async authEndpoint(room) {
    try {
      const token = authService.getToken();
      if (!token) throw new Error('Authentication token not found. Please log in.');

      // Route to the correct backend auth endpoint based on room prefix
      let authPath: string;
      if (room.startsWith('brand-')) {
        const guidelineId = room.replace('brand-', '');
        authPath = `${API_BASE}/brand-guidelines/${guidelineId}/liveblocks-auth`;
      } else if (room.startsWith('canvas-')) {
        const projectId = room.replace('canvas-', '');
        authPath = `${API_BASE}/canvas/${projectId}/liveblocks-auth`;
      } else {
        throw new Error(`Unknown room prefix for room "${room}". Expected "brand-" or "canvas-".`);
      }

      const response = await fetch(authPath, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(`Liveblocks auth failed ${response.status}: ${errorText}`);
      }

      const parsed = await response.json();
      return { token: parsed.token };
    } catch (error) {
      throw error;
    }
  },
});

// Types are now defined in liveblocks.config.ts and available globally
// Using the global Liveblocks interface types
export const {
  RoomProvider,
  useRoom,
  useStorage,
  useOthers,
  useMutation,
  useSelf,
  useUpdateMyPresence,
  useStatus,
  useHistory,
} = createRoomContext(client);

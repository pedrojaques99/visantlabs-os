import { createClient } from '@liveblocks/client';
import { createRoomContext } from '@liveblocks/react';
import { authService } from '../services/authService';

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
    console.log('[Liveblocks] 🔐 Auth endpoint called for room:', room);
    try {
      // Get auth token from backend
      const projectId = room.replace('canvas-', '');
      const token = authService.getToken();
      
      console.log('[Liveblocks] Project ID extracted:', projectId);
      console.log('[Liveblocks] Token available:', !!token);
      
      if (!token) {
        console.error('[Liveblocks] ❌ Authentication token not found');
        throw new Error('Authentication token not found. Please log in.');
      }

      console.log('[Liveblocks] 📡 Calling auth endpoint: /api/canvas/' + projectId + '/liveblocks-auth');
      const response = await fetch(`/api/canvas/${projectId}/liveblocks-auth`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      console.log('[Liveblocks] Auth response status:', response.status, response.statusText);

      if (!response.ok) {
        // Don't throw error for 401/403 - let Liveblocks handle it gracefully
        if (response.status === 401 || response.status === 403) {
          const errorText = await response.text().catch(() => 'Unauthorized');
          console.warn(`[Liveblocks] ⚠️ Auth failed: ${response.status} ${errorText}`);
          // Return an error object that Liveblocks can handle
          throw new Error(`Unauthorized: ${errorText}`);
        }
        
        const errorText = await response.text().catch(() => 'Unknown error');
        console.error('[Liveblocks] ❌ Auth error:', response.status, errorText);
        throw new Error(`Failed to authenticate with Liveblocks: ${response.status} ${errorText}`);
      }

      console.log('[Liveblocks] ✅ Auth successful for room:', room);
      
      // Parse the response body to get the Liveblocks token
      // The backend returns a JSON string with format: '{ token: "..." }'
      const responseText = await response.text();
      let liveblocksToken: string;
      
      try {
        const parsed = JSON.parse(responseText);
        liveblocksToken = parsed.token;
      } catch (parseError) {
        console.error('[Liveblocks] ❌ Failed to parse auth response:', parseError);
        throw new Error('Invalid response format from Liveblocks auth endpoint');
      }
      
      // Liveblocks expects an object with a token property
      return { token: liveblocksToken };
    } catch (error: any) {
      console.error('[Liveblocks] ❌ Auth endpoint error:', error);
      // Re-throw the error so Liveblocks can handle it properly
      throw error;
    }
  },
});

console.log('[Liveblocks] 🚀 Client initialized');

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
} = createRoomContext(client);

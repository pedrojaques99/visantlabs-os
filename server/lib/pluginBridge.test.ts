/**
 * PluginBridge Unit Tests
 * Run with: npm test server/lib/pluginBridge.test.ts
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { pluginBridge, PluginSession } from './pluginBridge';
import WebSocket from 'ws';

describe('PluginBridge', () => {
  let mockWs: any;
  let session: PluginSession;

  beforeEach(() => {
    // Create mock WebSocket
    mockWs = {
      readyState: WebSocket.OPEN,
      send: (data: string, callback?: (err?: Error) => void) => {
        if (callback) callback();
      },
      close: () => {},
      ping: (callback?: (err?: Error) => void) => {
        if (callback) callback();
      },
      on: () => {},
      removeListener: () => {},
    };
  });

  it('should register and unregister sessions', () => {
    session = pluginBridge.register('file-1', mockWs, 'user-1');

    expect(session).toBeDefined();
    expect(session.fileId).toBe('file-1');
    expect(session.userId).toBe('user-1');

    const retrieved = pluginBridge.getSession('file-1');
    expect(retrieved).toBe(session);

    pluginBridge.unregister('file-1');
    const unreg = pluginBridge.getSession('file-1');
    expect(unreg).toBeNull();
  });

  it('should push operations to connected plugin', async () => {
    session = pluginBridge.register('file-2', mockWs, 'user-2');

    const operations = [
      {
        type: 'CREATE_RECTANGLE',
        props: { name: 'test', width: 100, height: 100 },
      },
    ];

    // Simulate ACK from plugin
    setTimeout(() => {
      pluginBridge.onMessage('file-2', {
        type: 'OPERATION_ACK',
        opId: Array.from(session.pendingAcks.keys())[0],
        appliedCount: 1,
      });
    }, 50);

    const result = await pluginBridge.push('file-2', operations);

    expect(result.success).toBe(true);
    expect(result.appliedCount).toBe(1);
  });

  it('should timeout on no ACK', async () => {
    // Create session with short timeout
    session = pluginBridge.register('file-3', mockWs, 'user-3');

    const operations = [
      {
        type: 'CREATE_RECTANGLE',
        props: { name: 'test', width: 100, height: 100 },
      },
    ];

    // Don't send ACK, let it timeout
    const result = await pluginBridge.push('file-3', operations);

    expect(result.success).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors![0]).toContain('timeout');

    pluginBridge.unregister('file-3');
  }, 15000);

  it('should handle operation errors from plugin', async () => {
    session = pluginBridge.register('file-4', mockWs, 'user-4');

    const operations = [
      {
        type: 'CREATE_RECTANGLE',
        props: { name: 'test', width: 100, height: 100 },
      },
    ];

    // Simulate error from plugin
    setTimeout(() => {
      const opId = Array.from(session.pendingAcks.keys())[0];
      pluginBridge.onMessage('file-4', {
        type: 'OPERATION_ERROR',
        opId,
        error: 'Node not found',
      });
    }, 50);

    const result = await pluginBridge.push('file-4', operations);

    expect(result.success).toBe(false);
    expect(result.errors).toContain('Node not found');

    pluginBridge.unregister('file-4');
  });

  it('should return error for unknown session', async () => {
    const operations = [
      {
        type: 'CREATE_RECTANGLE',
        props: { name: 'test', width: 100, height: 100 },
      },
    ];

    const result = await pluginBridge.push('unknown-file', operations);

    expect(result.success).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors![0]).toContain('not connected');
  });

  it('should maintain selection change events', () => {
    session = pluginBridge.register('file-5', mockWs, 'user-5');

    const event = {
      type: 'SELECTION_CHANGED',
      nodes: [
        { name: 'Layer 1', id: 'id-1', type: 'FRAME' },
        { name: 'Layer 2', id: 'id-2', type: 'RECTANGLE' },
      ],
    };

    // Should not throw
    expect(() => pluginBridge.onMessage('file-5', event)).not.toThrow();

    pluginBridge.unregister('file-5');
  });

  it('should get session info for debugging', () => {
    pluginBridge.register('file-6', mockWs, 'user-6');
    pluginBridge.register('file-7', mockWs, 'user-7');

    const sessions = pluginBridge.getSessions();

    expect(sessions.length).toBeGreaterThanOrEqual(2);
    expect(sessions.some((s) => s.fileId === 'file-6')).toBe(true);
    expect(sessions.some((s) => s.userId === 'user-7')).toBe(true);

    pluginBridge.unregister('file-6');
    pluginBridge.unregister('file-7');
  });
});

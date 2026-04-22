/**
 * PluginBridge — WebSocket connection management for Figma plugin
 * Manages plugin sessions, operation queuing, and ACK tracking
 */

import WebSocket from 'ws';
import { EventEmitter } from 'events';
import { pluginQueue, type QueuedBatch } from './pluginQueue.js';

/**
 * Emitted events:
 *   'drain:complete'  { fileId, userId, batches: QueuedBatch[], appliedCount: number }
 *   'drain:failed'    { fileId, userId, error: string }
 */
export const pluginBridgeEvents = new EventEmitter();

export interface Operation {
  type: string;
  [key: string]: any;
}

export interface PendingAck {
  resolve: (result: any) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
}

export interface PluginSession {
  fileId: string;
  ws: WebSocket;
  userId: string;
  connectedAt: Date;
  lastHeartbeat: Date;
  operationQueue: Array<{ operations: Operation[]; opId: string }>;
  pendingAcks: Map<string, PendingAck>;
  heartbeatInterval?: ReturnType<typeof setInterval>;
}

/**
 * Singleton bridge managing all plugin WebSocket connections
 */
class PluginBridge {
  private sessions: Map<string, PluginSession> = new Map();
  private readonly operationTimeout = parseInt(
    process.env.FIGMA_WS_OP_TIMEOUT || '10000',
  ); // 10 seconds
  private readonly heartbeatInterval = 30000; // 30 seconds

  /** Whether the plugin is currently connected and WebSocket is open. */
  isConnected(fileId: string): boolean {
    const s = this.sessions.get(fileId);
    return !!s && s.ws.readyState === WebSocket.OPEN;
  }

  /**
   * Register a new plugin WebSocket connection.
   * Automatically drains any pending Redis queue after registration.
   */
  register(fileId: string, ws: WebSocket, userId: string): PluginSession {
    if (this.sessions.has(fileId)) {
      const oldSession = this.sessions.get(fileId)!;
      oldSession.ws.close(1000, 'New connection');
    }

    const session: PluginSession = {
      fileId,
      ws,
      userId,
      connectedAt: new Date(),
      lastHeartbeat: new Date(),
      operationQueue: [],
      pendingAcks: new Map(),
    };

    this.sessions.set(fileId, session);
    this.startHeartbeat(session);

    console.log(`[PluginBridge] Session registered: fileId=${fileId}, userId=${userId}`);

    // Drain any ops queued while plugin was offline (fire-and-forget)
    this.drainQueue(fileId).catch((err) =>
      console.error(`[PluginBridge] drainQueue error for ${fileId}:`, err),
    );

    return session;
  }

  /**
   * Drain the Redis queue for a fileId.
   * Applies each batch in order, then clears the queue.
   * Emits 'drain:complete' or 'drain:failed' on pluginBridgeEvents.
   */
  private async drainQueue(fileId: string): Promise<void> {
    const pending = await pluginQueue.peek(fileId);
    if (pending.length === 0) return;

    console.log(`[PluginBridge] Draining ${pending.length} queued batch(es) for ${fileId}`);

    let totalApplied = 0;
    const session = this.sessions.get(fileId);
    if (!session) return;

    try {
      for (const batch of pending) {
        const result = await this.push(fileId, batch.operations);
        if (result.success) {
          totalApplied += result.appliedCount;
        } else {
          throw new Error(result.errors?.join(', ') || 'apply failed');
        }
      }

      await pluginQueue.clear(fileId);

      pluginBridgeEvents.emit('drain:complete', {
        fileId,
        userId: session.userId,
        batches: pending,
        appliedCount: totalApplied,
      });

      console.log(`[PluginBridge] Drain complete: ${totalApplied} ops applied for ${fileId}`);
    } catch (err: any) {
      pluginBridgeEvents.emit('drain:failed', {
        fileId,
        userId: session.userId,
        batches: pending,
        error: err.message,
      });
      console.error(`[PluginBridge] Drain failed for ${fileId}:`, err.message);
    }
  }

  /**
   * Push operations to plugin and wait for ACK
   * Returns promise that resolves when operations are applied
   */
  async push(
    fileId: string,
    operations: Operation[],
  ): Promise<{
    success: boolean;
    appliedCount: number;
    errors?: string[];
  }> {
    const session = this.sessions.get(fileId);

    if (!session) {
      return {
        success: false,
        appliedCount: 0,
        errors: [`Plugin not connected for fileId: ${fileId}`],
      };
    }

    if (session.ws.readyState !== WebSocket.OPEN) {
      return {
        success: false,
        appliedCount: 0,
        errors: [`WebSocket not open (state: ${session.ws.readyState})`],
      };
    }

    // Generate unique operation ID
    const opId = `op-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Create promise for ACK
    const ackPromise = new Promise<{
      success: boolean;
      appliedCount: number;
      errors?: string[];
    }>((resolve, reject) => {
      const timeout = setTimeout(() => {
        session.pendingAcks.delete(opId);
        reject(
          new Error(
            `Operation timeout (${this.operationTimeout}ms) for opId=${opId}`,
          ),
        );
      }, this.operationTimeout);

      session.pendingAcks.set(opId, {
        resolve,
        reject,
        timeout,
      });
    });

    // Send message to plugin
    try {
      const message = {
        type: 'AGENT_OPS',
        operations,
        opId,
      };

      session.ws.send(JSON.stringify(message), (err) => {
        if (err) {
          session.pendingAcks.delete(opId);
          console.error(
            `[PluginBridge] Failed to send message to ${fileId}:`,
            err,
          );
        }
      });

      // Wait for ACK
      const result = await ackPromise;
      console.log(
        `[PluginBridge] Operation ${opId} completed: ${result.appliedCount} applied`,
      );
      return result;
    } catch (err) {
      return {
        success: false,
        appliedCount: 0,
        errors: [err instanceof Error ? err.message : String(err)],
      };
    }
  }

  /**
   * Send a request to plugin and wait for response
   * Used for queries like GET_TEMPLATES that expect data back
   */
  async request<T = any>(
    fileId: string,
    message: { type: string; [key: string]: any }
  ): Promise<T | null> {
    const session = this.sessions.get(fileId);

    if (!session || session.ws.readyState !== WebSocket.OPEN) {
      console.warn(`[PluginBridge] No active session for request: ${fileId}`);
      return null;
    }

    const requestId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    return new Promise<T | null>((resolve) => {
      const timeout = setTimeout(() => {
        session.pendingAcks.delete(requestId);
        console.warn(`[PluginBridge] Request timeout: ${message.type}`);
        resolve(null);
      }, this.operationTimeout);

      session.pendingAcks.set(requestId, {
        resolve: (result: any) => resolve(result as T),
        reject: () => resolve(null),
        timeout,
      });

      try {
        session.ws.send(JSON.stringify({ ...message, requestId }));
      } catch (err) {
        clearTimeout(timeout);
        session.pendingAcks.delete(requestId);
        resolve(null);
      }
    });
  }

  /**
   * Handle incoming messages from plugin
   */
  onMessage(fileId: string, message: any): void {
    const session = this.sessions.get(fileId);
    if (!session) {
      console.warn(
        `[PluginBridge] Received message for unknown session: ${fileId}`,
      );
      return;
    }

    const { type, opId } = message;

    // Update heartbeat
    session.lastHeartbeat = new Date();

    switch (type) {
      case 'OPERATION_ACK': {
        // Operation applied successfully
        const pending = session.pendingAcks.get(opId);
        if (pending) {
          clearTimeout(pending.timeout);
          session.pendingAcks.delete(opId);
          pending.resolve({
            success: true,
            appliedCount: message.appliedCount || 1,
          });
        }
        break;
      }

      case 'OPERATION_ERROR': {
        // Operation failed in plugin
        const pending = session.pendingAcks.get(opId);
        if (pending) {
          clearTimeout(pending.timeout);
          session.pendingAcks.delete(opId);
          pending.resolve({
            success: false,
            appliedCount: 0,
            errors: [message.error || 'Unknown error'],
          });
        }
        break;
      }

      case 'SELECTION_CHANGED': {
        // User selection changed (can be used for future broadcasts)
        console.log(
          `[PluginBridge] Selection changed in ${fileId}:`,
          message.nodes?.map((n: any) => n.name).join(', ') || '(empty)',
        );
        break;
      }

      case 'TEMPLATES_RESULT': {
        // Response to GET_TEMPLATES request
        const pending = session.pendingAcks.get(message.requestId || message.opId);
        if (pending) {
          clearTimeout(pending.timeout);
          session.pendingAcks.delete(message.requestId || message.opId);
          pending.resolve(message.templates || message.context || message.variables || message.base64 || message.results || message.mappings || []);
        }
        break;
      }

      case 'DESIGN_CONTEXT_RESULT':
      case 'VARIABLE_DEFS_RESULT':
      case 'SCREENSHOT_RESULT':
      case 'SEARCH_DS_RESULT':
      case 'CODE_CONNECT_RESULT': {
        const pending = session.pendingAcks.get(message.opId || message.requestId);
        if (pending) {
          clearTimeout(pending.timeout);
          session.pendingAcks.delete(message.opId || message.requestId);
          // Return the specific data field based on the message type
          let result = message;
          if (type === 'DESIGN_CONTEXT_RESULT') result = message.context;
          else if (type === 'VARIABLE_DEFS_RESULT') result = message.variables;
          else if (type === 'SCREENSHOT_RESULT') result = message.base64;
          else if (type === 'SEARCH_DS_RESULT') result = message.results;
          else if (type === 'CODE_CONNECT_RESULT') result = message.mappings;
          
          pending.resolve(result);
        }
        break;
      }

      default:
        console.warn(`[PluginBridge] Unknown message type from ${fileId}: ${type}`);
    }
  }

  /**
   * Unregister session and clean up
   */
  unregister(fileId: string): void {
    const session = this.sessions.get(fileId);
    if (!session) return;

    // Clear pending ACKs
    for (const [, pending] of session.pendingAcks) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('Session closed'));
    }
    session.pendingAcks.clear();

    // Clear heartbeat
    if (session.heartbeatInterval) {
      clearInterval(session.heartbeatInterval);
    }

    this.sessions.delete(fileId);
    console.log(`[PluginBridge] Session unregistered: fileId=${fileId}`);
  }

  /**
   * Get session info (for debugging)
   */
  getSession(fileId: string): PluginSession | null {
    return this.sessions.get(fileId) || null;
  }

  /**
   * Get all active sessions (for debugging)
   */
  getSessions(): Array<{
    fileId: string;
    userId: string;
    connectedAt: string;
    queueSize: number;
    pendingAcks: number;
  }> {
    return Array.from(this.sessions.values()).map((s) => ({
      fileId: s.fileId,
      userId: s.userId,
      connectedAt: s.connectedAt.toISOString(),
      queueSize: s.operationQueue.length,
      pendingAcks: s.pendingAcks.size,
    }));
  }

  /**
   * Send a fire-and-forget notification to the plugin (no ACK expected)
   */
  notify(fileId: string, payload: Record<string, unknown>): void {
    const session = this.sessions.get(fileId);
    if (!session || session.ws.readyState !== WebSocket.OPEN) return;
    try {
      session.ws.send(JSON.stringify(payload));
    } catch (err) {
      console.warn(`[PluginBridge] notify failed for ${fileId}:`, err);
    }
  }

  /**
   * Start heartbeat to detect stale connections
   */
  private startHeartbeat(session: PluginSession): void {
    session.heartbeatInterval = setInterval(() => {
      if (session.ws.readyState === WebSocket.OPEN) {
        session.ws.ping((err: Error | undefined) => {
          if (err) {
            console.error(
              `[PluginBridge] Heartbeat failed for ${session.fileId}:`,
              err,
            );
            this.unregister(session.fileId);
          }
        });
      }
    }, this.heartbeatInterval);
  }
}

// Export singleton
export const pluginBridge = new PluginBridge();

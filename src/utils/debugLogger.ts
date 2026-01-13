/**
 * Throttled debug logger to prevent ERR_INSUFFICIENT_RESOURCES
 * Batches log entries and sends them at a controlled rate
 */

// Debug logging disabled
const LOG_ENDPOINT = '';
const THROTTLE_MS = 2000; // Minimum time between batches (increased to prevent resource exhaustion)
const MAX_BATCH_SIZE = 3; // Maximum entries per batch (reduced further to minimize concurrent requests)
const MAX_QUEUE_SIZE = 15; // Drop logs if queue gets too large (reduced to prevent memory issues)

interface LogEntry {
  location: string;
  message: string;
  data?: any;
  timestamp: number;
  sessionId?: string;
  runId?: string;
  hypothesisId?: string;
}

class ThrottledLogger {
  private queue: LogEntry[] = [];
  private lastSendTime = 0;
  private timeoutId: NodeJS.Timeout | null = null;
  private isSending = false;

  private async sendBatch() {
    // Debug logging disabled - no-op
    if (!LOG_ENDPOINT || this.isSending || this.queue.length === 0) return;
    // Clear queue if endpoint is disabled
    if (!LOG_ENDPOINT) {
      this.queue = [];
      return;
    }

    this.isSending = true;
    const now = Date.now();
    const timeSinceLastSend = now - this.lastSendTime;

    // Wait if we sent too recently
    if (timeSinceLastSend < THROTTLE_MS) {
      const waitTime = THROTTLE_MS - timeSinceLastSend;
      this.timeoutId = setTimeout(() => {
        this.timeoutId = null;
        this.isSending = false;
        this.sendBatch();
      }, waitTime);
      return;
    }

    // Take up to MAX_BATCH_SIZE entries
    const batch = this.queue.splice(0, MAX_BATCH_SIZE);
    this.lastSendTime = Date.now();

    try {
      // Send entries sequentially with small delays to prevent connection exhaustion
      // This prevents ERR_INSUFFICIENT_RESOURCES by spacing out requests
      for (let i = 0; i < batch.length; i++) {
        const entry = batch[i];
        try {
          await fetch(LOG_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(entry),
            keepalive: true, // Allow browser to send after page unload
          });
        } catch (error) {
          // Silently ignore errors
        }
        // Small delay between requests to prevent connection exhaustion
        if (i < batch.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }
    } catch (error) {
      // Silently ignore errors
    } finally {
      this.isSending = false;

      // Schedule next batch if queue has more entries
      if (this.queue.length > 0 && !this.timeoutId) {
        this.timeoutId = setTimeout(() => {
          this.timeoutId = null;
          this.sendBatch();
        }, THROTTLE_MS);
      }
    }
  }

  log(entry: LogEntry) {
    // Drop logs if queue is too large (prevents memory issues)
    if (this.queue.length >= MAX_QUEUE_SIZE) {
      // Silently drop - prevents resource exhaustion
      return;
    }

    // Skip high-frequency logs from the problematic useEffect
    // This prevents the ERR_INSUFFICIENT_RESOURCES error
    if (entry.location?.includes('useCanvasCollaboration.ts:397') || 
        entry.location?.includes('useCanvasCollaboration.ts:401') ||
        entry.location?.includes('useCanvasCollaboration.ts:408')) {
      // Only log every 20th occurrence to reduce frequency by 95%
      const locationKey = entry.location || 'unknown';
      const skipMap = (window as any).__debugSkipMap = (window as any).__debugSkipMap || {};
      skipMap[locationKey] = (skipMap[locationKey] || 0) + 1;
      if (skipMap[locationKey] % 20 !== 0) {
        return;
      }
    }

    this.queue.push(entry);

    // Trigger send if not already scheduled
    if (!this.timeoutId && !this.isSending) {
      this.timeoutId = setTimeout(() => {
        this.timeoutId = null;
        this.sendBatch();
      }, 0);
    }
  }
}

// Singleton instance
const logger = new ThrottledLogger();

/**
 * Throttled debug logging function
 * Use this instead of direct fetch calls to prevent ERR_INSUFFICIENT_RESOURCES
 */
export function debugLog(entry: Omit<LogEntry, 'timestamp'>) {
  logger.log({
    ...entry,
    timestamp: Date.now(),
  });
}


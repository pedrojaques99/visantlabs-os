/**
 * Simple EventEmitter for decoupled module communication
 * Best practice: Central event bus to avoid circular dependencies
 */

class EventEmitter {
  constructor() {
    this.events = new Map();
  }

  /**
   * Subscribe to an event
   * @param {string} event - Event name
   * @param {Function} listener - Callback function
   * @returns {Function} Unsubscribe function
   */
  on(event, listener) {
    if (!this.events.has(event)) {
      this.events.set(event, []);
    }
    this.events.get(event).push(listener);

    // Return unsubscribe function
    return () => {
      const listeners = this.events.get(event);
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    };
  }

  /**
   * Subscribe to event, auto-unsubscribe after first trigger
   * @param {string} event - Event name
   * @param {Function} listener - Callback function
   */
  once(event, listener) {
    const unsubscribe = this.on(event, (...args) => {
      listener(...args);
      unsubscribe();
    });
  }

  /**
   * Emit an event to all listeners
   * @param {string} event - Event name
   * @param {...any} args - Arguments to pass to listeners
   */
  emit(event, ...args) {
    if (this.events.has(event)) {
      this.events.get(event).forEach(listener => {
        try {
          listener(...args);
        } catch (e) {
          console.error(`[EventEmitter] Error in listener for ${event}:`, e);
        }
      });
    }
  }

  /**
   * Remove all listeners for an event
   * @param {string} event - Event name (optional, clears all if not provided)
   */
  removeAllListeners(event) {
    if (event) {
      this.events.delete(event);
    } else {
      this.events.clear();
    }
  }
}

// Global event emitter instance
const eventBus = new EventEmitter();

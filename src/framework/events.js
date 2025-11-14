// Event Handling Module - Custom Event System

export class EventEmitter {
  constructor() {
    this.events = {};
  }

  /**
   * Register an event listener
   * @param {string} eventName - Name of the event
   * @param {function} callback - Callback function
   * @param {object} options - Event options
   * @returns {function} Unsubscribe function
   */
  on(eventName, callback, options = {}) {
    if (!this.events[eventName]) {
      this.events[eventName] = [];
    }
    
    const listener = {
      callback,
      once: options.once || false,
      priority: options.priority || 0
    };
    
    this.events[eventName].push(listener);
    
    // Sort by priority (higher priority first)
    this.events[eventName].sort((a, b) => b.priority - a.priority);
    
    // Return unsubscribe function
    return () => this.off(eventName, callback);
  }

  /**
   * Register a one-time event listener
   * @param {string} eventName - Name of the event
   * @param {function} callback - Callback function
   * @returns {function} Unsubscribe function
   */
  once(eventName, callback) {
    return this.on(eventName, callback, { once: true });
  }

  /**
   * Remove an event listener
   * @param {string} eventName - Name of the event
   * @param {function} callback - Callback function to remove
   */
  off(eventName, callback) {
    if (!this.events[eventName]) return;
    
    const index = this.events[eventName].findIndex(listener => listener.callback === callback);
    if (index > -1) {
      this.events[eventName].splice(index, 1);
    }
  }

  /**
   * Emit an event
   * @param {string} eventName - Name of the event
   * @param {...*} args - Arguments to pass to listeners
   */
  emit(eventName, ...args) {
    if (!this.events[eventName]) return;
    
    // Create a copy to avoid issues if listeners are modified during emission
    const listeners = [...this.events[eventName]];
    
    for (let i = 0; i < listeners.length; i++) {
      const listener = listeners[i];
      
      try {
        listener.callback(...args);
        
        // Remove one-time listeners
        if (listener.once) {
          this.off(eventName, listener.callback);
        }
      } catch (error) {
        console.error('Error in event listener:', error);
      }
    }
  }

  /**
   * Remove all listeners for an event
   * @param {string} eventName - Name of the event
   */
  removeAllListeners(eventName) {
    if (eventName) {
      delete this.events[eventName];
    } else {
      this.events = {};
    }
  }
}


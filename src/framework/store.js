// State Management Module - Centralized Store

export class Store {
  constructor(initialState = {}) {
    this.state = { ...initialState };
    this.listeners = [];
    this.middlewares = [];
  }

  /**
   * Get current state
   * @returns {object} Current state
   */
  getState() {
    return { ...this.state };
  }

  /**
   * Subscribe to state changes
   * @param {function} listener - Function to call when state changes
   * @returns {function} Unsubscribe function
   */
  subscribe(listener) {
    this.listeners.push(listener);
    
    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * Dispatch an action to update state
   * @param {object} action - Action object with type and payload
   */
  dispatch(action) {
    // Apply middlewares
    let processedAction = action;
    for (const middleware of this.middlewares) {
      processedAction = middleware(processedAction, this.state);
    }
    
    // Update state based on action
    const newState = this.reducer(this.state, processedAction);
    
    if (newState !== this.state) {
      const oldState = this.state;
      this.state = newState;
      
      // Notify all listeners
      this.listeners.forEach(listener => {
        try {
          listener(newState, oldState, processedAction);
        } catch (error) {
          console.error('Error in state listener:', error);
        }
      });
    }
  }

  /**
   * Default reducer - can be overridden
   * @param {object} state - Current state
   * @param {object} action - Action to process
   * @returns {object} New state
   */
  reducer(state, action) {
    switch (action.type) {
      case 'SET_STATE':
        return { ...state, ...action.payload };
      
      case 'UPDATE_PROPERTY':
        return {
          ...state,
          [action.property]: action.value
        };
      
      case 'MERGE_STATE':
        return this.deepMerge(state, action.payload);
      
      case 'RESET_STATE':
        return action.payload || {};
      
      default:
        return state;
    }
  }

  /**
   * Set custom reducer
   * @param {function} reducer - Custom reducer function
   */
  setReducer(reducer) {
    this.reducer = reducer;
  }

  /**
   * Add middleware
   * @param {function} middleware - Middleware function
   */
  addMiddleware(middleware) {
    this.middlewares.push(middleware);
  }

  /**
   * Deep merge objects
   * @param {object} target - Target object
   * @param {object} source - Source object
   * @returns {object} Merged object
   */
  deepMerge(target, source) {
    const result = { ...target };
    
    for (const key in source) {
      if (source.hasOwnProperty(key)) {
        if (this.isObject(source[key]) && this.isObject(target[key])) {
          result[key] = this.deepMerge(target[key], source[key]);
        } else {
          result[key] = source[key];
        }
      }
    }
    
    return result;
  }

  /**
   * Check if value is an object
   * @param {*} value - Value to check
   * @returns {boolean} True if object
   */
  isObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }

  /**
   * Set state directly (for testing/debugging)
   * @param {object} newState - New state
   */
  setState(newState) {
    this.dispatch({
      type: 'SET_STATE',
      payload: newState
    });
  }

  /**
   * Update a specific property
   * @param {string} property - Property name
   * @param {*} value - New value
   */
  updateProperty(property, value) {
    this.dispatch({
      type: 'UPDATE_PROPERTY',
      property,
      value
    });
  }

  /**
   * Get a specific property from state
   * @param {string} property - Property name
   * @param {*} defaultValue - Default value if property doesn't exist
   * @returns {*} Property value
   */
  getProperty(property, defaultValue = undefined) {
    return this.state[property] !== undefined ? this.state[property] : defaultValue;
  }

  /**
   * Clear all listeners (useful for cleanup)
   */
  clearListeners() {
    this.listeners = [];
  }

  /**
   * Reset store to initial state
   * @param {object} initialState - Initial state to reset to
   */
  reset(initialState = {}) {
    this.dispatch({
      type: 'RESET_STATE',
      payload: initialState
    });
  }
}


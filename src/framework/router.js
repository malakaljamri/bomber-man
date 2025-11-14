// Router Module - URL Synchronization with App State

export class Router {
  constructor() {
    this.routes = {};
    this.currentRoute = null;
    this.beforeRouteChange = null;
    this.afterRouteChange = null;
    
    // Listen for URL changes
    window.addEventListener('popstate', this.handlePopState.bind(this));
    window.addEventListener('hashchange', this.handleHashChange.bind(this));
  }

  /**
   * Register a route with its handler
   * @param {string} path - Route path (supports parameters like /user/:id)
   * @param {function} handler - Route handler function
   */
  addRoute(path, handler) {
    this.routes[path] = handler;
  }

  /**
   * Navigate to a specific route
   * @param {string} path - Target path
   * @param {boolean} replace - Whether to replace current history entry
   */
  navigate(path, replace = false) {
    if (this.beforeRouteChange) {
      this.beforeRouteChange(this.currentRoute, path);
    }

    this.currentRoute = path;
    
    if (replace) {
      history.replaceState(null, '', path);
    } else {
      history.pushState(null, '', path);
    }
    
    this.handleRoute(path);
    
    if (this.afterRouteChange) {
      this.afterRouteChange(path);
    }
  }

  /**
   * Handle route changes
   * @param {string} path - Current path
   */
  handleRoute(path) {
    // Find matching route
    const { route, params } = this.matchRoute(path);
    
    if (route && this.routes[route]) {
      this.routes[route](params, path);
    } else {
      // Handle 404 case
      if (this.routes['*']) {
        this.routes['*']({}, path);
      }
    }
  }

  /**
   * Match current path against registered routes
   * @param {string} path - Path to match
   * @returns {object} Matched route and parameters
   */
  matchRoute(path) {
    // For hash-based routing, we want to keep the hash part
    let cleanPath = path.split('?')[0]; // Remove query params
    
    // If the path starts with a hash, keep it for hash-based routing
    if (path.startsWith('#') || path.includes('#')) {
      // Extract the hash part
      const hashIndex = path.indexOf('#');
      if (hashIndex !== -1) {
        cleanPath = path.substring(hashIndex);
      }
    }
    
    // Try exact match first
    if (this.routes[cleanPath]) {
      return { route: cleanPath, params: {} };
    }
    
    // Try pattern matching for parameterized routes
    for (const route of Object.keys(this.routes)) {
      const params = this.extractParams(route, cleanPath);
      if (params !== null) {
        return { route, params };
      }
    }
    
    return { route: null, params: {} };
  }

  /**
   * Extract parameters from parameterized routes
   * @param {string} pattern - Route pattern
   * @param {string} path - Actual path
   * @returns {object|null} Extracted parameters or null if no match
   */
  extractParams(pattern, path) {
    // Handle hash-based routes by removing the hash symbol for comparison
    let cleanPattern = pattern;
    let cleanPath = path;
    
    if (pattern.startsWith('#')) {
      cleanPattern = pattern.substring(1);
    }
    if (path.startsWith('#')) {
      cleanPath = path.substring(1);
    }
    
    const patternParts = cleanPattern.split('/');
    const pathParts = cleanPath.split('/');
    
    if (patternParts.length !== pathParts.length) {
      return null;
    }
    
    const params = {};
    
    for (let i = 0; i < patternParts.length; i++) {
      if (patternParts[i].startsWith(':')) {
        // Parameter
        const paramName = patternParts[i].slice(1);
        params[paramName] = pathParts[i];
      } else if (patternParts[i] !== pathParts[i]) {
        // No match
        return null;
      }
    }
    
    return params;
  }

  /**
   * Handle browser back/forward navigation
   * @param {PopStateEvent} event - PopState event
   */
  handlePopState(event) {
    const path = window.location.pathname + window.location.search + window.location.hash;
    this.currentRoute = path;
    this.handleRoute(path);
  }

  /**
   * Handle hash change events
   * @param {HashChangeEvent} event - HashChange event
   */
  handleHashChange(event) {
    const path = window.location.pathname + window.location.search + window.location.hash;
    this.currentRoute = path;
    this.handleRoute(path);
  }

  /**
   * Get current route
   * @returns {string} Current route path
   */
  getCurrentRoute() {
    return this.currentRoute || window.location.pathname + window.location.search + window.location.hash;
  }

  /**
   * Set hook to run before route changes
   * @param {function} callback - Callback function
   */
  beforeRoute(callback) {
    this.beforeRouteChange = callback;
  }

  /**
   * Set hook to run after route changes
   * @param {function} callback - Callback function
   */
  afterRoute(callback) {
    this.afterRouteChange = callback;
  }

  /**
   * Start the router
   */
  start() {
    const initialPath = this.getCurrentRoute();
    this.currentRoute = initialPath;
    this.handleRoute(initialPath);
  }
}


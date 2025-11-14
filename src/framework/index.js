// Mini-Framework Main Entry Point
import { createElement, render } from './dom.js';
import { Router } from './router.js';
import { Store } from './store.js';
import { EventEmitter } from './events.js';

// Export all framework functionality
export {
  createElement,
  render,
  Router,
  Store,
  EventEmitter
};

// Create global framework object for easy access
window.MiniFramework = {
  createElement,
  render,
  Router,
  Store,
  EventEmitter
};


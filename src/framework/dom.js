// DOM Abstraction Module - Virtual DOM Implementation

/**
 * Creates a virtual DOM element
 * @param {string} tag - HTML tag name
 * @param {object} attrs - Element attributes
 * @param {...*} children - Child elements or text
 * @returns {object} Virtual DOM element
 */
export function createElement(tag, attrs = {}, ...children) {
  return {
    tag,
    attrs: attrs || {},
    children: children.flat().map(child => 
      typeof child === 'string' || typeof child === 'number'
        ? { tag: null, attrs: {}, children: [], text: String(child) }
        : child
    )
  };
}

/**
 * Renders virtual DOM to real DOM
 * @param {object} vNode - Virtual DOM node
 * @param {HTMLElement} container - Container element
 */
export function render(vNode, container) {
  // Clear container
  container.innerHTML = '';
  
  // Create and append real DOM element
  const realElement = createRealElement(vNode);
  if (realElement) {
    container.appendChild(realElement);
  }
}

/**
 * Creates a real DOM element from virtual DOM
 * @param {object} vNode - Virtual DOM node
 * @returns {HTMLElement|Text} Real DOM element
 */
function createRealElement(vNode) {
  if (!vNode) return null;
  
  // Handle text nodes
  if (vNode.text !== undefined) {
    return document.createTextNode(vNode.text);
  }
  
  // Handle regular elements
  if (!vNode.tag) return null;
  
  const element = document.createElement(vNode.tag);
  
  // Set attributes
  if (vNode.attrs) {
    Object.keys(vNode.attrs).forEach(key => {
      if (key === 'className') {
        element.className = vNode.attrs[key];
      } else if (key.startsWith('on') && typeof vNode.attrs[key] === 'function') {
        // Handle event listeners
        const eventName = key.slice(2).toLowerCase();
        element.addEventListener(eventName, vNode.attrs[key]);
      } else if (key === 'checked' && element.type === 'checkbox') {
        // Handle checkbox checked property specifically
        element.checked = Boolean(vNode.attrs[key]);
      } else if (key === 'value' && (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA')) {
        // Handle input value property
        element.value = vNode.attrs[key];
      } else {
        element.setAttribute(key, vNode.attrs[key]);
      }
    });
  }
  
  // Add children
  if (vNode.children) {
    vNode.children.forEach(child => {
      const childElement = createRealElement(child);
      if (childElement) {
        element.appendChild(childElement);
      }
    });
  }
  
  return element;
}

/**
 * Updates DOM efficiently by comparing old and new virtual DOM
 * @param {object} oldVNode - Old virtual DOM node
 * @param {object} newVNode - New virtual DOM node
 * @param {HTMLElement} container - Container element
 */
export function updateDOM(oldVNode, newVNode, container) {
  // For simplicity, we'll re-render the entire tree
  // In a production framework, this would be more sophisticated
  render(newVNode, container);
}


// Cleanup utilities for content script
export const elementReferences = new WeakMap();
export let cleanupFunctions = [];

export function addCleanupFunction(fn) {
  cleanupFunctions.push(fn);
}

export function cleanup() {
  // Cleanup all registered functions
  cleanupFunctions.forEach((fn) => fn());
  cleanupFunctions = [];
  
  // Clear element references
  elementReferences.clear();
}

// Register cleanup on page unload
window.addEventListener("beforeunload", cleanup);
addCleanupFunction(() => {
  window.removeEventListener("beforeunload", cleanup);
});
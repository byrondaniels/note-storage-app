// ActionBarFinder - Finds the appropriate action bar for save button placement
// Routes to platform-specific handlers

class ActionBarFinder {
  constructor(platformHandlers, platform) {
    this.platformHandlers = platformHandlers;
    this.platform = platform;
  }

  findActionBar(postElement) {
    const handler = this.platformHandlers[this.platform];

    if (handler && handler.findActionBar) {
      return handler.findActionBar(postElement);
    }

    // Fallback: create a generic action bar container
    console.warn('ActionBarFinder: No platform handler found for', this.platform, '- creating generic container');
    const container = document.createElement('div');
    container.className = 'social-saver-actions';
    postElement.appendChild(container);
    return container;
  }
}

// Export for ES6 modules
export { ActionBarFinder };

// Also make available globally for content scripts (when loaded as regular script)
if (typeof window !== 'undefined') {
  window.ActionBarFinder = ActionBarFinder;
}

// Configuration utilities for Social Media Note Saver Extension
// Content script version (no ES module exports)

/**
 * Default configuration template used throughout the extension
 */
const DEFAULT_CONFIG = {
  extensionEnabled: true,
  apiEndpoint: 'http://localhost:8080/notes',
  payloadTemplate: {
    content: '{{content}}',
    metadata: {
      author: '{{author}}',
      handle: '{{handle}}',
      url: '{{url}}',
      timestamp: '{{timestamp}}',
      platform: '{{platform}}',
      isShare: '{{isShare}}',
      sharedBy: '{{sharedBy}}',
      shareContext: '{{shareContext}}',
      metrics: '{{metrics}}'
    }
  }
};

/**
 * Service for managing extension configuration storage
 */
class StorageService {
  /**
   * Load configuration from Chrome storage
   * @returns {Promise<Object>} Configuration object
   */
  static async loadConfig() {
    try {
      const result = await chrome.storage.sync.get(DEFAULT_CONFIG);
      return result;
    } catch (error) {
      console.error('Social Media Note Saver: Failed to load config', error);
      return { ...DEFAULT_CONFIG };
    }
  }

  /**
   * Save configuration to Chrome storage
   * @param {Object} config - Configuration object to save
   * @returns {Promise<void>}
   */
  static async saveConfig(config) {
    try {
      await chrome.storage.sync.set(config);
    } catch (error) {
      console.error('Social Media Note Saver: Failed to save config', error);
      throw error;
    }
  }

  /**
   * Get a specific config value
   * @param {string} key - Configuration key
   * @param {*} defaultValue - Default value if key not found
   * @returns {Promise<*>} Configuration value
   */
  static async get(key, defaultValue) {
    try {
      const result = await chrome.storage.sync.get({ [key]: defaultValue });
      return result[key];
    } catch (error) {
      console.error('Social Media Note Saver: Failed to get config value', error);
      return defaultValue;
    }
  }

  /**
   * Set a specific config value
   * @param {string} key - Configuration key
   * @param {*} value - Value to set
   * @returns {Promise<void>}
   */
  static async set(key, value) {
    try {
      await chrome.storage.sync.set({ [key]: value });
    } catch (error) {
      console.error('Social Media Note Saver: Failed to set config value', error);
      throw error;
    }
  }

  /**
   * Clear all configuration
   * @returns {Promise<void>}
   */
  static async clear() {
    try {
      await chrome.storage.sync.clear();
    } catch (error) {
      console.error('Social Media Note Saver: Failed to clear config', error);
      throw error;
    }
  }
}

// Make available globally for content scripts
if (typeof window !== 'undefined') {
  window.DEFAULT_CONFIG = DEFAULT_CONFIG;
  window.StorageService = StorageService;
}

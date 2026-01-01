// Social Media Note Saver - Options Page Script

import { DEFAULT_CONFIG, StorageService } from './utils/config.js';
import { ConfigManager } from './ui/config-manager.js';

/**
 * Predefined payload templates for different use cases
 */
const templates = {
  simple: DEFAULT_CONFIG.payloadTemplate,
  notes: {
    content: '{{content}}'
  },
  rich: {
    title: 'Post from {{author}} ({{handle}}) on {{platform}}',
    content: '{{content}}',
    tags: ['{{platform}}', 'social-media'],
    metadata: {
      platform: '{{platform}}',
      author: '{{author}}',
      handle: '{{handle}}',
      original_url: '{{url}}',
      captured_at: '{{timestamp}}',
      content_type: 'social-post',
      isShare: '{{isShare}}',
      sharedBy: '{{sharedBy}}',
      shareContext: '{{shareContext}}',
      engagement: '{{metrics}}'
    }
  },
  database: {
    table: 'saved_content',
    data: {
      content: '{{content}}',
      author: '{{author}}',
      handle: '{{handle}}',
      url: '{{url}}',
      timestamp: '{{timestamp}}',
      platform: '{{platform}}',
      isShare: '{{isShare}}',
      sharedBy: '{{sharedBy}}',
      shareContext: '{{shareContext}}',
      metrics: '{{metrics}}',
      content_hash: null
    }
  }
};

document.addEventListener('DOMContentLoaded', async () => {
  // DOM elements
  const apiEndpointInput = document.getElementById('apiEndpoint');
  const payloadTemplateTextarea = document.getElementById('payloadTemplate');
  const saveConfigButton = document.getElementById('saveConfig');
  const testAPIButton = document.getElementById('testAPI');
  const resetDefaultsButton = document.getElementById('resetDefaults');
  const clearDataButton = document.getElementById('clearData');
  const statusDiv = document.getElementById('status');

  // Initialize ConfigManager with options page specific settings
  const configManager = new ConfigManager({
    apiEndpointInput,
    payloadTemplateTextarea,
    statusDiv,
    testAPIButton
  }, {
    successTimeout: 5000,
    useHtmlStatus: true,
    testButtonDefaultText: 'Test API Connection'
  });

  // Load current configuration
  await configManager.loadConfig();

  // Event listeners
  saveConfigButton.addEventListener('click', () => configManager.saveConfig());
  testAPIButton.addEventListener('click', () => configManager.testAPI());
  resetDefaultsButton.addEventListener('click', resetDefaults);
  clearDataButton.addEventListener('click', clearData);

  // Make useTemplate function global for onclick handlers in HTML
  window.useTemplate = useTemplate;

  /**
   * Reset configuration to defaults
   */
  async function resetDefaults() {
    if (confirm('Are you sure you want to reset to default configuration? This will overwrite your current settings.')) {
      apiEndpointInput.value = DEFAULT_CONFIG.apiEndpoint;
      configManager.setPayloadTemplate(DEFAULT_CONFIG.payloadTemplate);
      configManager.showStatus('Reset to default configuration. Click "Save Configuration" to apply changes.', 'info');
    }
  }

  /**
   * Clear all extension data
   */
  async function clearData() {
    if (confirm('Are you sure you want to clear all extension data? This action cannot be undone.')) {
      try {
        await StorageService.clear();
        configManager.showStatus('All extension data cleared successfully.', 'success');
        setTimeout(() => {
          location.reload();
        }, 1500);
      } catch (error) {
        configManager.showStatus('Error clearing data: ' + error.message, 'error');
      }
    }
  }

  /**
   * Load a predefined template into the textarea
   * @param {string} templateName - Name of the template to load
   */
  function useTemplate(templateName) {
    if (templates[templateName]) {
      configManager.setPayloadTemplate(templates[templateName]);
      configManager.showStatus(`Template "${templateName}" loaded. Click "Save Configuration" to apply changes.`, 'info');
    }
  }
});

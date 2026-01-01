/**
 * Options Page Script Entry Point
 */

import { DEFAULT_CONFIG, StorageService } from '../utils/config.js';
import { ConfigManager } from '../ui/config-manager.js';

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
  const apiEndpointInput = document.getElementById('apiEndpoint');
  const payloadTemplateTextarea = document.getElementById('payloadTemplate');
  const saveConfigButton = document.getElementById('saveConfig');
  const testAPIButton = document.getElementById('testAPI');
  const resetDefaultsButton = document.getElementById('resetDefaults');
  const clearDataButton = document.getElementById('clearData');
  const statusDiv = document.getElementById('status');

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

  await configManager.loadConfig();

  saveConfigButton.addEventListener('click', () => configManager.saveConfig());
  testAPIButton.addEventListener('click', () => configManager.testAPI());
  resetDefaultsButton.addEventListener('click', resetDefaults);
  clearDataButton.addEventListener('click', clearData);

  window.useTemplate = useTemplate;

  async function resetDefaults() {
    if (confirm('Are you sure you want to reset to default configuration? This will overwrite your current settings.')) {
      apiEndpointInput.value = DEFAULT_CONFIG.apiEndpoint;
      configManager.setPayloadTemplate(DEFAULT_CONFIG.payloadTemplate);
      configManager.showStatus('Reset to default configuration. Click "Save Configuration" to apply changes.', 'info');
    }
  }

  async function clearData() {
    if (confirm('Are you sure you want to clear all extension data? This action cannot be undone.')) {
      try {
        await StorageService.clear();
        configManager.showStatus('All extension data cleared successfully.', 'success');
        setTimeout(() => location.reload(), 1500);
      } catch (error) {
        configManager.showStatus('Error clearing data: ' + error.message, 'error');
      }
    }
  }

  function useTemplate(templateName) {
    if (templates[templateName]) {
      configManager.setPayloadTemplate(templates[templateName]);
      configManager.showStatus(`Template "${templateName}" loaded. Click "Save Configuration" to apply changes.`, 'info');
    }
  }
});

// Social Media Note Saver - Options Page Script

const templates = {
  simple: {
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
  },
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

  // Load current configuration
  await loadConfig();

  // Event listeners
  saveConfigButton.addEventListener('click', saveConfig);
  testAPIButton.addEventListener('click', testAPI);
  resetDefaultsButton.addEventListener('click', resetDefaults);
  clearDataButton.addEventListener('click', clearData);

  // Make useTemplate function global
  window.useTemplate = useTemplate;

  async function loadConfig() {
    try {
      const result = await chrome.storage.sync.get({
        apiEndpoint: 'http://localhost:8080/notes',
        payloadTemplate: templates.simple
      });

      apiEndpointInput.value = result.apiEndpoint;
      payloadTemplateTextarea.value = JSON.stringify(result.payloadTemplate, null, 2);
    } catch (error) {
      showStatus('Error loading configuration: ' + error.message, 'error');
    }
  }

  async function saveConfig() {
    try {
      const apiEndpoint = apiEndpointInput.value.trim();
      if (!apiEndpoint) {
        showStatus('Please enter an API endpoint URL', 'error');
        return;
      }

      // Validate URL
      try {
        new URL(apiEndpoint);
      } catch {
        showStatus('Please enter a valid URL', 'error');
        return;
      }

      // Validate JSON template
      let payloadTemplate;
      try {
        payloadTemplate = JSON.parse(payloadTemplateTextarea.value);
      } catch (e) {
        showStatus('Invalid JSON in payload template: ' + e.message, 'error');
        return;
      }

      // Save configuration
      await chrome.storage.sync.set({
        apiEndpoint,
        payloadTemplate
      });

      showStatus('Configuration saved successfully! 🎉', 'success');
      
      // Notify content scripts to reload config
      try {
        const tabs = await chrome.tabs.query({ 
          url: ['https://twitter.com/*', 'https://x.com/*', 'https://linkedin.com/*', 'https://www.linkedin.com/*'] 
        });
        
        for (const tab of tabs) {
          chrome.tabs.sendMessage(tab.id, { action: 'configUpdated' }).catch(() => {
            // Ignore errors for tabs without content script
          });
        }
      } catch (error) {
        console.log('Could not notify content scripts:', error);
      }

    } catch (error) {
      showStatus('Error saving configuration: ' + error.message, 'error');
    }
  }

  async function testAPI() {
    try {
      const apiEndpoint = apiEndpointInput.value.trim();
      if (!apiEndpoint) {
        showStatus('Please enter an API endpoint URL first', 'error');
        return;
      }

      let payloadTemplate;
      try {
        payloadTemplate = JSON.parse(payloadTemplateTextarea.value);
      } catch (e) {
        showStatus('Invalid JSON in payload template: ' + e.message, 'error');
        return;
      }

      testAPIButton.disabled = true;
      testAPIButton.textContent = '🧪 Testing...';
      showStatus('Testing API connection... ⏳', 'info');

      // Create test payload
      const testPayload = replaceTemplatePlaceholders(payloadTemplate, {
        content: 'This is a test post content from the Social Media Note Saver extension. If you see this in your API, the integration is working correctly! 🎉',
        author: 'TestUser',
        handle: '@TestUser',
        url: 'https://twitter.com/TestUser/status/123456789012345678',
        timestamp: new Date().toISOString(),
        platform: 'twitter',
        isShare: false,
        sharedBy: '',
        shareContext: '',
        metrics: {}
      });

      const response = await chrome.runtime.sendMessage({
        action: 'testAPI',
        endpoint: apiEndpoint,
        payload: testPayload
      });

      if (response.success) {
        showStatus(`✅ API test successful! Status: ${response.status}\n\nResponse preview: ${response.response}`, 'success');
      } else {
        showStatus(`❌ API test failed: ${response.error}\n\nCheck your endpoint URL and server configuration.`, 'error');
      }

    } catch (error) {
      showStatus('Test failed: ' + error.message, 'error');
    } finally {
      testAPIButton.disabled = false;
      testAPIButton.textContent = '🧪 Test API Connection';
    }
  }

  async function resetDefaults() {
    if (confirm('Are you sure you want to reset to default configuration? This will overwrite your current settings.')) {
      apiEndpointInput.value = 'http://localhost:8080/notes';
      payloadTemplateTextarea.value = JSON.stringify(templates.simple, null, 2);
      showStatus('Reset to default configuration. Click "Save Configuration" to apply changes.', 'info');
    }
  }

  async function clearData() {
    if (confirm('Are you sure you want to clear all extension data? This action cannot be undone.')) {
      try {
        await chrome.storage.sync.clear();
        showStatus('All extension data cleared successfully.', 'success');
        setTimeout(() => {
          location.reload();
        }, 1500);
      } catch (error) {
        showStatus('Error clearing data: ' + error.message, 'error');
      }
    }
  }

  function useTemplate(templateName) {
    if (templates[templateName]) {
      payloadTemplateTextarea.value = JSON.stringify(templates[templateName], null, 2);
      showStatus(`Template "${templateName}" loaded. Click "Save Configuration" to apply changes.`, 'info');
    }
  }

  function replaceTemplatePlaceholders(template, data) {
    const replacePlaceholders = (obj) => {
      if (typeof obj === 'string') {
        // Handle conditional share context
        let sharePrefix = '';
        if (data.isShare && data.shareContext) {
          sharePrefix = `${data.shareContext}\n\n`;
        }
        
        return obj
          .replace(/\{\{content\}\}/g, data.content || '')
          .replace(/\{\{author\}\}/g, data.author || '')
          .replace(/\{\{handle\}\}/g, data.handle || '')
          .replace(/\{\{url\}\}/g, data.url || '')
          .replace(/\{\{timestamp\}\}/g, data.timestamp || '')
          .replace(/\{\{platform\}\}/g, data.platform || 'unknown')
          .replace(/\{\{isShare\}\}/g, data.isShare ? 'true' : 'false')
          .replace(/\{\{sharedBy\}\}/g, data.sharedBy || '')
          .replace(/\{\{shareContext\}\}/g, sharePrefix)
          .replace(/\{\{metrics\}\}/g, JSON.stringify(data.metrics || {}))
          // Backward compatibility for existing templates
          .replace(/\{\{isRetweet\}\}/g, data.isShare ? 'true' : 'false')
          .replace(/\{\{retweetedBy\}\}/g, data.sharedBy || '')
          .replace(/\{\{retweetContext\}\}/g, sharePrefix);
      } else if (Array.isArray(obj)) {
        return obj.map(replacePlaceholders);
      } else if (typeof obj === 'object' && obj !== null) {
        const result = {};
        for (const key in obj) {
          result[key] = replacePlaceholders(obj[key]);
        }
        return result;
      }
      return obj;
    };

    return replacePlaceholders(JSON.parse(JSON.stringify(template)));
  }

  function showStatus(message, type) {
    statusDiv.innerHTML = message.replace(/\n/g, '<br>');
    statusDiv.className = `status ${type}`;
    statusDiv.style.display = 'block';

    if (type === 'success') {
      setTimeout(() => {
        statusDiv.style.display = 'none';
      }, 5000);
    }
  }
});
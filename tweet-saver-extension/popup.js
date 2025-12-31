// Social Media Note Saver - Popup Script

document.addEventListener('DOMContentLoaded', async () => {
  const extensionEnabledToggle = document.getElementById('extensionEnabled');
  const apiEndpointInput = document.getElementById('apiEndpoint');
  const payloadTemplateTextarea = document.getElementById('payloadTemplate');
  const saveConfigButton = document.getElementById('saveConfig');
  const testAPIButton = document.getElementById('testAPI');
  const statusDiv = document.getElementById('status');
  const channelUrlInput = document.getElementById('channelUrl');
  const videoLimitSelect = document.getElementById('videoLimit');
  const importChannelButton = document.getElementById('importChannel');
  const importStatusDiv = document.getElementById('importStatus');

  // Load current configuration
  await loadConfig();

  // Event listeners
  extensionEnabledToggle.addEventListener('change', toggleExtension);
  saveConfigButton.addEventListener('click', saveConfig);
  testAPIButton.addEventListener('click', testAPI);
  importChannelButton.addEventListener('click', startChannelImport);

  // Listen for progress updates from background script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'importProgress') {
      handleImportProgress(message);
    }
  });

  async function loadConfig() {
    try {
      const result = await chrome.storage.sync.get({
        extensionEnabled: true,
        apiEndpoint: 'http://localhost:8080/notes',
        payloadTemplate: {
          content: 'This post is from: {{author}} ({{handle}}) on {{platform}}\n\n{{shareContext}}{{content}}\n\nSource: {{url}}',
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
      });

      extensionEnabledToggle.checked = result.extensionEnabled;
      apiEndpointInput.value = result.apiEndpoint;
      payloadTemplateTextarea.value = JSON.stringify(result.payloadTemplate, null, 2);
    } catch (error) {
      showStatus('Error loading configuration: ' + error.message, 'error');
    }
  }

  async function toggleExtension() {
    try {
      const isEnabled = extensionEnabledToggle.checked;
      
      await chrome.storage.sync.set({
        extensionEnabled: isEnabled
      });

      showStatus(
        isEnabled ? 'Extension enabled!' : 'Extension disabled!', 
        'success'
      );
      
      // Notify content scripts about the change
      try {
        const tabs = await chrome.tabs.query({ 
          url: ['https://twitter.com/*', 'https://x.com/*', 'https://linkedin.com/*', 'https://www.linkedin.com/*', 'https://youtube.com/*', 'https://www.youtube.com/*'] 
        });
        
        for (const tab of tabs) {
          chrome.tabs.sendMessage(tab.id, { 
            action: 'extensionToggled', 
            enabled: isEnabled 
          }).catch(() => {
            // Ignore errors for tabs without content script
          });
        }
      } catch (error) {
        console.log('Could not notify content scripts:', error);
      }

    } catch (error) {
      showStatus('Error toggling extension: ' + error.message, 'error');
      // Revert toggle state on error
      extensionEnabledToggle.checked = !extensionEnabledToggle.checked;
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
      } catch {
        showStatus('Invalid JSON in payload template', 'error');
        return;
      }

      // Save configuration
      await chrome.storage.sync.set({
        apiEndpoint,
        payloadTemplate
      });

      showStatus('Configuration saved successfully!', 'success');
      
      // Notify content scripts to reload config
      try {
        const tabs = await chrome.tabs.query({ 
          url: ['https://twitter.com/*', 'https://x.com/*', 'https://linkedin.com/*', 'https://www.linkedin.com/*', 'https://youtube.com/*', 'https://www.youtube.com/*'] 
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
      } catch {
        showStatus('Invalid JSON in payload template', 'error');
        return;
      }

      testAPIButton.disabled = true;
      testAPIButton.textContent = 'Testing...';
      showStatus('Testing API connection...', 'info');

      // Create test payload
      const testPayload = replaceTemplatePlaceholders(payloadTemplate, {
        content: 'This is a test post content from the extension',
        author: 'TestUser',
        handle: '@TestUser',
        url: 'https://twitter.com/TestUser/status/123456789',
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
        showStatus(`✅ API test successful! Status: ${response.status}`, 'success');
      } else {
        showStatus(`❌ API test failed: ${response.error}`, 'error');
      }

    } catch (error) {
      showStatus('Test failed: ' + error.message, 'error');
    } finally {
      testAPIButton.disabled = false;
      testAPIButton.textContent = 'Test API';
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
    statusDiv.textContent = message;
    statusDiv.className = `status ${type}`;
    statusDiv.style.display = 'block';

    if (type === 'success') {
      setTimeout(() => {
        statusDiv.style.display = 'none';
      }, 3000);
    }
  }

  async function startChannelImport() {
    try {
      const channelUrl = channelUrlInput.value.trim();
      const limit = parseInt(videoLimitSelect.value);

      // Validate input
      if (!channelUrl) {
        showImportStatus('Please enter a YouTube channel URL', 'error');
        return;
      }

      // Validate URL
      try {
        const url = new URL(channelUrl);
        if (!url.hostname.includes('youtube.com')) {
          showImportStatus('Please enter a valid YouTube channel URL', 'error');
          return;
        }
      } catch {
        showImportStatus('Please enter a valid URL', 'error');
        return;
      }

      // Disable button during import
      importChannelButton.disabled = true;
      importChannelButton.textContent = 'Importing...';

      // Show initial status with progress bar
      importStatusDiv.innerHTML = `
        <div class="status info">
          <div>Starting import...</div>
          <div class="progress-bar">
            <div class="progress-fill" id="progressFill"></div>
          </div>
        </div>
      `;
      importStatusDiv.style.display = 'block';

      // Send message to background script
      chrome.runtime.sendMessage({
        action: 'importChannel',
        channelUrl: channelUrl,
        limit: limit
      });

    } catch (error) {
      showImportStatus('Error starting import: ' + error.message, 'error');
      importChannelButton.disabled = false;
      importChannelButton.textContent = 'Import Transcripts';
    }
  }

  function handleImportProgress(message) {
    const { current, total, status, videoTitle, completed, error } = message;

    if (completed) {
      // Import finished
      importChannelButton.disabled = false;
      importChannelButton.textContent = 'Import Transcripts';

      if (error) {
        showImportStatus(`Import completed with errors: ${error}`, 'error');
      } else {
        showImportStatus(`✅ Successfully imported ${current} of ${total} videos!`, 'success');
      }
      return;
    }

    // Update progress
    const percentage = total > 0 ? (current / total) * 100 : 0;
    const progressFill = document.getElementById('progressFill');

    if (progressFill) {
      progressFill.style.width = `${percentage}%`;
    }

    // Update status text
    let statusText = `Processing video ${current} of ${total}`;
    if (videoTitle) {
      statusText += `: ${videoTitle}`;
    }
    if (status) {
      statusText += ` - ${status}`;
    }

    importStatusDiv.innerHTML = `
      <div class="status info">
        <div>${statusText}</div>
        <div class="progress-bar">
          <div class="progress-fill" style="width: ${percentage}%"></div>
        </div>
      </div>
    `;
  }

  function showImportStatus(message, type) {
    importStatusDiv.innerHTML = `<div class="status ${type}">${message}</div>`;
    importStatusDiv.style.display = 'block';

    if (type === 'success') {
      setTimeout(() => {
        importStatusDiv.style.display = 'none';
      }, 5000);
    }
  }
});
// Social Media Note Saver - Popup Script

import { ConfigManager } from './ui/config-manager.js';

document.addEventListener('DOMContentLoaded', async () => {
  // DOM elements
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

  // Initialize ConfigManager for shared config operations
  const configManager = new ConfigManager({
    apiEndpointInput,
    payloadTemplateTextarea,
    statusDiv,
    testAPIButton
  });

  // Load current configuration
  await configManager.loadConfig(extensionEnabledToggle);

  // Event listeners
  extensionEnabledToggle.addEventListener('change', toggleExtension);
  saveConfigButton.addEventListener('click', () => configManager.saveConfig());
  testAPIButton.addEventListener('click', () => configManager.testAPI());
  importChannelButton.addEventListener('click', startChannelImport);

  // Listen for progress updates from background script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'importProgress') {
      handleImportProgress(message);
    }
  });

  /**
   * Toggle extension enabled state
   */
  async function toggleExtension() {
    try {
      const isEnabled = extensionEnabledToggle.checked;

      await chrome.storage.sync.set({ extensionEnabled: isEnabled });

      configManager.showStatus(
        isEnabled ? 'Extension enabled!' : 'Extension disabled!',
        'success'
      );

      // Notify content scripts about the change
      await configManager.notifyContentScripts('extensionToggled', { enabled: isEnabled });

    } catch (error) {
      configManager.showStatus('Error toggling extension: ' + error.message, 'error');
      // Revert toggle state on error
      extensionEnabledToggle.checked = !extensionEnabledToggle.checked;
    }
  }

  /**
   * Start YouTube channel import process
   */
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

  /**
   * Handle import progress updates from background script
   */
  function handleImportProgress(message) {
    const { current, total, status, videoTitle, completed, error } = message;

    if (completed) {
      // Import finished
      importChannelButton.disabled = false;
      importChannelButton.textContent = 'Import Transcripts';

      if (error) {
        showImportStatus(`Import completed with errors: ${error}`, 'error');
      } else {
        showImportStatus(`Successfully imported ${current} of ${total} videos!`, 'success');
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

  /**
   * Show import-specific status message
   */
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

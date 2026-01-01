// ConfigManager - Shared configuration management for popup and options pages
//
// Consolidates common functionality:
// - Loading configuration from storage
// - Saving configuration with validation
// - Testing API connectivity
// - Displaying status messages
// - Notifying content scripts of changes

import { StorageService } from '../utils/config.js';
import { replaceTemplatePlaceholders } from '../utils/template-processor.js';

/**
 * List of social media URL patterns for content script notifications
 */
const SOCIAL_MEDIA_URLS = [
  'https://twitter.com/*',
  'https://x.com/*',
  'https://linkedin.com/*',
  'https://www.linkedin.com/*',
  'https://youtube.com/*',
  'https://www.youtube.com/*'
];

/**
 * ConfigManager - Manages extension configuration UI interactions
 */
class ConfigManager {
  /**
   * @param {Object} elements - DOM elements to manage
   * @param {HTMLInputElement} elements.apiEndpointInput - API endpoint input field
   * @param {HTMLTextAreaElement} elements.payloadTemplateTextarea - Payload template textarea
   * @param {HTMLElement} elements.statusDiv - Status message container
   * @param {HTMLButtonElement} [elements.testAPIButton] - Test API button (optional)
   * @param {Object} [options] - Configuration options
   * @param {number} [options.successTimeout=3000] - Time to show success messages (ms)
   * @param {boolean} [options.useHtmlStatus=false] - Whether to use innerHTML for status
   */
  constructor(elements, options = {}) {
    this.apiEndpointInput = elements.apiEndpointInput;
    this.payloadTemplateTextarea = elements.payloadTemplateTextarea;
    this.statusDiv = elements.statusDiv;
    this.testAPIButton = elements.testAPIButton;

    this.options = {
      successTimeout: options.successTimeout || 3000,
      useHtmlStatus: options.useHtmlStatus || false,
      testButtonDefaultText: options.testButtonDefaultText || 'Test API'
    };
  }

  /**
   * Load configuration from storage and populate form fields
   * @param {HTMLInputElement} [extensionEnabledToggle] - Optional toggle for extension enabled state
   * @returns {Promise<Object>} The loaded configuration
   */
  async loadConfig(extensionEnabledToggle = null) {
    try {
      const result = await StorageService.loadConfig();

      if (extensionEnabledToggle) {
        extensionEnabledToggle.checked = result.extensionEnabled;
      }

      this.apiEndpointInput.value = result.apiEndpoint;
      this.payloadTemplateTextarea.value = JSON.stringify(result.payloadTemplate, null, 2);

      return result;
    } catch (error) {
      this.showStatus('Error loading configuration: ' + error.message, 'error');
      throw error;
    }
  }

  /**
   * Validate and save configuration to storage
   * @returns {Promise<boolean>} True if save was successful
   */
  async saveConfig() {
    try {
      const apiEndpoint = this.apiEndpointInput.value.trim();

      // Validate endpoint
      if (!apiEndpoint) {
        this.showStatus('Please enter an API endpoint URL', 'error');
        return false;
      }

      // Validate URL format
      try {
        new URL(apiEndpoint);
      } catch {
        this.showStatus('Please enter a valid URL', 'error');
        return false;
      }

      // Validate JSON template
      let payloadTemplate;
      try {
        payloadTemplate = JSON.parse(this.payloadTemplateTextarea.value);
      } catch (e) {
        this.showStatus('Invalid JSON in payload template: ' + e.message, 'error');
        return false;
      }

      // Save configuration
      await chrome.storage.sync.set({
        apiEndpoint,
        payloadTemplate
      });

      this.showStatus('Configuration saved successfully!', 'success');

      // Notify content scripts to reload config
      await this.notifyContentScripts('configUpdated');

      return true;
    } catch (error) {
      this.showStatus('Error saving configuration: ' + error.message, 'error');
      return false;
    }
  }

  /**
   * Test the API connection with a sample payload
   * @returns {Promise<Object>} Test result with success status
   */
  async testAPI() {
    try {
      const apiEndpoint = this.apiEndpointInput.value.trim();

      if (!apiEndpoint) {
        this.showStatus('Please enter an API endpoint URL first', 'error');
        return { success: false };
      }

      // Validate JSON template
      let payloadTemplate;
      try {
        payloadTemplate = JSON.parse(this.payloadTemplateTextarea.value);
      } catch (e) {
        this.showStatus('Invalid JSON in payload template: ' + e.message, 'error');
        return { success: false };
      }

      // Update button state
      if (this.testAPIButton) {
        this.testAPIButton.disabled = true;
        this.testAPIButton.textContent = 'Testing...';
      }

      this.showStatus('Testing API connection...', 'info');

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
        const message = response.response
          ? `API test successful! Status: ${response.status}\n\nResponse preview: ${response.response}`
          : `API test successful! Status: ${response.status}`;
        this.showStatus(message, 'success');
      } else {
        this.showStatus(`API test failed: ${response.error}`, 'error');
      }

      return response;
    } catch (error) {
      this.showStatus('Test failed: ' + error.message, 'error');
      return { success: false, error: error.message };
    } finally {
      // Reset button state
      if (this.testAPIButton) {
        this.testAPIButton.disabled = false;
        this.testAPIButton.textContent = this.options.testButtonDefaultText;
      }
    }
  }

  /**
   * Display a status message to the user
   * @param {string} message - The message to display
   * @param {string} type - Message type: 'success', 'error', or 'info'
   */
  showStatus(message, type) {
    if (this.options.useHtmlStatus) {
      this.statusDiv.innerHTML = message.replace(/\n/g, '<br>');
    } else {
      this.statusDiv.textContent = message;
    }

    this.statusDiv.className = `status ${type}`;
    this.statusDiv.style.display = 'block';

    if (type === 'success') {
      setTimeout(() => {
        this.statusDiv.style.display = 'none';
      }, this.options.successTimeout);
    }
  }

  /**
   * Notify content scripts of a configuration change
   * @param {string} action - The action to send ('configUpdated' or 'extensionToggled')
   * @param {Object} [data] - Additional data to send with the message
   */
  async notifyContentScripts(action, data = {}) {
    try {
      const tabs = await chrome.tabs.query({ url: SOCIAL_MEDIA_URLS });

      for (const tab of tabs) {
        chrome.tabs.sendMessage(tab.id, { action, ...data }).catch(() => {
          // Ignore errors for tabs without content script
        });
      }
    } catch (error) {
      console.log('Could not notify content scripts:', error);
    }
  }

  /**
   * Get the current payload template as an object
   * @returns {Object|null} Parsed template or null if invalid
   */
  getPayloadTemplate() {
    try {
      return JSON.parse(this.payloadTemplateTextarea.value);
    } catch {
      return null;
    }
  }

  /**
   * Set the payload template in the textarea
   * @param {Object} template - The template object to set
   */
  setPayloadTemplate(template) {
    this.payloadTemplateTextarea.value = JSON.stringify(template, null, 2);
  }
}

export { ConfigManager, SOCIAL_MEDIA_URLS };

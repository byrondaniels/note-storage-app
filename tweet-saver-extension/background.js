// Social Media Note Saver - Background Script (Service Worker)

import { DEFAULT_CONFIG, StorageService } from './utils/config.js';
import { NotesApiClient } from './services/api-client.js';
import { channelImportService } from './services/channel-import.js';

// Handle extension installation
chrome.runtime.onInstalled.addListener((details) => {
  console.log('Social Media Note Saver: Extension installed/updated', details);

  // Always migrate old template to clean version
  chrome.storage.sync.get(['payloadTemplate'], (result) => {
    const currentContent = result.payloadTemplate?.content || '';
    if (currentContent.includes('This post is from') || !result.payloadTemplate) {
      console.log('Social Media Note Saver: Migrating to clean payload template');
      chrome.storage.sync.set({
        payloadTemplate: DEFAULT_CONFIG.payloadTemplate
      });
    }
  });

  // Set default configuration on first install
  if (details.reason === 'install') {
    chrome.storage.sync.set(DEFAULT_CONFIG);
  }
});

// Store the sender tab ID for progress updates to Vue app
let externalSenderTabId = null;

// Handle messages from external sources (Vue app on localhost)
chrome.runtime.onMessageExternal.addListener((request, sender, sendResponse) => {
  console.log('Social Media Note Saver: External message received:', request.action, 'from:', sender.url);

  if (request.action === 'ping') {
    sendResponse({ success: true, message: 'Extension is available' });
    return;
  }

  if (request.action === 'importChannel') {
    // Store the sender tab ID for progress updates
    externalSenderTabId = sender.tab ? sender.tab.id : null;
    console.log('Social Media Note Saver: External import request, sender tab:', externalSenderTabId);

    channelImportService.handleChannelImport(request.channelUrl, request.limit || 20, externalSenderTabId)
      .then(() => {
        sendResponse({ success: true });
      })
      .catch(error => {
        console.error('Social Media Note Saver: External import failed:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Required for async response
  }
});

// Handle messages from content script or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getConfig') {
    chrome.storage.sync.get(['apiEndpoint', 'payloadTemplate'], (result) => {
      sendResponse(result);
    });
    return true; // Required for async response
  }

  if (request.action === 'saveConfig') {
    chrome.storage.sync.set(request.config, () => {
      sendResponse({ success: true });
    });
    return true;
  }

  if (request.action === 'testAPI') {
    // Test API endpoint using ApiClient
    const apiClient = new NotesApiClient(request.endpoint);
    apiClient.testConnection(request.payload)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.action === 'importChannel') {
    // Handle channel import request
    channelImportService.handleChannelImport(request.channelUrl, request.limit || 20)
      .then(() => {
        sendResponse({ success: true });
      })
      .catch(error => {
        console.error('Social Media Note Saver: Import failed:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Required for async response
  }
});

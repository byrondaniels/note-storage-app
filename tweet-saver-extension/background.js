// Social Media Note Saver - Background Script (Service Worker)

import { DEFAULT_CONFIG, StorageService } from './utils/config.js';
import { NotesApiClient } from './services/api-client.js';

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
let externalSenderTabId = null

// Handle messages from external sources (Vue app on localhost)
chrome.runtime.onMessageExternal.addListener((request, sender, sendResponse) => {
  console.log('Social Media Note Saver: External message received:', request.action, 'from:', sender.url)

  if (request.action === 'ping') {
    sendResponse({ success: true, message: 'Extension is available' })
    return
  }

  if (request.action === 'importChannel') {
    // Store the sender tab ID for progress updates
    externalSenderTabId = sender.tab ? sender.tab.id : null
    console.log('Social Media Note Saver: External import request, sender tab:', externalSenderTabId)

    handleChannelImport(request.channelUrl, request.limit || 20, externalSenderTabId)
      .then(() => {
        sendResponse({ success: true })
      })
      .catch(error => {
        console.error('Social Media Note Saver: External import failed:', error)
        sendResponse({ success: false, error: error.message })
      })
    return true // Required for async response
  }
})

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
    handleChannelImport(request.channelUrl, request.limit || 20)
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

// Channel import orchestration functions
function normalizeChannelUrl(url) {
  console.log('Social Media Note Saver: Normalizing channel URL:', url);

  // Remove trailing slashes
  url = url.replace(/\/+$/, '');

  // If URL already ends with /videos, return as-is
  if (url.endsWith('/videos')) {
    return url;
  }

  // Append /videos
  return url + '/videos';
}

function navigateAndWait(tabId, url) {
  return new Promise((resolve, reject) => {
    console.log('Social Media Note Saver: Navigating tab', tabId, 'to', url);

    // Set up listener for tab update
    const listener = (updatedTabId, changeInfo, tab) => {
      if (updatedTabId === tabId && changeInfo.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(listener);
        console.log('Social Media Note Saver: Navigation complete for tab', tabId);
        resolve(tab);
      }
    };

    chrome.tabs.onUpdated.addListener(listener);

    // Navigate the tab
    chrome.tabs.update(tabId, { url: url }, (tab) => {
      if (chrome.runtime.lastError) {
        chrome.tabs.onUpdated.removeListener(listener);
        reject(new Error(chrome.runtime.lastError.message));
      }
    });

    // Timeout after 30 seconds
    setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      reject(new Error('Navigation timeout'));
    }, 30000);
  });
}

// Helper to send progress updates to both popup and Vue app
function sendProgressUpdate(message, vueAppTabId) {
  // Send to popup (internal)
  chrome.runtime.sendMessage(message).catch(() => {
    // Ignore errors if popup is closed
  })

  // Send to Vue app via content script bridge
  if (vueAppTabId) {
    chrome.tabs.sendMessage(vueAppTabId, message).catch(() => {
      // Ignore errors if tab is closed
    })
  }
}

async function processVideoQueue(tabId, videos, vueAppTabId) {
  console.log('Social Media Note Saver: Processing', videos.length, 'videos');

  let processed = 0;
  let succeeded = 0;
  let skipped = 0;
  let failed = 0;

  for (const video of videos) {
    try {
      console.log(`Social Media Note Saver: Processing video ${processed + 1}/${videos.length}:`, video.title);

      // Send progress update to popup and Vue app
      sendProgressUpdate({
        action: 'importProgress',
        current: processed + 1,
        total: videos.length,
        status: 'processing',
        videoTitle: video.title
      }, vueAppTabId);

      // Navigate to video page
      await navigateAndWait(tabId, video.url);

      // Wait a bit for page to settle
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Send message to content script to extract and save transcript
      const result = await new Promise((resolve, reject) => {
        chrome.tabs.sendMessage(tabId, { action: 'extractAndSaveTranscript' }, (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(response);
          }
        });
      });

      if (result.success) {
        if (result.skipped) {
          console.log('Social Media Note Saver: Video already imported:', video.title);
          skipped++;
        } else {
          console.log('Social Media Note Saver: Successfully saved:', video.title);
          succeeded++;
        }
      } else {
        console.error('Social Media Note Saver: Failed to save:', video.title, result.error);
        failed++;
      }

    } catch (error) {
      console.error('Social Media Note Saver: Error processing video:', video.title, error);
      failed++;
    }

    processed++;
  }

  console.log('Social Media Note Saver: Import complete. Succeeded:', succeeded, 'Skipped:', skipped, 'Failed:', failed);

  // Send completion message to popup and Vue app
  sendProgressUpdate({
    action: 'importProgress',
    completed: true,
    current: succeeded,
    total: videos.length,
    status: 'complete',
    succeeded: succeeded,
    skipped: skipped,
    failed: failed
  }, vueAppTabId);

  return { succeeded, skipped, failed, total: videos.length };
}

async function handleChannelImport(channelUrl, limit, vueAppTabId = null) {
  console.log('Social Media Note Saver: Starting channel import for:', channelUrl, 'limit:', limit, 'vueAppTabId:', vueAppTabId);

  let tabId = null;

  try {
    // Normalize the channel URL
    const normalizedUrl = normalizeChannelUrl(channelUrl);
    console.log('Social Media Note Saver: Normalized URL:', normalizedUrl);

    // Create a tab for the import process
    const tab = await chrome.tabs.create({ url: 'about:blank', active: true });
    tabId = tab.id;
    console.log('Social Media Note Saver: Created tab', tabId);

    // Navigate to channel page and wait for it to load
    console.log('Social Media Note Saver: Navigating to channel page...');
    await navigateAndWait(tabId, normalizedUrl);

    // Wait extra time for content script to initialize and page to settle
    console.log('Social Media Note Saver: Waiting for content script to initialize...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Send message to content script to scrape videos
    console.log('Social Media Note Saver: Requesting video scraping from content script');
    const scrapeResult = await new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(tabId, {
        action: 'scrapeChannelVideos',
        limit: limit
      }, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response);
        }
      });
    });

    if (!scrapeResult.success) {
      throw new Error(scrapeResult.error || 'Failed to scrape videos');
    }

    const videos = scrapeResult.videos;
    console.log('Social Media Note Saver: Scraped', videos.length, 'videos');

    if (videos.length === 0) {
      throw new Error('No videos found on channel');
    }

    // Process the video queue
    await processVideoQueue(tabId, videos, vueAppTabId);

    // Close the import tab
    chrome.tabs.remove(tabId);
    console.log('Social Media Note Saver: Channel import complete');

  } catch (error) {
    console.error('Social Media Note Saver: Channel import failed:', error);

    // Clean up the tab if it was created
    if (tabId) {
      try {
        await chrome.tabs.remove(tabId);
      } catch (e) {
        // Ignore errors if tab already closed
      }
    }

    // Send error to popup and Vue app
    sendProgressUpdate({
      action: 'importProgress',
      completed: true,
      current: 0,
      total: 0,
      error: error.message
    }, vueAppTabId);

    throw error;
  }
}
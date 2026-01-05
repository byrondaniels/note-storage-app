// ChannelImportService - Handles YouTube channel video import workflow
//
// This service orchestrates the process of:
// 1. Navigating to a YouTube channel's videos page
// 2. Scraping video URLs from the channel
// 3. Processing each video to extract and save transcripts
// 4. Reporting progress back to the UI

/**
 * ChannelImportService - Manages YouTube channel import operations
 */
class ChannelImportService {
  constructor() {
    this.activeTabId = null;
  }

  /**
   * Normalize a YouTube channel URL to point to the videos tab
   * @param {string} url - The channel URL
   * @returns {string} Normalized URL ending with /videos
   */
  normalizeChannelUrl(url) {
    console.log('ChannelImportService: Normalizing channel URL:', url);

    // Remove trailing slashes
    url = url.replace(/\/+$/, '');

    // If URL already ends with /videos, return as-is
    if (url.endsWith('/videos')) {
      return url;
    }

    // Append /videos
    return url + '/videos';
  }

  /**
   * Navigate a tab to a URL and wait for it to complete loading
   * @param {number} tabId - The tab ID to navigate
   * @param {string} url - The URL to navigate to
   * @returns {Promise<chrome.tabs.Tab>} The updated tab object
   */
  navigateAndWait(tabId, url) {
    return new Promise((resolve, reject) => {
      console.log('ChannelImportService: Navigating tab', tabId, 'to', url);

      // Set up listener for tab update
      const listener = (updatedTabId, changeInfo, tab) => {
        if (updatedTabId === tabId && changeInfo.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(listener);
          console.log('ChannelImportService: Navigation complete for tab', tabId);
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

  /**
   * Send progress updates to popup and Vue app
   * @param {Object} message - Progress message object
   * @param {number|null} vueAppTabId - Tab ID of Vue app for bridge communication
   */
  sendProgressUpdate(message, vueAppTabId) {
    console.log('ChannelImportService: Sending progress update:', message.current, '/', message.total, 'to tab:', vueAppTabId);

    // Send to popup (internal)
    chrome.runtime.sendMessage(message).catch(() => {
      // Ignore errors if popup is closed
    });

    // Send to Vue app via content script bridge
    if (vueAppTabId) {
      console.log('ChannelImportService: Sending to Vue app tab:', vueAppTabId);
      chrome.tabs.sendMessage(vueAppTabId, message)
        .then(response => console.log('ChannelImportService: Tab message response:', response))
        .catch(err => console.log('ChannelImportService: Tab message error:', err.message));
    } else {
      console.log('ChannelImportService: No vueAppTabId, skipping tab message');
    }
  }

  /**
   * Process a queue of videos, extracting and saving transcripts for each
   * @param {number} tabId - The tab ID to use for processing
   * @param {Array<Object>} videos - Array of video objects with url and title
   * @param {number|null} vueAppTabId - Tab ID of Vue app for progress updates
   * @param {string} channelName - Name of the channel being imported
   * @returns {Promise<Object>} Results object with succeeded, skipped, failed counts
   */
  async processVideoQueue(tabId, videos, vueAppTabId, channelName = 'Unknown Channel') {
    console.log('ChannelImportService: Processing', videos.length, 'videos from channel:', channelName);

    let processed = 0;
    let succeeded = 0;
    let skipped = 0;
    let failed = 0;

    for (const video of videos) {
      try {
        console.log(`ChannelImportService: Processing video ${processed + 1}/${videos.length}:`, video.title);

        // Send progress update to popup and Vue app
        this.sendProgressUpdate({
          action: 'importProgress',
          current: processed + 1,
          total: videos.length,
          status: 'processing',
          videoTitle: video.title,
          channelName: channelName
        }, vueAppTabId);

        // Navigate to video page
        await this.navigateAndWait(tabId, video.url);

        // Wait a bit for page to settle
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Send message to content script to extract and save transcript
        // Pass the channelName so it's consistent with what we saved in settings
        const result = await this.sendMessageToTab(tabId, { action: 'extractAndSaveTranscript', channelName: channelName });

        if (result.success) {
          if (result.skipped) {
            console.log('ChannelImportService: Video already imported:', video.title);
            skipped++;
          } else {
            console.log('ChannelImportService: Successfully saved:', video.title);
            succeeded++;
          }
        } else {
          console.error('ChannelImportService: Failed to save:', video.title, result.error);
          failed++;
        }

      } catch (error) {
        console.error('ChannelImportService: Error processing video:', video.title, error);
        failed++;
      }

      processed++;
    }

    console.log('ChannelImportService: Import complete. Succeeded:', succeeded, 'Skipped:', skipped, 'Failed:', failed);

    // Send completion message to popup and Vue app
    this.sendProgressUpdate({
      action: 'importProgress',
      completed: true,
      current: succeeded,
      total: videos.length,
      status: 'complete',
      succeeded: succeeded,
      skipped: skipped,
      failed: failed,
      channelName: channelName
    }, vueAppTabId);

    return { succeeded, skipped, failed, total: videos.length };
  }

  /**
   * Send a message to a tab and wait for response
   * @param {number} tabId - The tab ID to send message to
   * @param {Object} message - The message to send
   * @returns {Promise<Object>} The response from the content script
   */
  sendMessageToTab(tabId, message) {
    return new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(tabId, message, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response);
        }
      });
    });
  }

  /**
   * Import videos from a YouTube channel
   * @param {string} channelUrl - The YouTube channel URL
   * @param {number} limit - Maximum number of videos to import
   * @param {number|null} vueAppTabId - Tab ID of Vue app for progress updates
   * @returns {Promise<Object>} Results object with import statistics
   */
  async handleChannelImport(channelUrl, limit, vueAppTabId = null) {
    console.log('ChannelImportService: Starting channel import for:', channelUrl, 'limit:', limit, 'vueAppTabId:', vueAppTabId);

    let tabId = null;

    try {
      // Normalize the channel URL
      const normalizedUrl = this.normalizeChannelUrl(channelUrl);
      console.log('ChannelImportService: Normalized URL:', normalizedUrl);

      // Create a tab for the import process
      const tab = await chrome.tabs.create({ url: 'about:blank', active: true });
      tabId = tab.id;
      this.activeTabId = tabId;
      console.log('ChannelImportService: Created tab', tabId);

      // Navigate to channel page and wait for it to load
      console.log('ChannelImportService: Navigating to channel page...');
      await this.navigateAndWait(tabId, normalizedUrl);

      // Wait extra time for content script to initialize and page to settle
      console.log('ChannelImportService: Waiting for content script to initialize...');
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Send message to content script to scrape videos
      console.log('ChannelImportService: Requesting video scraping from content script');
      const scrapeResult = await this.sendMessageToTab(tabId, {
        action: 'scrapeChannelVideos',
        limit: limit
      });

      if (!scrapeResult.success) {
        throw new Error(scrapeResult.error || 'Failed to scrape videos');
      }

      const videos = scrapeResult.videos;
      const channelName = scrapeResult.channelName || 'Unknown Channel';
      console.log('ChannelImportService: Scraped', videos.length, 'videos from channel:', channelName);

      if (videos.length === 0) {
        throw new Error('No videos found on channel');
      }

      // Process the video queue
      const result = await this.processVideoQueue(tabId, videos, vueAppTabId, channelName);

      // Close the import tab
      await chrome.tabs.remove(tabId);
      this.activeTabId = null;
      console.log('ChannelImportService: Channel import complete');

      return result;

    } catch (error) {
      console.error('ChannelImportService: Channel import failed:', error);

      // Clean up the tab if it was created
      if (tabId) {
        try {
          await chrome.tabs.remove(tabId);
        } catch (e) {
          // Ignore errors if tab already closed
        }
        this.activeTabId = null;
      }

      // Send error to popup and Vue app
      this.sendProgressUpdate({
        action: 'importProgress',
        completed: true,
        current: 0,
        total: 0,
        error: error.message
      }, vueAppTabId);

      throw error;
    }
  }

  /**
   * Get the ID of the currently active import tab
   * @returns {number|null} The active tab ID or null
   */
  getActiveTabId() {
    return this.activeTabId;
  }
}

// Export singleton instance for use in background script
export const channelImportService = new ChannelImportService();

// Also export the class for testing purposes
export { ChannelImportService };

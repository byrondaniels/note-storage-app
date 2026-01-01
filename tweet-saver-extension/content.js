// Social Media Note Saver - Content Script
// Runs on supported social media platforms to inject save buttons

// Utilities and constants are loaded via manifest:
// - DEFAULT_CONFIG, StorageService from utils/config.js
// - TWITTER_SELECTORS, LINKEDIN_SELECTORS, YOUTUBE_SELECTORS, MUTATION_SELECTORS from constants/selectors.js
// - PLATFORMS, BUTTON_CONFIG, TIMING, CONTENT_LIMITS, PATTERNS from constants/config.js

// Storage helpers for tracking imported videos
async function isVideoImported(videoId) {
  try {
    const result = await chrome.storage.local.get(['importedVideoIds']);
    const importedIds = result.importedVideoIds || [];
    return importedIds.includes(videoId);
  } catch (error) {
    console.error('Social Media Note Saver: Error checking if video imported:', error);
    return false;
  }
}

async function markVideoImported(videoId) {
  try {
    const result = await chrome.storage.local.get(['importedVideoIds']);
    const importedIds = result.importedVideoIds || [];
    if (!importedIds.includes(videoId)) {
      importedIds.push(videoId);
      await chrome.storage.local.set({ importedVideoIds: importedIds });
      console.log('Social Media Note Saver: Marked video as imported:', videoId);
    }
  } catch (error) {
    console.error('Social Media Note Saver: Error marking video imported:', error);
  }
}

class SocialMediaSaver {
  constructor() {
    this.config = null;
    this.processedPosts = new Set();
    this.platform = this.detectPlatform();
    this.isEnabled = true;
    this.observer = null;
    this.currentUrl = window.location.href;

    // Initialize platform handlers
    this.platformHandlers = {
      twitter: null,
      linkedin: null,
      youtube: null
    };

    // UI components (initialized after platform handlers)
    this.actionBarFinder = null;

    this.init();
  }

  detectPlatform() {
    const hostname = window.location.hostname;
    if (hostname.includes('twitter.com') || hostname.includes('x.com')) {
      return 'twitter';
    }
    if (hostname.includes('linkedin.com')) {
      return 'linkedin';
    }
    if (hostname.includes('youtube.com')) {
      return 'youtube';
    }
    // Future platforms can be added here
    // if (hostname.includes('facebook.com')) return 'facebook';
    return 'unknown';
  }

  async init() {
    console.log('Social Media Note Saver: Initializing on', this.platform, 'at', window.location.href);
    await this.loadConfig();
    this.initializePlatformHandlers();

    if (this.isEnabled) {
      this.startObserving();
      // Give the page a moment to load completely
      setTimeout(() => {
        this.processPosts();
      }, 1000);
    } else {
      console.log('Social Media Note Saver: Extension disabled, not starting observers');
    }
  }

  async loadConfig() {
    try {
      const result = await StorageService.loadConfig();
      this.config = result;
      this.isEnabled = result.extensionEnabled;
      console.log('Social Media Note Saver: Config loaded', this.config);
    } catch (error) {
      console.error('Social Media Note Saver: Failed to load config', error);
      this.config = { ...DEFAULT_CONFIG };
      this.isEnabled = true;
    }
  }

  initializePlatformHandlers() {
    // Initialize platform-specific handlers
    this.platformHandlers.twitter = new TwitterHandler(this.config);
    this.platformHandlers.linkedin = new LinkedInHandler(this.config);
    // Pass processedPosts to LinkedIn handler for filtering
    this.platformHandlers.linkedin.setProcessedPosts(this.processedPosts);
    this.platformHandlers.youtube = new YouTubeHandler(this.config);
    console.log('Social Media Note Saver: Platform handlers initialized');

    // Initialize UI components
    this.actionBarFinder = new ActionBarFinder(this.platformHandlers, this.platform);
  }

  startObserving() {
    if (!this.isEnabled) {
      console.log('Social Media Note Saver: Not starting observer - extension disabled');
      return;
    }
    
    // Observe DOM changes to catch dynamically loaded posts
    let processingTimeout = null;
    
    this.observer = new MutationObserver((mutations) => {
      // Double-check enabled state in case it changed
      if (!this.isEnabled) {
        return;
      }
      
      let shouldProcess = false;
      
      mutations.forEach((mutation) => {
        if (mutation.addedNodes.length > 0) {
          // Only process if we see significant DOM changes (new posts)
          for (const node of mutation.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              // Check if this looks like a post container or video change
              if (node.querySelector && (
                  node.querySelector('[data-view-name="feed-full-update"]') ||
                  node.matches('[role="listitem"]') ||
                  node.matches('[data-view-name="feed-full-update"]') ||
                  (this.platform === 'youtube' && (
                    node.matches('#primary') ||
                    node.querySelector('#primary') ||
                    node.matches('.ytd-watch-flexy') ||
                    node.querySelector('.ytd-watch-flexy')
                  ))
                )) {
                shouldProcess = true;
                break;
              }
            }
          }
        }
      });
      
      if (shouldProcess) {
        // Debounce processing to avoid excessive calls
        if (processingTimeout) {
          clearTimeout(processingTimeout);
        }
        processingTimeout = setTimeout(() => {
          console.log('Social Media Note Saver: Processing posts due to DOM changes');
          this.processPosts();
        }, 500);
      }
    });

    this.observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    
    console.log('Social Media Note Saver: MutationObserver started');
  }

  stopObserving() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
      console.log('Social Media Note Saver: MutationObserver stopped');
    }
  }

  processPosts() {
    if (!this.isEnabled) {
      console.log('Social Media Note Saver: Extension disabled, skipping post processing');
      return;
    }
    
    // Check if URL changed (for YouTube video navigation)
    if (this.platform === 'youtube' && window.location.href !== this.currentUrl) {
      console.log('Social Media Note Saver: YouTube URL changed, clearing processed posts');
      this.processedPosts.clear();
      // Remove existing buttons
      const existingButtons = document.querySelectorAll(YOUTUBE_SELECTORS.saveButtons);
      existingButtons.forEach(button => button.remove());
      this.currentUrl = window.location.href;
    }
    
    console.log('Social Media Note Saver: Processing posts on', this.platform);
    const posts = this.findPosts();
    console.log('Social Media Note Saver: Found', posts.length, 'posts');
    posts.forEach(post => this.addSaveButton(post));
  }

  findPosts() {
    const handler = this.platformHandlers[this.platform];
    if (!handler) {
      // Fallback for platforms without handlers yet
      if (this.platform === 'linkedin') {
        return this.findLinkedInPosts();
      }
      if (this.platform === 'youtube') {
        return this.findYouTubeVideos();
      }
      return [];
    }

    // Use platform handler to find posts
    let posts = handler.findPosts();

    // Filter out already processed posts
    return posts.filter(post => {
      const postId = this.getPostId(post);
      if (this.processedPosts.has(postId)) {
        return false;
      }
      // Only process if it has actual post content (use sync check for filtering)
      return this.hasPostContent(post);
    });
  }

  getPostId(postElement) {
    const handler = this.platformHandlers[this.platform];
    if (handler) {
      return handler.getPostId(postElement);
    }

    // Fallback for platforms without handlers yet
    if (this.platform === 'linkedin') {
      return this.getLinkedInId(postElement);
    }
    if (this.platform === 'youtube') {
      return this.getYouTubeId(postElement);
    }
    return Math.random().toString();
  }

  async getPostContent(postElement) {
    const handler = this.platformHandlers[this.platform];
    if (handler) {
      return handler.getPostContent(postElement);
    }

    // Fallback for platforms without handlers yet
    if (this.platform === 'linkedin') {
      return await this.getLinkedInContent(postElement);
    }
    if (this.platform === 'youtube') {
      return await this.getYouTubeTranscript();
    }
    return null;
  }

  hasPostContent(postElement) {
    const handler = this.platformHandlers[this.platform];
    if (handler) {
      const content = handler.getPostContent(postElement);
      return content !== null;
    }

    // Fallback for platforms without handlers yet
    if (this.platform === 'linkedin') {
      return this.hasLinkedInContent(postElement);
    }
    if (this.platform === 'youtube') {
      return true; // YouTube videos always have potential for transcripts
    }
    return false;
  }


  getPostAuthor(postElement) {
    const handler = this.platformHandlers[this.platform];
    if (handler) {
      return handler.getPostAuthor(postElement);
    }

    // Fallback for platforms without handlers yet
    if (this.platform === 'linkedin') {
      return this.getLinkedInAuthor(postElement);
    }
    if (this.platform === 'youtube') {
      const videoInfo = this.getYouTubeVideoInfo();
      return videoInfo.channel;
    }
    return 'Unknown';
  }

  getPostHandle(postElement) {
    const handler = this.platformHandlers[this.platform];
    if (handler) {
      return handler.getPostHandle(postElement);
    }

    // Fallback for platforms without handlers yet
    if (this.platform === 'linkedin') {
      return this.getLinkedInHandle(postElement);
    }
    if (this.platform === 'youtube') {
      const videoInfo = this.getYouTubeVideoInfo();
      return `@${videoInfo.channel}`;
    }
    return '@unknown';
  }

  getPostUrl(postElement) {
    const handler = this.platformHandlers[this.platform];
    if (handler) {
      return handler.getPostUrl(postElement);
    }

    // Fallback for platforms without handlers yet
    if (this.platform === 'linkedin') {
      return this.getLinkedInUrl(postElement);
    }
    if (this.platform === 'youtube') {
      const videoInfo = this.getYouTubeVideoInfo();
      return videoInfo.url;
    }
    return window.location.href;
  }

  getPostTimestamp(postElement) {
    const handler = this.platformHandlers[this.platform];
    if (handler) {
      return handler.getPostTimestamp(postElement);
    }

    // Fallback for platforms without handlers yet
    if (this.platform === 'linkedin') {
      return this.getLinkedInTimestamp(postElement);
    }
    return new Date().toISOString();
  }

  getShareInfo(postElement) {
    const handler = this.platformHandlers[this.platform];
    if (handler) {
      return handler.getShareInfo(postElement);
    }

    // Fallback for platforms without handlers yet
    if (this.platform === 'linkedin') {
      return this.getLinkedInShareInfo(postElement);
    }
    return { isShare: false };
  }

  getPostMetrics(postElement) {
    const handler = this.platformHandlers[this.platform];
    if (handler) {
      return handler.getMetrics(postElement);
    }

    // Fallback for platforms without handlers yet
    if (this.platform === 'linkedin') {
      return this.getLinkedInMetrics(postElement);
    }
    return {};
  }

  // YouTube-specific delegation methods
  async scrapeChannelVideos(limit = 20) {
    const handler = this.platformHandlers.youtube;
    if (handler) {
      return handler.scrapeChannelVideos(limit);
    }
    throw new Error('YouTube handler not initialized');
  }

  async extractAndSaveTranscript() {
    const handler = this.platformHandlers.youtube;
    if (!handler) {
      throw new Error('YouTube handler not initialized');
    }

    const result = await handler.extractAndSaveTranscript();

    if (!result.success) {
      return result;
    }

    // Complete the save by sending to API
    const payload = this.buildPayload(result.postData);

    try {
      const response = await fetch(this.config.apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      // Handle 409 Conflict (duplicate note) as skipped, not error
      if (response.status === 409) {
        console.log('Social Media Note Saver: Note already exists (duplicate):', result.title);
        return {
          success: true,
          skipped: true,
          videoId: result.videoId,
          title: result.title
        };
      }

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }

      console.log('Social Media Note Saver: Successfully saved transcript for:', result.title);
      return {
        success: true,
        videoId: result.videoId,
        title: result.title
      };

    } catch (error) {
      console.error('Social Media Note Saver: Failed to save transcript:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }




  addSaveButton(postElement) {
    const postId = this.getPostId(postElement);

    if (this.processedPosts.has(postId)) {
      console.log('Social Media Note Saver: Post already processed, skipping:', postId);
      return;
    }

    // For YouTube, check for existing buttons more broadly since the postElement might be the entire page
    if (this.platform === 'youtube') {
      const existingButtons = document.querySelectorAll(YOUTUBE_SELECTORS.saveButtons);
      if (existingButtons.length > 0) {
        console.log('Social Media Note Saver: YouTube save button already exists, skipping');
        this.processedPosts.add(postId);
        return;
      }
    } else {
      // Check if save button already exists on this specific post
      const existingButton = postElement.querySelector('.social-save-btn');
      if (existingButton) {
        console.log('Social Media Note Saver: Save button already exists on post:', postId);
        this.processedPosts.add(postId);
        return;
      }
    }

    this.processedPosts.add(postId);

    // Find a good place to insert the button using ActionBarFinder
    const actionBar = this.actionBarFinder.findActionBar(postElement);
    if (!actionBar) {
      console.log('Social Media Note Saver: Could not find action bar for post');
      return;
    }

    console.log('Social Media Note Saver: Adding save button to post:', postId);

    // Create save button using SaveButton class
    const saveButtonInstance = new SaveButton(this.platform, async () => {
      await this.savePost(postElement, saveButtonInstance);
    });
    const saveButton = saveButtonInstance.createElement();

    // Insert button at the far right of the action bar
    console.log('Social Media Note Saver: Inserting button into action bar:', actionBar);
    console.log('Social Media Note Saver: Action bar current children:', actionBar.children.length);

    actionBar.appendChild(saveButton);

    console.log('Social Media Note Saver: Button added, new children count:', actionBar.children.length);
    console.log('Social Media Note Saver: Save button element:', saveButton);
    console.log('Social Media Note Saver: Save button visible?', saveButton.offsetWidth > 0 && saveButton.offsetHeight > 0);

    // Ensure the action bar uses flexbox layout
    actionBar.style.display = 'flex';
    actionBar.style.alignItems = 'center';
    actionBar.style.gap = '8px';

    // Make sure save button is positioned at the end and isolated
    saveButton.style.marginLeft = 'auto';
    saveButton.style.position = 'relative';
    saveButton.style.zIndex = '1000';

    // For YouTube, make it more visible
    if (this.platform === 'youtube') {
      saveButton.style.border = '2px solid #1976d2 !important';
      saveButton.style.transform = 'scale(1.1) !important';
      console.log('Social Media Note Saver: Applied YouTube-specific visibility styles');
    }

    // Prevent event bubbling that might interfere with other buttons
    saveButton.addEventListener('mouseenter', (e) => {
      e.stopPropagation();
    });

    saveButton.addEventListener('mouseleave', (e) => {
      e.stopPropagation();
    });
  }

  async savePost(postElement, saveButtonInstance) {
    try {
      // Show loading state using SaveButton method
      saveButtonInstance.setLoading();

      // Extract post data
      const shareInfo = this.getShareInfo(postElement);
      const metrics = this.getPostMetrics(postElement);

      const postData = {
        content: await this.getPostContent(postElement),
        author: this.getPostAuthor(postElement),
        handle: this.getPostHandle(postElement),
        url: this.getPostUrl(postElement),
        timestamp: this.getPostTimestamp(postElement),
        platform: this.platform,
        isShare: shareInfo.isShare || shareInfo.isRetweet || false,
        sharedBy: shareInfo.sharedBy || shareInfo.retweetedBy || '',
        shareContext: shareInfo.shareContext || shareInfo.retweetContext || '',
        metrics: metrics
      };

      console.log('Social Media Note Saver: Extracted data', postData);

      // Build payload from template
      const payload = this.buildPayload(postData);

      // Send to API
      const response = await fetch(this.config.apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }

      // Show success using SaveButton method (auto-resets after 2 seconds)
      saveButtonInstance.setSuccess();

    } catch (error) {
      console.error('Social Media Note Saver: Save failed', error);

      // Show error using SaveButton method (auto-resets after 3 seconds)
      saveButtonInstance.setError(error.message);
    }
  }

  buildPayload(postData) {
    // Deep clone the template
    const payload = JSON.parse(JSON.stringify(this.config.payloadTemplate));
    
    // Replace placeholders recursively
    const replacePlaceholders = (obj) => {
      if (typeof obj === 'string') {
        // Handle conditional share context
        let sharePrefix = '';
        if (postData.isShare && postData.shareContext) {
          sharePrefix = `${postData.shareContext}\n\n`;
        }
        
        return obj
          .replace(/\{\{content\}\}/g, postData.content || '')
          .replace(/\{\{author\}\}/g, postData.author || '')
          .replace(/\{\{handle\}\}/g, postData.handle || '')
          .replace(/\{\{url\}\}/g, postData.url || '')
          .replace(/\{\{timestamp\}\}/g, postData.timestamp || '')
          .replace(/\{\{isRetweet\}\}/g, postData.isShare ? 'true' : 'false')
          .replace(/\{\{retweetedBy\}\}/g, postData.sharedBy || '')
          .replace(/\{\{shareContext\}\}/g, sharePrefix)
          .replace(/\{\{platform\}\}/g, postData.platform || 'unknown')
          .replace(/\{\{isShare\}\}/g, postData.isShare ? 'true' : 'false')
          .replace(/\{\{sharedBy\}\}/g, postData.sharedBy || '')
          .replace(/\{\{metrics\}\}/g, JSON.stringify(postData.metrics || {}))
          // Backward compatibility for existing templates
          .replace(/\{\{retweetContext\}\}/g, sharePrefix)
          .replace(/\{\{isRetweet\}\}/g, postData.isShare ? 'true' : 'false')
          .replace(/\{\{retweetedBy\}\}/g, postData.sharedBy || '');
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
    
    return replacePlaceholders(payload);
  }

  handleExtensionToggle(enabled) {
    this.isEnabled = enabled;
    console.log('Social Media Note Saver: Extension', enabled ? 'enabled' : 'disabled');
    
    if (!enabled) {
      // Stop observing DOM changes
      this.stopObserving();
      
      // Remove all existing save buttons
      const existingButtons = document.querySelectorAll('.social-save-btn');
      existingButtons.forEach(button => button.remove());
      console.log('Social Media Note Saver: Removed', existingButtons.length, 'save buttons');
    } else {
      // Start observing DOM changes
      this.startObserving();
      
      // Re-process posts to add save buttons
      setTimeout(() => {
        this.processPosts();
      }, 100);
    }
  }
}

// Global instance
let socialMediaSaver;

// Listen for messages from popup and background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Social Media Note Saver: Received message:', message.action);

  if (message.action === 'extensionToggled') {
    if (socialMediaSaver) {
      socialMediaSaver.handleExtensionToggle(message.enabled);
    }
    return false;
  }

  if (message.action === 'configUpdated') {
    if (socialMediaSaver) {
      socialMediaSaver.loadConfig();
    }
    return false;
  }

  if (message.action === 'scrapeChannelVideos') {
    console.log('Social Media Note Saver: Handling scrapeChannelVideos, limit:', message.limit);

    if (!socialMediaSaver) {
      console.error('Social Media Note Saver: socialMediaSaver not initialized');
      sendResponse({ success: false, error: 'Content script not initialized' });
      return true;
    }

    socialMediaSaver.scrapeChannelVideos(message.limit || 20)
      .then(videos => {
        console.log('Social Media Note Saver: Scraped videos, sending response:', videos.length);
        sendResponse({ success: true, videos: videos });
      })
      .catch(error => {
        console.error('Social Media Note Saver: Error scraping videos:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Keep message channel open for async response
  }

  if (message.action === 'extractAndSaveTranscript') {
    console.log('Social Media Note Saver: Handling extractAndSaveTranscript');

    if (!socialMediaSaver) {
      console.error('Social Media Note Saver: socialMediaSaver not initialized');
      sendResponse({ success: false, error: 'Content script not initialized' });
      return true;
    }

    socialMediaSaver.extractAndSaveTranscript()
      .then(result => {
        console.log('Social Media Note Saver: extractAndSaveTranscript result:', result);
        sendResponse(result);
      })
      .catch(error => {
        console.error('Social Media Note Saver: Error in extractAndSaveTranscript:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Keep message channel open for async response
  }

  return false;
});

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    socialMediaSaver = new SocialMediaSaver();
  });
} else {
  socialMediaSaver = new SocialMediaSaver();
}
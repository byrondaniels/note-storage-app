// Social Media Note Saver - Content Script
// Runs on supported social media platforms to inject save buttons
//
// Dependencies (loaded via manifest):
// - DEFAULT_CONFIG, StorageService from utils/config.js
// - YOUTUBE_SELECTORS from constants/selectors.js
// - Platform handlers: TwitterHandler, LinkedInHandler, YouTubeHandler
// - NotesApiClient from services/api-client.js
// - SaveButton from ui/save-button.js
// - ActionBarFinder from ui/action-bar-finder.js
// - replaceTemplatePlaceholders from utils/template-processor.js

/**
 * Detect current platform from hostname
 * @returns {string} Platform identifier ('twitter', 'linkedin', 'youtube', 'unknown')
 */
function detectPlatform() {
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
  return 'unknown';
}

/**
 * SocialMediaSaver - Main orchestrator for the content script
 *
 * Responsibilities:
 * - Platform detection and handler instantiation
 * - DOM observation for dynamically loaded posts
 * - Message handling from popup/background
 * - Coordination between platform handlers, UI components, and API client
 */
class SocialMediaSaver {
  constructor() {
    this.config = null;
    this.platformHandler = null;
    this.processedPosts = new Set();
    this.platform = detectPlatform();
    this.isEnabled = true;
    this.observer = null;
    this.currentUrl = window.location.href;
    this.apiClient = null;
    this.actionBarFinder = null;

    this.init();
  }

  /**
   * Initialize the saver: load config, create handler, start observing
   */
  async init() {
    console.log('Social Media Note Saver: Initializing on', this.platform, 'at', window.location.href);

    await this.loadConfig();
    this.createPlatformHandler();

    if (this.isEnabled) {
      this.startObserving();
      // Give the page a moment to load completely
      setTimeout(() => this.processPosts(), 1000);
    } else {
      console.log('Social Media Note Saver: Extension disabled, not starting observers');
    }
  }

  /**
   * Load configuration from storage
   */
  async loadConfig() {
    try {
      this.config = await StorageService.loadConfig();
      this.isEnabled = this.config.extensionEnabled;
      console.log('Social Media Note Saver: Config loaded', this.config);
    } catch (error) {
      console.error('Social Media Note Saver: Failed to load config', error);
      this.config = { ...DEFAULT_CONFIG };
      this.isEnabled = true;
    }
  }

  /**
   * Create platform-specific handler based on detected platform
   */
  createPlatformHandler() {
    switch (this.platform) {
      case 'twitter':
        this.platformHandler = new TwitterHandler(this.config);
        break;
      case 'linkedin':
        this.platformHandler = new LinkedInHandler(this.config);
        this.platformHandler.setProcessedPosts(this.processedPosts);
        break;
      case 'youtube':
        this.platformHandler = new YouTubeHandler(this.config);
        break;
      default:
        console.log('Social Media Note Saver: Unknown platform, no handler created');
        return;
    }

    console.log('Social Media Note Saver: Platform handler created for', this.platform);

    // Initialize UI components and API client
    this.actionBarFinder = new ActionBarFinder(
      { [this.platform]: this.platformHandler },
      this.platform
    );
    this.apiClient = new NotesApiClient(this.config.apiEndpoint);
    console.log('Social Media Note Saver: API client initialized');
  }

  /**
   * Start observing DOM for dynamically loaded posts
   */
  startObserving() {
    if (!this.isEnabled) {
      console.log('Social Media Note Saver: Not starting observer - extension disabled');
      return;
    }

    let processingTimeout = null;

    this.observer = new MutationObserver((mutations) => {
      if (!this.isEnabled) return;

      let shouldProcess = false;

      for (const mutation of mutations) {
        if (mutation.addedNodes.length === 0) continue;

        for (const node of mutation.addedNodes) {
          if (node.nodeType !== Node.ELEMENT_NODE) continue;
          if (!node.querySelector) continue;

          // Check if this looks like a post container or video change
          if (this.isRelevantMutation(node)) {
            shouldProcess = true;
            break;
          }
        }
        if (shouldProcess) break;
      }

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

  /**
   * Check if a DOM mutation is relevant for post processing
   * @param {Node} node - The added node
   * @returns {boolean} True if mutation is relevant
   */
  isRelevantMutation(node) {
    // LinkedIn feed updates
    if (node.querySelector('[data-view-name="feed-full-update"]') ||
        node.matches('[role="listitem"]') ||
        node.matches('[data-view-name="feed-full-update"]')) {
      return true;
    }

    // YouTube video navigation
    if (this.platform === 'youtube') {
      if (node.matches('#primary') ||
          node.querySelector('#primary') ||
          node.matches('.ytd-watch-flexy') ||
          node.querySelector('.ytd-watch-flexy')) {
        return true;
      }
    }

    return false;
  }

  /**
   * Stop observing DOM changes
   */
  stopObserving() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
      console.log('Social Media Note Saver: MutationObserver stopped');
    }
  }

  /**
   * Process posts on the page and add save buttons
   */
  processPosts() {
    if (!this.isEnabled || !this.platformHandler) return;

    // Handle YouTube URL changes (video navigation)
    if (this.platform === 'youtube' && window.location.href !== this.currentUrl) {
      console.log('Social Media Note Saver: YouTube URL changed, clearing processed posts');
      this.processedPosts.clear();
      document.querySelectorAll(YOUTUBE_SELECTORS.saveButtons).forEach(btn => btn.remove());
      this.currentUrl = window.location.href;
    }

    console.log('Social Media Note Saver: Processing posts on', this.platform);

    const posts = this.findUnprocessedPosts();
    console.log('Social Media Note Saver: Found', posts.length, 'posts');

    posts.forEach(post => this.addSaveButton(post));
  }

  /**
   * Find posts that haven't been processed yet
   * @returns {Array<Element>} Array of unprocessed post elements
   */
  findUnprocessedPosts() {
    const posts = this.platformHandler.findPosts();

    return posts.filter(post => {
      const postId = this.platformHandler.getPostId(post);
      if (this.processedPosts.has(postId)) {
        return false;
      }
      // Only process if it has actual post content
      const content = this.platformHandler.getPostContent(post);
      return content !== null;
    });
  }

  /**
   * Add save button to a post element
   * @param {Element} postElement - The post DOM element
   */
  addSaveButton(postElement) {
    const postId = this.platformHandler.getPostId(postElement);

    if (this.processedPosts.has(postId)) {
      return;
    }

    // For YouTube, check for existing buttons globally
    if (this.platform === 'youtube') {
      if (document.querySelectorAll(YOUTUBE_SELECTORS.saveButtons).length > 0) {
        this.processedPosts.add(postId);
        return;
      }
    } else {
      // Check if button already exists on this specific post
      if (postElement.querySelector('.social-save-btn')) {
        this.processedPosts.add(postId);
        return;
      }
    }

    this.processedPosts.add(postId);

    // Find action bar for button placement
    const actionBar = this.actionBarFinder.findActionBar(postElement);
    if (!actionBar) {
      console.log('Social Media Note Saver: Could not find action bar for post');
      return;
    }

    console.log('Social Media Note Saver: Adding save button to post:', postId);

    // Create and configure save button
    const saveButtonInstance = new SaveButton(this.platform, async () => {
      await this.savePost(postElement, saveButtonInstance);
    });
    const saveButton = saveButtonInstance.createElement();

    // Insert button and configure action bar layout
    actionBar.appendChild(saveButton);
    this.configureActionBarLayout(actionBar, saveButton);
  }

  /**
   * Configure action bar flexbox layout for button placement
   * @param {Element} actionBar - The action bar element
   * @param {Element} saveButton - The save button element
   */
  configureActionBarLayout(actionBar, saveButton) {
    actionBar.style.display = 'flex';
    actionBar.style.alignItems = 'center';
    actionBar.style.gap = '8px';

    saveButton.style.marginLeft = 'auto';
    saveButton.style.position = 'relative';
    saveButton.style.zIndex = '1000';

    // YouTube-specific visibility enhancements
    if (this.platform === 'youtube') {
      saveButton.style.border = '2px solid #1976d2 !important';
      saveButton.style.transform = 'scale(1.1) !important';
    }

    // Prevent event bubbling
    saveButton.addEventListener('mouseenter', e => e.stopPropagation());
    saveButton.addEventListener('mouseleave', e => e.stopPropagation());
  }

  /**
   * Save a post to the notes API
   * @param {Element} postElement - The post DOM element
   * @param {SaveButton} saveButtonInstance - The save button instance
   */
  async savePost(postElement, saveButtonInstance) {
    try {
      saveButtonInstance.setLoading();

      const postData = await this.extractPostData(postElement);
      console.log('Social Media Note Saver: Extracted data', postData);

      const payload = replaceTemplatePlaceholders(this.config.payloadTemplate, postData);
      const result = await this.apiClient.saveNote(payload);

      if (!result.success) {
        throw new Error(result.error || 'Failed to save note');
      }

      saveButtonInstance.setSuccess();
    } catch (error) {
      console.error('Social Media Note Saver: Save failed', error);
      saveButtonInstance.setError(error.message);
    }
  }

  /**
   * Extract all post data using the platform handler
   * @param {Element} postElement - The post DOM element
   * @returns {Object} Post data object
   */
  async extractPostData(postElement) {
    const shareInfo = this.platformHandler.getShareInfo(postElement);
    const metrics = this.platformHandler.getMetrics(postElement);

    return {
      content: await this.platformHandler.getPostContent(postElement),
      author: this.platformHandler.getPostAuthor(postElement),
      handle: this.platformHandler.getPostHandle(postElement),
      url: this.platformHandler.getPostUrl(postElement),
      timestamp: this.platformHandler.getPostTimestamp(postElement),
      platform: this.platform,
      isShare: shareInfo.isShare || shareInfo.isRetweet || false,
      sharedBy: shareInfo.sharedBy || shareInfo.retweetedBy || '',
      shareContext: shareInfo.shareContext || shareInfo.retweetContext || '',
      metrics: metrics
    };
  }

  /**
   * Handle extension toggle from popup
   * @param {boolean} enabled - Whether extension is enabled
   */
  handleExtensionToggle(enabled) {
    this.isEnabled = enabled;
    console.log('Social Media Note Saver: Extension', enabled ? 'enabled' : 'disabled');

    if (!enabled) {
      this.stopObserving();
      document.querySelectorAll('.social-save-btn').forEach(btn => btn.remove());
    } else {
      this.startObserving();
      setTimeout(() => this.processPosts(), 100);
    }
  }

  // ============================================================================
  // YouTube-specific methods for channel import feature
  // ============================================================================

  /**
   * Scrape channel videos (delegates to YouTube handler)
   * @param {number} limit - Maximum videos to scrape
   * @returns {Promise<Array>} Array of video objects
   */
  async scrapeChannelVideos(limit = 20) {
    if (this.platform !== 'youtube' || !this.platformHandler) {
      throw new Error('YouTube handler not available');
    }
    return this.platformHandler.scrapeChannelVideos(limit);
  }

  /**
   * Extract and save transcript for current video
   * @param {string} channelName - Optional channel name to use (for consistency during imports)
   * @returns {Promise<Object>} Result object with success status
   */
  async extractAndSaveTranscript(channelName) {
    if (this.platform !== 'youtube' || !this.platformHandler) {
      throw new Error('YouTube handler not available');
    }

    const result = await this.platformHandler.extractAndSaveTranscript(channelName);

    if (!result.success) {
      return result;
    }

    // Complete the save by sending to API
    const payload = replaceTemplatePlaceholders(this.config.payloadTemplate, result.postData);
    const apiResult = await this.apiClient.saveNote(payload);

    if (!apiResult.success) {
      console.error('Social Media Note Saver: Failed to save transcript:', apiResult.error);
      return { success: false, error: apiResult.error };
    }

    if (apiResult.skipped) {
      console.log('Social Media Note Saver: Note already exists (duplicate):', result.title);
      return { success: true, skipped: true, videoId: result.videoId, title: result.title };
    }

    console.log('Social Media Note Saver: Successfully saved transcript for:', result.title);
    return { success: true, videoId: result.videoId, title: result.title };
  }
}

// ============================================================================
// Global instance and message handling
// ============================================================================

let socialMediaSaver;

/**
 * Handle messages from popup and background script
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Social Media Note Saver: Received message:', message.action);

  switch (message.action) {
    case 'extensionToggled':
      if (socialMediaSaver) {
        socialMediaSaver.handleExtensionToggle(message.enabled);
      }
      return false;

    case 'configUpdated':
      if (socialMediaSaver) {
        socialMediaSaver.loadConfig();
      }
      return false;

    case 'scrapeChannelVideos':
      if (!socialMediaSaver) {
        sendResponse({ success: false, error: 'Content script not initialized' });
        return true;
      }
      socialMediaSaver.scrapeChannelVideos(message.limit || 20)
        .then(result => sendResponse({ success: true, videos: result.videos, channelName: result.channelName }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;

    case 'extractAndSaveTranscript':
      if (!socialMediaSaver) {
        sendResponse({ success: false, error: 'Content script not initialized' });
        return true;
      }
      socialMediaSaver.extractAndSaveTranscript(message.channelName)
        .then(result => sendResponse(result))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;

    default:
      return false;
  }
});

// ============================================================================
// Initialization
// ============================================================================

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    socialMediaSaver = new SocialMediaSaver();
  });
} else {
  socialMediaSaver = new SocialMediaSaver();
}

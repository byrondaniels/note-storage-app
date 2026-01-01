/**
 * Content Script Entry Point
 *
 * Bundles all content script dependencies into a single IIFE.
 * This allows proper ES module imports while maintaining compatibility
 * with Chrome's content script injection.
 */

// Utils and constants
import { DEFAULT_CONFIG, StorageService } from '../utils/config.js';
import { replaceTemplatePlaceholders } from '../utils/template-processor.js';
import { TWITTER_SELECTORS, LINKEDIN_SELECTORS, YOUTUBE_SELECTORS } from '../constants/selectors.js';
import { PLATFORMS, BUTTON_CONFIG, TIMING, CONTENT_LIMITS, PATTERNS } from '../constants/config.js';

// Platform handlers
import { BasePlatformHandler } from '../platforms/base-platform-handler.js';
import { TwitterHandler } from '../platforms/twitter-handler.js';
import { LinkedInHandler } from '../platforms/linkedin-handler.js';
import { YouTubeHandler } from '../platforms/youtube-handler.js';

// Services
import { NotesApiClient } from '../services/api-client.js';

// UI components
import { SaveButton } from '../ui/save-button.js';
import { ActionBarFinder } from '../ui/action-bar-finder.js';

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

  async init() {
    console.log('Social Media Note Saver: Initializing on', this.platform, 'at', window.location.href);

    await this.loadConfig();
    this.createPlatformHandler();

    if (this.isEnabled) {
      this.startObserving();
      setTimeout(() => this.processPosts(), 1000);
    } else {
      console.log('Social Media Note Saver: Extension disabled, not starting observers');
    }
  }

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

    this.actionBarFinder = new ActionBarFinder(
      { [this.platform]: this.platformHandler },
      this.platform
    );
    this.apiClient = new NotesApiClient(this.config.apiEndpoint);
    console.log('Social Media Note Saver: API client initialized');
  }

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

          if (this.isRelevantMutation(node)) {
            shouldProcess = true;
            break;
          }
        }
        if (shouldProcess) break;
      }

      if (shouldProcess) {
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

  isRelevantMutation(node) {
    if (node.querySelector('[data-view-name="feed-full-update"]') ||
        node.matches('[role="listitem"]') ||
        node.matches('[data-view-name="feed-full-update"]')) {
      return true;
    }

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

  stopObserving() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
      console.log('Social Media Note Saver: MutationObserver stopped');
    }
  }

  processPosts() {
    if (!this.isEnabled || !this.platformHandler) return;

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

  findUnprocessedPosts() {
    const posts = this.platformHandler.findPosts();

    return posts.filter(post => {
      const postId = this.platformHandler.getPostId(post);
      if (this.processedPosts.has(postId)) {
        return false;
      }
      const content = this.platformHandler.getPostContent(post);
      return content !== null;
    });
  }

  addSaveButton(postElement) {
    const postId = this.platformHandler.getPostId(postElement);

    if (this.processedPosts.has(postId)) {
      return;
    }

    if (this.platform === 'youtube') {
      if (document.querySelectorAll(YOUTUBE_SELECTORS.saveButtons).length > 0) {
        this.processedPosts.add(postId);
        return;
      }
    } else {
      if (postElement.querySelector('.social-save-btn')) {
        this.processedPosts.add(postId);
        return;
      }
    }

    this.processedPosts.add(postId);

    const actionBar = this.actionBarFinder.findActionBar(postElement);
    if (!actionBar) {
      console.log('Social Media Note Saver: Could not find action bar for post');
      return;
    }

    console.log('Social Media Note Saver: Adding save button to post:', postId);

    const saveButtonInstance = new SaveButton(this.platform, async () => {
      await this.savePost(postElement, saveButtonInstance);
    });
    const saveButton = saveButtonInstance.createElement();

    actionBar.appendChild(saveButton);
    this.configureActionBarLayout(actionBar, saveButton);
  }

  configureActionBarLayout(actionBar, saveButton) {
    actionBar.style.display = 'flex';
    actionBar.style.alignItems = 'center';
    actionBar.style.gap = '8px';

    saveButton.style.marginLeft = 'auto';
    saveButton.style.position = 'relative';
    saveButton.style.zIndex = '1000';

    if (this.platform === 'youtube') {
      saveButton.style.border = '2px solid #1976d2 !important';
      saveButton.style.transform = 'scale(1.1) !important';
    }

    saveButton.addEventListener('mouseenter', e => e.stopPropagation());
    saveButton.addEventListener('mouseleave', e => e.stopPropagation());
  }

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

  // YouTube-specific methods
  async scrapeChannelVideos(limit = 20) {
    if (this.platform !== 'youtube' || !this.platformHandler) {
      throw new Error('YouTube handler not available');
    }
    return this.platformHandler.scrapeChannelVideos(limit);
  }

  async extractAndSaveTranscript() {
    if (this.platform !== 'youtube' || !this.platformHandler) {
      throw new Error('YouTube handler not available');
    }

    const result = await this.platformHandler.extractAndSaveTranscript();

    if (!result.success) {
      return result;
    }

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

// Global instance and message handling
let socialMediaSaver;

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
        .then(videos => sendResponse({ success: true, videos }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;

    case 'extractAndSaveTranscript':
      if (!socialMediaSaver) {
        sendResponse({ success: false, error: 'Content script not initialized' });
        return true;
      }
      socialMediaSaver.extractAndSaveTranscript()
        .then(result => sendResponse(result))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;

    default:
      return false;
  }
});

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    socialMediaSaver = new SocialMediaSaver();
  });
} else {
  socialMediaSaver = new SocialMediaSaver();
}

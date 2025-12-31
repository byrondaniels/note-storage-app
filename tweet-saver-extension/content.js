// Social Media Note Saver - Content Script
// Runs on supported social media platforms to inject save buttons

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
      const result = await chrome.storage.sync.get({
        extensionEnabled: true,
        apiEndpoint: 'http://localhost:8080/notes',
        payloadTemplate: {
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
        }
      });
      this.config = result;
      this.isEnabled = result.extensionEnabled;
      console.log('Social Media Note Saver: Config loaded', this.config);
    } catch (error) {
      console.error('Social Media Note Saver: Failed to load config', error);
      this.config = {
        extensionEnabled: true,
        apiEndpoint: 'http://localhost:8080/notes',
        payloadTemplate: {
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
        }
      };
      this.isEnabled = true;
    }
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
      const existingButtons = document.querySelectorAll('.social-save-btn[data-platform="youtube"]');
      existingButtons.forEach(button => button.remove());
      this.currentUrl = window.location.href;
    }
    
    console.log('Social Media Note Saver: Processing posts on', this.platform);
    const posts = this.findPosts();
    console.log('Social Media Note Saver: Found', posts.length, 'posts');
    posts.forEach(post => this.addSaveButton(post));
  }

  findPosts() {
    if (this.platform === 'twitter') {
      return this.findTwitterPosts();
    }
    if (this.platform === 'linkedin') {
      return this.findLinkedInPosts();
    }
    if (this.platform === 'youtube') {
      return this.findYouTubeVideos();
    }
    // Future platforms can be added here
    return [];
  }

  findTwitterPosts() {
    // Twitter/X uses various selectors depending on the page structure
    const selectors = [
      '[data-testid="tweet"]',
      'article[role="article"]',
      '[data-testid="tweetText"]',
      '.tweet'
    ];
    
    let posts = [];
    for (const selector of selectors) {
      const elements = document.querySelectorAll(selector);
      if (elements.length > 0) {
        posts = Array.from(elements);
        break;
      }
    }
    
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
    if (this.platform === 'twitter') {
      return this.getTwitterId(postElement);
    }
    if (this.platform === 'linkedin') {
      return this.getLinkedInId(postElement);
    }
    if (this.platform === 'youtube') {
      return this.getYouTubeId(postElement);
    }
    return Math.random().toString();
  }

  async getPostContent(postElement) {
    if (this.platform === 'twitter') {
      return this.getTwitterContent(postElement);
    }
    if (this.platform === 'linkedin') {
      return await this.getLinkedInContent(postElement);
    }
    if (this.platform === 'youtube') {
      return await this.getYouTubeTranscript();
    }
    return null;
  }

  hasPostContent(postElement) {
    if (this.platform === 'twitter') {
      return this.getTwitterContent(postElement) !== null;
    }
    if (this.platform === 'linkedin') {
      return this.hasLinkedInContent(postElement);
    }
    if (this.platform === 'youtube') {
      return true; // YouTube videos always have potential for transcripts
    }
    return false;
  }

  hasLinkedInContent(postElement) {
    // Quick sync check for content presence (without expanding)
    const contentSelectors = [
      '[data-view-name="feed-commentary"] span[tabindex="-1"]',
      '[data-testid="expandable-text-box"]',
      '.feed-shared-update-v2__description .break-words',
      '.feed-shared-text',
      '.feed-shared-inline-show-more-text',
      '.attributed-text-segment-list__content',
      '[data-test-id="main-feed-activity-card"] .break-words',
      '.feed-shared-update-v2__commentary .break-words',
      '.break-words',
      '[dir="ltr"]',
      'span[lang]',
      'div[lang]'
    ];
    
    for (const selector of contentSelectors) {
      const contentElement = postElement.querySelector(selector);
      if (contentElement && contentElement.textContent.trim()) {
        const text = contentElement.textContent.trim();
        if (text.length > 20 && !text.match(/^\d+\s*(hour|day|week|month)s?\s*ago$/i)) {
          return true;
        }
      }
    }
    
    return false;
  }

  getPostAuthor(postElement) {
    if (this.platform === 'twitter') {
      return this.getTwitterAuthor(postElement);
    }
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
    if (this.platform === 'twitter') {
      return this.getTwitterHandle(postElement);
    }
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
    if (this.platform === 'twitter') {
      return this.getTwitterUrl(postElement);
    }
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
    if (this.platform === 'twitter') {
      return this.getTwitterTimestamp(postElement);
    }
    if (this.platform === 'linkedin') {
      return this.getLinkedInTimestamp(postElement);
    }
    return new Date().toISOString();
  }

  getShareInfo(postElement) {
    if (this.platform === 'twitter') {
      return this.getTwitterRetweetInfo(postElement);
    }
    if (this.platform === 'linkedin') {
      return this.getLinkedInShareInfo(postElement);
    }
    return { isShare: false };
  }

  getPostMetrics(postElement) {
    if (this.platform === 'twitter') {
      return this.getTwitterMetrics(postElement);
    }
    if (this.platform === 'linkedin') {
      return this.getLinkedInMetrics(postElement);
    }
    return {};
  }

  // LinkedIn-specific implementations
  findLinkedInPosts() {
    console.log('Social Media Note Saver: Looking for LinkedIn posts...');
    
    // Try specific selectors first - updated for current LinkedIn interface
    const specificSelectors = [
      '[role="listitem"][componentkey*="urn:li:activity"]',
      '[role="listitem"][componentkey*="FeedType_MAIN_FEED"]',
      '[data-view-name="feed-full-update"]',
      '.feed-shared-update-v2',
      '[data-id*="urn:li:activity"]',
      '.occludable-update',
      'article',
      '.artdeco-card',
      '[data-urn]',
      '[data-entity-urn]',
      '[data-view-name]'
    ];
    
    let posts = [];
    for (const selector of specificSelectors) {
      const elements = document.querySelectorAll(selector);
      console.log(`Social Media Note Saver: Selector "${selector}" found ${elements.length} elements`);
      if (elements.length > 0) {
        posts = Array.from(elements);
        break;
      }
    }
    
    // If no posts found with specific selectors, try content-based detection
    if (posts.length === 0) {
      console.log('Social Media Note Saver: Trying content-based detection...');
      posts = this.findLinkedInPostsByContent();
    }
    
    console.log('Social Media Note Saver: Raw posts found:', posts.length);
    
    // Filter out already processed posts and ensure they have content
    const filteredPosts = posts.filter(post => {
      const postId = this.getLinkedInId(post);
      if (this.processedPosts.has(postId)) {
        console.log('Social Media Note Saver: Post already processed:', postId);
        return false;
      }
      // Only process if it has actual post content (use sync check for filtering)
      const hasContent = this.hasLinkedInContent(post);
      console.log('Social Media Note Saver: Post has content:', hasContent, postId);
      return hasContent;
    });
    
    console.log('Social Media Note Saver: Filtered posts:', filteredPosts.length);
    return filteredPosts;
  }

  findLinkedInPostsByContent() {
    console.log('Social Media Note Saver: Using content-based LinkedIn post detection...');
    
    // Look for elements that contain typical LinkedIn post content
    const allDivs = document.querySelectorAll('div');
    const candidatePosts = [];
    
    Array.from(allDivs).forEach(div => {
      const text = div.textContent;
      if (!text || text.length < 50 || text.length > 5000) return;
      
      // Look for LinkedIn post indicators
      const hasTimeAgo = /\d+\s*(hour|day|week|month|year)s?\s*ago/i.test(text);
      const hasEngagement = /\d+\s*(reaction|like|comment|share|repost)/i.test(text);
      const hasLinkedInTerms = text.includes('•') || 
                              text.includes('reacted') || 
                              text.includes('posted') ||
                              text.includes('shared') ||
                              text.includes('commented');
      
      if (hasTimeAgo || (hasEngagement && hasLinkedInTerms)) {
        // Find a suitable parent container that likely represents the full post
        let container = div;
        let attempts = 0;
        
        // Walk up the DOM to find a container that seems like a full post
        while (container.parentElement && attempts < 5) {
          const parent = container.parentElement;
          const parentText = parent.textContent;
          
          // If parent has significantly more content, it's likely the post container
          if (parentText.length > text.length * 1.5 && parentText.length < 10000) {
            container = parent;
          }
          
          attempts++;
          container = parent;
        }
        
        candidatePosts.push(container);
      }
    });
    
    // Remove duplicates by checking if elements are contained within each other
    const uniquePosts = [];
    candidatePosts.forEach(candidate => {
      const isDuplicate = uniquePosts.some(existing => 
        existing.contains(candidate) || candidate.contains(existing)
      );
      if (!isDuplicate) {
        uniquePosts.push(candidate);
      }
    });
    
    console.log('Social Media Note Saver: Content-based detection found', uniquePosts.length, 'potential posts');
    return uniquePosts;
  }

  getLinkedInId(postElement) {
    // Try to get LinkedIn activity URN from componentkey attribute
    const componentKey = postElement.getAttribute('componentkey');
    if (componentKey && componentKey.includes('urn:li:activity')) {
      return componentKey;
    }
    
    // Try to get LinkedIn activity URN from data-id
    const urnElement = postElement.querySelector('[data-id*="urn:li:activity"]');
    if (urnElement) {
      const urn = urnElement.getAttribute('data-id');
      if (urn) return urn;
    }
    
    // Try to find post permalink
    const permalink = postElement.querySelector('a[href*="/posts/"]');
    if (permalink) {
      const href = permalink.getAttribute('href');
      const match = href.match(/posts\/([^\/\?]+)/);
      if (match) return match[1];
    }
    
    // Try to find unique identifier in DOM structure
    const dataTrackingElements = postElement.querySelectorAll('[data-view-tracking-scope]');
    for (const element of dataTrackingElements) {
      const trackingScope = element.getAttribute('data-view-tracking-scope');
      if (trackingScope && trackingScope.includes('urn:li:activity')) {
        try {
          const parsed = JSON.parse(trackingScope);
          if (parsed[0] && parsed[0].contentTrackingId) {
            return 'tracking-' + parsed[0].contentTrackingId;
          }
        } catch (e) {
          // Ignore parsing errors
        }
      }
    }
    
    // Create a stable ID based on DOM position and first bit of content
    const hasContent = this.hasLinkedInContent(postElement);
    if (hasContent) {
      // Use the element's position in the document plus content hash
      const rect = postElement.getBoundingClientRect();
      const contentElement = postElement.querySelector('[data-view-name="feed-commentary"] span[tabindex="-1"]') ||
                            postElement.querySelector('[data-testid="expandable-text-box"]');
      if (contentElement) {
        const contentHash = btoa(contentElement.textContent.substring(0, 50)).replace(/[^a-zA-Z0-9]/g, '');
        return `post-${rect.top}-${contentHash}`;
      }
    }
    
    // Last resort: use a combination of element attributes
    const classList = Array.from(postElement.classList).join('-');
    const position = Array.from(postElement.parentElement?.children || []).indexOf(postElement);
    return `fallback-${classList}-${position}`;
  }

  async getLinkedInContent(postElement) {
    // First, try to expand any "Show more" content
    await this.expandLinkedInContent(postElement);
    
    // Try different selectors for LinkedIn post content - updated for current interface
    const contentSelectors = [
      '[data-view-name="feed-commentary"] span[tabindex="-1"]',
      '[data-testid="expandable-text-box"]',
      '.feed-shared-update-v2__description .break-words',
      '.feed-shared-text',
      '.feed-shared-inline-show-more-text',
      '.attributed-text-segment-list__content',
      '[data-test-id="main-feed-activity-card"] .break-words',
      '.feed-shared-update-v2__commentary .break-words',
      // More generic selectors for content
      '.break-words',
      '[dir="ltr"]',
      'span[lang]',
      'div[lang]'
    ];
    
    for (const selector of contentSelectors) {
      const contentElement = postElement.querySelector(selector);
      if (contentElement && contentElement.textContent.trim()) {
        const text = contentElement.textContent.trim();
        // Make sure it's substantial content (not just metadata)
        if (text.length > 20 && !text.match(/^\d+\s*(hour|day|week|month)s?\s*ago$/i)) {
          return text;
        }
      }
    }
    
    // Fallback: look for any substantial text content in the post
    const allTextElements = postElement.querySelectorAll('span, div, p');
    for (const element of allTextElements) {
      const text = element.textContent.trim();
      if (text.length > 30 && text.length < 3000) {
        // Skip if it's just timestamp or engagement metrics
        if (!text.match(/^\d+\s*(hour|day|week|month)s?\s*ago$/i) &&
            !text.match(/^\d+\s*(reaction|like|comment|share)s?$/i) &&
            !text.includes('•') && 
            text.split(' ').length > 5) {
          return text;
        }
      }
    }
    
    return null;
  }

  async expandLinkedInContent(postElement) {
    // Look for "Show more" or "see more" buttons in LinkedIn posts
    const showMoreSelectors = [
      '[aria-label*="see more"]',
      '[aria-label*="Show more"]', 
      'button[aria-expanded="false"]',
      '.feed-shared-inline-show-more-text__see-more-less-toggle',
      '.feed-shared-text__see-more',
      'button',
      'span'
    ];

    for (const selector of showMoreSelectors) {
      const elements = postElement.querySelectorAll(selector);
      for (const element of elements) {
        const text = element.textContent.toLowerCase();
        if (text.includes('more') || text.includes('see more') || text.includes('show more')) {
          try {
            console.log('Social Media Note Saver: Found "Show more" button, clicking to expand content');
            element.click();
            
            // Wait a moment for content to expand
            await new Promise(resolve => setTimeout(resolve, 500));
            return; // Exit after first successful click
          } catch (error) {
            console.log('Social Media Note Saver: Failed to click show more button:', error);
          }
        }
      }
    }

    // Also try to find and click any expandable text elements
    const expandableElements = postElement.querySelectorAll('[data-testid="expandable-text-box"]');
    for (const element of expandableElements) {
      if (element.textContent.includes('…') || element.textContent.includes('...')) {
        try {
          // Look for a clickable parent or the element itself
          const clickableElement = element.closest('button') || element.closest('[role="button"]') || element;
          if (clickableElement && clickableElement.click) {
            console.log('Social Media Note Saver: Found expandable text, clicking to expand');
            clickableElement.click();
            await new Promise(resolve => setTimeout(resolve, 500));
            return; // Exit after first successful click
          }
        } catch (error) {
          console.log('Social Media Note Saver: Failed to expand text:', error);
        }
      }
    }

    // Try a more specific approach - look for spans with "...more" text pattern
    const allSpans = postElement.querySelectorAll('span');
    for (const span of allSpans) {
      const text = span.textContent.trim();
      if (text.match(/\.{3,}.*more/i) || text.match(/….*more/i)) {
        try {
          // The span itself might be clickable, or look for a clickable parent
          const clickableElement = span.closest('button') || span.closest('[role="button"]') || span;
          if (clickableElement && typeof clickableElement.click === 'function') {
            console.log('Social Media Note Saver: Found "...more" text, clicking to expand');
            clickableElement.click();
            await new Promise(resolve => setTimeout(resolve, 500));
            return;
          }
        } catch (error) {
          console.log('Social Media Note Saver: Failed to click expand element:', error);
        }
      }
    }
  }

  getLinkedInAuthor(postElement) {
    // Try different selectors for LinkedIn author - updated for current interface
    const authorSelectors = [
      'a[href*="/in/"] strong',
      '[data-view-name="feed-header-text"] strong',
      '.feed-shared-actor__name',
      '.update-components-actor__name',
      '.feed-shared-actor__title',
      '[data-control-name="actor_name"]',
      '.feed-shared-update-v2__actor-name'
    ];
    
    for (const selector of authorSelectors) {
      const authorElement = postElement.querySelector(selector);
      if (authorElement) {
        const text = authorElement.textContent.trim();
        if (text) return text;
      }
    }
    
    // Try to get from link
    const actorLink = postElement.querySelector('a[href*="/in/"]');
    if (actorLink) {
      const text = actorLink.textContent.trim();
      if (text && !text.includes('LinkedIn')) return text;
    }
    
    return 'Unknown';
  }

  getLinkedInHandle(postElement) {
    // LinkedIn uses profile URLs instead of handles - updated selectors
    const profileSelectors = [
      '[data-view-name="feed-header-text"] a[href*="/in/"]',
      '[data-view-name="feed-actor-image"] a[href*="/in/"]',
      'a[href*="/in/"]',
      '.feed-shared-actor__meta a',
      '.update-components-actor__meta a'
    ];
    
    for (const selector of profileSelectors) {
      const linkElement = postElement.querySelector(selector);
      if (linkElement) {
        const href = linkElement.getAttribute('href');
        if (href && href.includes('/in/')) {
          const match = href.match(/\/in\/([^\/\?]+)/);
          if (match) return `/in/${match[1]}`;
        }
      }
    }
    
    return '/in/unknown';
  }

  getLinkedInUrl(postElement) {
    // Try to find post permalink
    const permalinkSelectors = [
      'a[href*="/posts/"]',
      '[data-control-name="overlay"] a',
      '.feed-shared-control-menu__trigger'
    ];
    
    for (const selector of permalinkSelectors) {
      const linkElement = postElement.querySelector(selector);
      if (linkElement) {
        const href = linkElement.getAttribute('href');
        if (href && href.includes('/posts/')) {
          if (href.startsWith('/')) {
            return window.location.origin + href;
          }
          return href;
        }
      }
    }
    
    return window.location.href;
  }

  getLinkedInTimestamp(postElement) {
    // Try to find timestamp - updated for current interface
    const timeSelectors = [
      'time',
      '[data-live-timestamp]',
      '.feed-shared-actor__sub-description time',
      '.update-components-actor__sub-description time'
    ];
    
    // Also look for relative timestamps in text (e.g., "4d •")
    const relativeTimeElements = postElement.querySelectorAll('p');
    for (const element of relativeTimeElements) {
      const text = element.textContent.trim();
      const timeMatch = text.match(/^(\d+[dhwmy])\s*•/);
      if (timeMatch) {
        // Convert relative time to approximate timestamp
        const value = parseInt(timeMatch[1]);
        const unit = timeMatch[1].slice(-1);
        let milliseconds = 0;
        
        switch (unit) {
          case 'm': milliseconds = value * 60 * 1000; break;
          case 'h': milliseconds = value * 60 * 60 * 1000; break;
          case 'd': milliseconds = value * 24 * 60 * 60 * 1000; break;
          case 'w': milliseconds = value * 7 * 24 * 60 * 60 * 1000; break;
          case 'y': milliseconds = value * 365 * 24 * 60 * 60 * 1000; break;
        }
        
        const estimatedTime = new Date(Date.now() - milliseconds);
        return estimatedTime.toISOString();
      }
    }
    
    for (const selector of timeSelectors) {
      const timeElement = postElement.querySelector(selector);
      if (timeElement) {
        const datetime = timeElement.getAttribute('datetime') || 
                        timeElement.getAttribute('data-live-timestamp');
        if (datetime) {
          return new Date(parseInt(datetime) || datetime).toISOString();
        }
      }
    }
    
    return new Date().toISOString();
  }

  getLinkedInShareInfo(postElement) {
    // Check if this is a shared/reposted content - updated for current interface
    const shareIndicators = [
      '[data-view-name="feed-header-text"]',
      '.feed-shared-header__text-info',
      '.update-components-header__text-view',
      '[data-control-name="reshare_context"]'
    ];
    
    // Check for "celebrates this" pattern in header
    const headerElement = postElement.querySelector('[data-view-name="feed-header-text"]');
    if (headerElement) {
      const text = headerElement.textContent.trim();
      if (text.includes('celebrates this')) {
        const match = text.match(/(.+?)\s+celebrates this/i);
        if (match) {
          return {
            isShare: true,
            sharedBy: match[1].trim(),
            shareContext: text
          };
        }
      }
    }
    
    for (const selector of shareIndicators) {
      const element = postElement.querySelector(selector);
      if (element) {
        const text = element.textContent.trim();
        if (text.includes('reposted') || text.includes('shared') || 
            text.includes('Reposted') || text.includes('Shared')) {
          // Try to extract who shared
          const match = text.match(/(.+?)\s+(reposted|shared)/i);
          if (match) {
            return {
              isShare: true,
              sharedBy: match[1].trim(),
              shareContext: text
            };
          }
          return {
            isShare: true,
            sharedBy: 'Someone',
            shareContext: text
          };
        }
      }
    }
    
    // Check for repost indicator in header
    const repostHeader = postElement.querySelector('.feed-shared-actor__description');
    if (repostHeader && repostHeader.textContent.includes('reposted')) {
      return {
        isShare: true,
        sharedBy: 'Someone',
        shareContext: repostHeader.textContent.trim()
      };
    }
    
    return { isShare: false };
  }

  getLinkedInMetrics(postElement) {
    // Get engagement metrics if visible - updated for current interface
    const metrics = {};
    
    // Look for reaction count in the new interface
    const reactionCount = postElement.querySelector('[data-view-name="feed-reaction-count"] p');
    if (reactionCount) {
      const text = reactionCount.textContent.trim();
      const match = text.match(/(\d+)/);
      if (match) {
        metrics.reactions = match[1];
      }
    }
    
    // Look for repost count
    const repostCount = postElement.querySelector('[data-view-name="feed-repost-count"] p');
    if (repostCount) {
      const text = repostCount.textContent.trim();
      const match = text.match(/(\d+)/);
      if (match) {
        metrics.reposts = match[1];
      }
    }
    
    // Try legacy selectors as fallback
    const socialCounts = postElement.querySelector('.social-counts-reactions');
    if (socialCounts) {
      const reactionsText = socialCounts.textContent.trim();
      if (reactionsText) {
        metrics.reactions = reactionsText;
      }
    }
    
    // Try to get comment count
    const commentButton = postElement.querySelector('[data-control-name="comment"]');
    if (commentButton) {
      const commentText = commentButton.textContent.trim();
      const match = commentText.match(/(\d+)/);
      if (match) {
        metrics.comments = match[1];
      }
    }
    
    // Try to get share count
    const shareButton = postElement.querySelector('[data-control-name="share"]');
    if (shareButton) {
      const shareText = shareButton.textContent.trim();
      const match = shareText.match(/(\d+)/);
      if (match) {
        metrics.shares = match[1];
      }
    }
    
    return metrics;
  }

  // YouTube-specific implementations
  findYouTubeVideos() {
    console.log('Social Media Note Saver: Looking for YouTube videos...');
    
    // Only process if we're on a video or live stream page
    if (!window.location.pathname.includes('/watch') && !window.location.pathname.includes('/live/')) {
      console.log('Social Media Note Saver: Not on a video or live stream page');
      return [];
    }
    
    // Look for the main video player
    const videoElement = document.querySelector('#movie_player, #player, .html5-video-player');
    if (!videoElement) {
      console.log('Social Media Note Saver: No video player found');
      return [];
    }
    
    // Return the video container for button placement
    const videoContainer = document.querySelector('#primary, #watch7-content, #content');
    return videoContainer ? [videoContainer] : [];
  }

  async getYouTubeTranscript() {
    console.log('Social Media Note Saver: Attempting to extract YouTube transcript...');

    try {
      // First, try to find and click the transcript button to open it
      const transcriptButton = await this.findAndClickTranscriptButton();
      if (!transcriptButton) {
        throw new Error('Could not find transcript button - transcript may not be available');
      }

      // Wait 5 seconds for transcript panel to load
      console.log('Social Media Note Saver: Waiting 5 seconds for transcript to load...');
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Extract transcript segments
      const transcriptSegments = await this.extractTranscriptSegments();
      if (!transcriptSegments || transcriptSegments.length === 0) {
        throw new Error('No transcript segments found');
      }

      // Join segments with spaces for natural flow, clean up extra whitespace
      return transcriptSegments
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();

    } catch (error) {
      console.error('Social Media Note Saver: Transcript extraction failed:', error);
      throw error;
    }
  }

  async findAndClickTranscriptButton() {
    // Look for transcript button in various locations
    const transcriptSelectors = [
      'button[aria-label*="transcript" i]',
      'button[aria-label*="Show transcript" i]',
      'yt-button-renderer:has([aria-label*="transcript" i])',
      '[role="button"]:has-text("Show transcript")',
      'ytd-engagement-panel-title-header-renderer:has-text("Transcript")',
      '#description button:has-text("Show transcript")',
      'button:has-text("Show transcript")'
    ];

    for (const selector of transcriptSelectors) {
      try {
        // Handle special :has-text selector
        if (selector.includes(':has-text')) {
          const elements = document.querySelectorAll(selector.split(':has-text')[0]);
          for (const element of elements) {
            const searchText = selector.match(/\("([^"]+)"\)/)?.[1];
            if (element.textContent.toLowerCase().includes(searchText?.toLowerCase())) {
              console.log('Social Media Note Saver: Found transcript button via text search');
              element.click();
              return element;
            }
          }
        } else {
          const button = document.querySelector(selector);
          if (button) {
            console.log('Social Media Note Saver: Found transcript button:', selector);
            button.click();
            return button;
          }
        }
      } catch (error) {
        console.log('Social Media Note Saver: Error with selector', selector, error);
      }
    }

    // Try looking in description expand area
    const showMoreButton = document.querySelector('#description button[aria-label*="more" i], #expand');
    if (showMoreButton) {
      console.log('Social Media Note Saver: Expanding description to look for transcript');
      showMoreButton.click();
      await new Promise(resolve => setTimeout(resolve, 500));

      // Try transcript selectors again
      for (const selector of transcriptSelectors) {
        const button = document.querySelector(selector);
        if (button) {
          console.log('Social Media Note Saver: Found transcript button after expanding description');
          button.click();
          return button;
        }
      }
    }

    return null;
  }

  async extractTranscriptSegments() {
    // Wait a bit longer for transcript panel to fully load
    await new Promise(resolve => setTimeout(resolve, 1000));

    let segments = [];

    // Try to get transcript segment text elements directly (avoiding timestamps)
    const segmentTextElements = document.querySelectorAll('ytd-transcript-segment-renderer .segment-text');
    console.log(`Social Media Note Saver: Found ${segmentTextElements.length} segment-text elements`);

    if (segmentTextElements.length > 0) {
      for (const element of segmentTextElements) {
        const text = element.textContent?.trim();
        if (text && text.length > 0) {
          segments.push(text);
        }
      }
    }

    // Fallback: try other selectors if direct approach didn't work
    if (segments.length === 0) {
      const segmentSelectors = [
        'ytd-transcript-segment-renderer',
        '.ytd-transcript-segment-renderer',
        '.transcript-segment',
        'cue'
      ];

      for (const selector of segmentSelectors) {
        const elements = document.querySelectorAll(selector);
        console.log(`Social Media Note Saver: Found ${elements.length} segments with selector: ${selector}`);

        if (elements.length > 0) {
          for (const element of elements) {
            // Skip timestamp elements, only get text
            const textElement = element.querySelector('.segment-text') ||
                               element.querySelector('[class*="cue-text"]') ||
                               element.querySelector('yt-formatted-string:not(.segment-timestamp)');

            if (textElement) {
              const text = textElement.textContent?.trim();
              // Filter out timestamp patterns (e.g., "0:00", "12:34")
              if (text && text.length > 0 && !/^\d+:\d+$/.test(text)) {
                segments.push(text);
              }
            }
          }

          if (segments.length > 0) {
            break;
          }
        }
      }
    }

    // If no structured segments found, try to get all text from transcript area
    if (segments.length === 0) {
      const transcriptAreas = [
        'ytd-transcript-renderer',
        '#transcript',
        '[aria-label*="transcript" i]',
        '.transcript-content'
      ];

      for (const selector of transcriptAreas) {
        const area = document.querySelector(selector);
        if (area) {
          const text = area.textContent?.trim();
          if (text && text.length > 0) {
            console.log('Social Media Note Saver: Extracted transcript from area:', selector);
            segments = [text];
            break;
          }
        }
      }
    }

    return segments;
  }

  getYouTubeVideoInfo() {
    const videoTitle = document.querySelector('#title h1, .title, .watch-main-col .watch-title')?.textContent?.trim() || 'Unknown Title';
    const channelName = document.querySelector('#channel-name, .ytd-channel-name, .watch-info-content .g-hovercard')?.textContent?.trim() || 'Unknown Channel';
    const videoUrl = window.location.href.split('&')[0]; // Remove extra parameters
    
    // Handle both regular videos (/watch?v=) and live streams (/live/)
    let videoId = new URLSearchParams(window.location.search).get('v');
    if (!videoId && window.location.pathname.includes('/live/')) {
      // Extract video ID from live stream URL: /live/VIDEO_ID
      videoId = window.location.pathname.split('/live/')[1];
    }
    
    return {
      title: videoTitle,
      channel: channelName,
      url: videoUrl,
      videoId: videoId,
      platform: 'youtube'
    };
  }

  getYouTubeId(postElement) {
    // Handle both regular videos (/watch?v=) and live streams (/live/)
    let videoId = new URLSearchParams(window.location.search).get('v');
    if (!videoId && window.location.pathname.includes('/live/')) {
      // Extract video ID from live stream URL: /live/VIDEO_ID
      videoId = window.location.pathname.split('/live/')[1];
    }
    // Always use the video ID if available, or fallback to a static ID for the current page
    return videoId || `youtube-${window.location.pathname}`;
  }

  // Channel import functionality
  async scrapeChannelVideos(limit = 20) {
    console.log('Social Media Note Saver: Scraping channel videos, limit:', limit);

    // Wait for page to load
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Scroll to load more videos
    console.log('Social Media Note Saver: Scrolling to load videos...');
    for (let i = 0; i < 3; i++) {
      window.scrollTo(0, document.body.scrollHeight);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Find all video links on the page
    const videoLinks = document.querySelectorAll('a[href*="/watch?v="]');
    console.log('Social Media Note Saver: Found', videoLinks.length, 'video links');

    const videos = [];
    const seenVideoIds = new Set();

    for (const link of videoLinks) {
      const href = link.getAttribute('href');

      // Filter out shorts
      if (href.includes('/shorts/')) {
        continue;
      }

      // Extract video ID
      const match = href.match(/[?&]v=([^&]+)/);
      if (!match) continue;

      const videoId = match[1];

      // Skip duplicates
      if (seenVideoIds.has(videoId)) continue;
      seenVideoIds.add(videoId);

      // Extract title (try different selectors)
      let title = 'Unknown Title';
      const titleElement = link.querySelector('#video-title, .ytd-video-renderer #video-title');
      if (titleElement) {
        title = titleElement.getAttribute('title') || titleElement.textContent.trim();
      }

      videos.push({
        url: `https://www.youtube.com/watch?v=${videoId}`,
        videoId: videoId,
        title: title
      });

      // Stop if we've hit the limit
      if (videos.length >= limit) {
        break;
      }
    }

    console.log('Social Media Note Saver: Scraped', videos.length, 'videos (limit:', limit, ')');
    return videos;
  }

  async extractAndSaveTranscript() {
    console.log('Social Media Note Saver: Extracting and saving transcript...');

    try {
      // Get video info
      const videoInfo = this.getYouTubeVideoInfo();
      const videoId = videoInfo.videoId;

      if (!videoId) {
        throw new Error('Could not determine video ID');
      }

      // Extract transcript
      console.log('Social Media Note Saver: Extracting transcript for:', videoInfo.title);
      const transcript = await this.getYouTubeTranscript();

      if (!transcript || transcript.length === 0) {
        throw new Error('No transcript available for this video');
      }

      // Build payload
      const postData = {
        content: transcript,
        author: videoInfo.channel,
        handle: `@${videoInfo.channel}`,
        url: videoInfo.url,
        timestamp: new Date().toISOString(),
        platform: 'youtube',
        isShare: false,
        sharedBy: '',
        shareContext: '',
        metrics: {}
      };

      const payload = this.buildPayload(postData);

      // Send to API
      console.log('Social Media Note Saver: Sending to API...');
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

      console.log('Social Media Note Saver: Successfully saved transcript for:', videoInfo.title);
      return {
        success: true,
        videoId: videoId,
        title: videoInfo.title
      };

    } catch (error) {
      console.error('Social Media Note Saver: Failed to extract/save transcript:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Twitter-specific implementations below
  getTwitterId(tweetElement) {
    // Try to get a unique identifier for the tweet
    const link = tweetElement.querySelector('a[href*="/status/"]');
    if (link) {
      const href = link.getAttribute('href');
      const match = href.match(/\/status\/(\d+)/);
      if (match) return match[1];
    }
    
    // Fallback to element's position and content
    const content = this.getTwitterContent(tweetElement);
    return content ? btoa(content.substring(0, 50)) : Math.random().toString();
  }

  getTwitterContent(tweetElement) {
    // Try different selectors for tweet text
    const textSelectors = [
      '[data-testid="tweetText"]',
      '.tweet-text',
      '.TweetTextSize',
      '[lang]'
    ];
    
    for (const selector of textSelectors) {
      const textElement = tweetElement.querySelector(selector);
      if (textElement && textElement.textContent.trim()) {
        return textElement.textContent.trim();
      }
    }
    
    return null;
  }

  getTwitterAuthor(tweetElement) {
    // Try different selectors for author
    const authorSelectors = [
      '[data-testid="User-Name"] [dir="ltr"]',
      '[data-testid="User-Name"]',
      '.username',
      '.u-linkComplex-target',
      'a[role="link"][href^="/"]'
    ];
    
    for (const selector of authorSelectors) {
      const authorElement = tweetElement.querySelector(selector);
      if (authorElement) {
        const text = authorElement.textContent.trim();
        if (text && !text.includes('·') && !text.includes('•') && !text.includes('@')) {
          return text;
        }
      }
    }
    
    // Fallback: try to get from URL
    const link = tweetElement.querySelector('a[href*="/status/"]');
    if (link) {
      const href = link.getAttribute('href');
      const match = href.match(/\/([^\/]+)\/status/);
      if (match) return match[1];
    }
    
    return 'Unknown';
  }

  getTwitterHandle(tweetElement) {
    // Get the @handle
    const handleSelectors = [
      '[data-testid="User-Name"] [dir="ltr"]:nth-child(2)',
      '[data-testid="User-Name"] span'
    ];
    
    for (const selector of handleSelectors) {
      const elements = tweetElement.querySelectorAll(selector);
      for (const element of elements) {
        const text = element.textContent.trim();
        if (text.startsWith('@')) {
          return text;
        }
      }
    }
    
    // Try to find any span with @username pattern
    const spans = tweetElement.querySelectorAll('span');
    for (const span of spans) {
      const text = span.textContent.trim();
      if (text.startsWith('@') && text.length > 1 && !text.includes(' ')) {
        return text;
      }
    }
    
    // Fallback: try to get from URL  
    const link = tweetElement.querySelector('a[href*="/status/"]');
    if (link) {
      const href = link.getAttribute('href');
      const match = href.match(/\/([^\/]+)\/status/);
      if (match) return '@' + match[1];
    }
    
    return '@unknown';
  }

  getTwitterRetweetInfo(tweetElement) {
    // Check if this is a retweet
    const retweetIndicators = [
      '[data-testid="socialContext"]',
      '[aria-label*="retweeted"]',
      'span'
    ];
    
    for (const selector of retweetIndicators) {
      const elements = tweetElement.querySelectorAll(selector);
      for (const element of elements) {
        const text = element.textContent.trim();
        if (text.includes('retweeted') || text.includes('Retweeted')) {
          // Try to extract who retweeted
          const match = text.match(/(.+?)\s+retweeted/i);
          if (match) {
            return {
              isShare: true,
              sharedBy: match[1].trim(),
              shareContext: text
            };
          }
          return {
            isShare: true,
            sharedBy: 'Someone',
            shareContext: text
          };
        }
      }
    }
    
    // Alternative approach: look for retweet icon
    const retweetIcon = tweetElement.querySelector('[data-testid="retweet"]');
    if (retweetIcon && retweetIcon.closest('[role="group"]')) {
      const parentElement = retweetIcon.closest('article') || tweetElement;
      const socialContext = parentElement.querySelector('[data-testid="socialContext"]');
      if (socialContext) {
        return {
          isShare: true,
          sharedBy: 'Someone',
          shareContext: socialContext.textContent.trim()
        };
      }
    }
    
    return { isShare: false };
  }

  getTwitterMetrics(tweetElement) {
    // Get engagement metrics if visible
    const metrics = {};
    
    const metricsSelectors = [
      '[data-testid="reply"]',
      '[data-testid="retweet"]', 
      '[data-testid="like"]',
      '[data-testid="bookmark"]'
    ];
    
    metricsSelectors.forEach(selector => {
      const element = tweetElement.querySelector(selector);
      if (element) {
        const span = element.querySelector('span[data-testid]');
        if (span && span.textContent.trim()) {
          const type = selector.replace('[data-testid="', '').replace('"]', '');
          metrics[type] = span.textContent.trim();
        }
      }
    });
    
    return metrics;
  }

  getTwitterUrl(tweetElement) {
    const link = tweetElement.querySelector('a[href*="/status/"]');
    if (link) {
      const href = link.getAttribute('href');
      if (href.startsWith('/')) {
        return window.location.origin + href;
      }
      return href;
    }
    return window.location.href;
  }

  getTwitterTimestamp(tweetElement) {
    // Try to find timestamp
    const timeSelectors = [
      'time',
      '[datetime]',
      '.tweet-timestamp',
      '[data-testid="Time"]'
    ];
    
    for (const selector of timeSelectors) {
      const timeElement = tweetElement.querySelector(selector);
      if (timeElement) {
        const datetime = timeElement.getAttribute('datetime') || timeElement.getAttribute('title');
        if (datetime) {
          return new Date(datetime).toISOString();
        }
      }
    }
    
    return new Date().toISOString();
  }

  addSaveButton(postElement) {
    const postId = this.getPostId(postElement);
    
    if (this.processedPosts.has(postId)) {
      console.log('Social Media Note Saver: Post already processed, skipping:', postId);
      return;
    }
    
    // For YouTube, check for existing buttons more broadly since the postElement might be the entire page
    if (this.platform === 'youtube') {
      const existingButtons = document.querySelectorAll('.social-save-btn[data-platform="youtube"]');
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
    
    // Find a good place to insert the button
    const actionBar = this.findActionBar(postElement);
    if (!actionBar) {
      console.log('Social Media Note Saver: Could not find action bar for post');
      return;
    }
    
    console.log('Social Media Note Saver: Adding save button to post:', postId);
    
    // Create save button
    const saveButton = this.createSaveButton(postElement);
    
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

  findActionBar(postElement) {
    // Platform-specific action bar finding
    if (this.platform === 'twitter') {
      return this.findTwitterActionBar(postElement);
    }
    if (this.platform === 'linkedin') {
      return this.findLinkedInActionBar(postElement);
    }
    if (this.platform === 'youtube') {
      return this.findYouTubeActionBar(postElement);
    }
    
    // Generic fallback
    const container = document.createElement('div');
    container.className = 'social-saver-actions';
    postElement.appendChild(container);
    return container;
  }

  findYouTubeActionBar(postElement) {
    // Skip the touch feedback approach - it's finding navigation buttons instead of video actions
    // Focus on finding the actual video action buttons first
    
    // Try to find YouTube action bar (like, dislike, share, etc.) - video specific
    const actionSelectors = [
      '#top-level-buttons',
      '#actions',
      '.ytd-menu-renderer',
      '#menu-container',
      '#info-contents',
      '.ytd-video-primary-info-renderer',
      '.ytd-video-primary-info-renderer #actions',
      '.ytd-watch-flexy #actions'
    ];
    
    for (const selector of actionSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        // Make sure this is in the video area, not header/navigation
        const isInVideoArea = element.closest('#primary, .ytd-watch-flexy, #watch7-content');
        if (isInVideoArea) {
          console.log('Social Media Note Saver: Found YouTube video action area:', selector);
          return element;
        } else {
          console.log('Social Media Note Saver: Skipping element not in video area:', selector);
        }
      }
    }
    
    // Look for video action buttons specifically (not navigation buttons)
    const videoActionButtons = document.querySelectorAll('#primary button[aria-label*="like"], #primary button[aria-label*="Share"], .ytd-watch-flexy button[aria-label*="like"]');
    console.log('Social Media Note Saver: Found video action buttons:', videoActionButtons.length);
    
    if (videoActionButtons.length > 0) {
      for (const button of videoActionButtons) {
        console.log('Social Media Note Saver: Checking video action button:', button.getAttribute('aria-label'));
        let container = button.parentElement;
        let attempts = 0;
        
        // Walk up to find the container with multiple buttons
        while (container && attempts < 5) {
          const buttonCount = container.querySelectorAll('button').length;
          console.log('Social Media Note Saver: Container buttons:', buttonCount, container);
          
          if (buttonCount >= 2) {
            // Make sure it's in the video area
            const isInVideoArea = container.closest('#primary, .ytd-watch-flexy');
            if (isInVideoArea) {
              console.log('Social Media Note Saver: Found video action container via buttons:', container);
              return container;
            }
          }
          container = container.parentElement;
          attempts++;
        }
      }
    }
    
    // Fallback: create container under video info
    const videoInfo = document.querySelector('#info, #meta-contents, #primary-inner');
    if (videoInfo) {
      const container = document.createElement('div');
      container.className = 'social-saver-actions';
      container.style.cssText = `
        display: flex !important;
        align-items: center !important;
        gap: 8px !important;
        margin: 12px 0 !important;
        padding: 8px 0 !important;
        border-top: 1px solid #e0e0e0 !important;
      `;
      videoInfo.appendChild(container);
      return container;
    }
    
    // Last resort: append to primary area
    const primary = document.querySelector('#primary');
    if (primary) {
      const container = document.createElement('div');
      container.className = 'social-saver-actions';
      container.style.cssText = `
        display: flex !important;
        align-items: center !important;
        gap: 8px !important;
        margin: 12px 0 !important;
        padding: 8px 12px !important;
        background: #f9f9f9 !important;
        border-radius: 8px !important;
      `;
      primary.appendChild(container);
      return container;
    }
    
    return null;
  }

  findTwitterActionBar(postElement) {
    // Try to find the Twitter action bar (like, retweet, share buttons)
    const actionSelectors = [
      '[role="group"]',
      '.tweet-actions',
      '[data-testid="reply"]',
      '[data-testid="retweet"]'
    ];
    
    for (const selector of actionSelectors) {
      const element = postElement.querySelector(selector);
      if (element) {
        // If we found a specific action, get its parent container
        if (selector.includes('data-testid')) {
          return element.closest('[role="group"]') || element.parentElement;
        }
        return element;
      }
    }
    
    // Fallback: create our own action container
    const container = document.createElement('div');
    container.className = 'social-saver-actions';
    postElement.appendChild(container);
    return container;
  }

  findLinkedInActionBar(postElement) {
    // Try to find the container that holds all the action buttons
    const actionBarSelectors = [
      // Look for the container that holds all action buttons
      '[data-view-name="reaction-button"]',
      '[data-view-name="feed-comment-button"]',
      '[data-view-name="feed-share-button"]',
      '[data-view-name="feed-send-as-message-button"]'
    ];
    
    // Find any action button and get its parent container
    for (const selector of actionBarSelectors) {
      const actionButton = postElement.querySelector(selector);
      if (actionButton) {
        // Walk up the DOM to find the container that holds all action buttons
        let container = actionButton.parentElement;
        let attempts = 0;
        
        while (container && attempts < 5) {
          // Check if this container has multiple action buttons (Like, Comment, Share, Send)
          const buttonCount = container.querySelectorAll('button').length;
          if (buttonCount >= 3) { // Should have at least Like, Comment, Share buttons
            console.log('Social Media Note Saver: Found action bar container with', buttonCount, 'buttons');
            return container;
          }
          container = container.parentElement;
          attempts++;
        }
        
        // If we can't find the main container, use the parent of the first button
        return actionButton.parentElement;
      }
    }
    
    // Legacy fallback selectors
    const legacySelectors = [
      '.feed-shared-social-action-bar',
      '.social-actions-v2',
      '[data-control-name="like"]',
      '[data-control-name="comment"]'
    ];
    
    for (const selector of legacySelectors) {
      const element = postElement.querySelector(selector);
      if (element) {
        if (selector.includes('data-control-name')) {
          return element.closest('.feed-shared-social-action-bar') || 
                 element.closest('.social-actions-v2') || 
                 element.parentElement;
        }
        return element;
      }
    }
    
    // Fallback: create our own action container
    const container = document.createElement('div');
    container.className = 'social-saver-actions';
    container.style.cssText = `
      display: flex !important;
      align-items: center !important;
      gap: 8px !important;
      margin-top: 8px !important;
      padding: 0 16px !important;
    `;
    postElement.appendChild(container);
    return container;
  }

  createSaveButton(postElement) {
    const button = document.createElement('button');
    button.className = 'social-save-btn';
    button.setAttribute('data-platform', this.platform);
    
    // Blue button without icon - platform-specific text
    if (this.platform === 'youtube') {
      button.innerHTML = `<span>Save Transcript</span>`;
    } else {
      button.innerHTML = `<span>Save</span>`;
    }
    
    // Add blue styling with isolation - YouTube gets special styling
    if (this.platform === 'youtube') {
      button.style.cssText = `
        background-color: #1976d2 !important;
        color: white !important;
        border: none !important;
        border-radius: 18px !important;
        padding: 10px 16px !important;
        font-size: 14px !important;
        font-weight: 500 !important;
        cursor: pointer !important;
        margin-left: 8px !important;
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        height: 36px !important;
        min-width: 120px !important;
        transition: background-color 0.2s ease !important;
        position: relative !important;
        z-index: 1000 !important;
        isolation: isolate !important;
        pointer-events: auto !important;
        font-family: 'YouTube Sans', 'Roboto', sans-serif !important;
        box-shadow: 0 1px 2px rgba(0,0,0,0.1) !important;
      `;
    } else {
      button.style.cssText = `
        background-color: #0a66c2 !important;
        color: white !important;
        border: none !important;
        border-radius: 16px !important;
        padding: 8px 16px !important;
        font-size: 14px !important;
        font-weight: 600 !important;
        cursor: pointer !important;
        margin-left: 8px !important;
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        height: 32px !important;
        min-width: 64px !important;
        transition: background-color 0.2s ease !important;
        position: relative !important;
        z-index: 1000 !important;
        isolation: isolate !important;
        pointer-events: auto !important;
      `;
    }
    
    // Hover effect - platform specific
    if (this.platform === 'youtube') {
      button.addEventListener('mouseenter', () => {
        button.style.backgroundColor = '#1565c0 !important';
      });
      
      button.addEventListener('mouseleave', () => {
        button.style.backgroundColor = '#1976d2 !important';
      });
    } else {
      button.addEventListener('mouseenter', () => {
        button.style.backgroundColor = '#084d95 !important';
      });
      
      button.addEventListener('mouseleave', () => {
        button.style.backgroundColor = '#0a66c2 !important';
      });
    }
    
    button.title = 'Save post to notes';
    
    button.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      await this.savePost(postElement, button);
    });
    
    return button;
  }

  async savePost(postElement, button) {
    const originalContent = button.innerHTML;
    
    try {
      // Show loading state
      button.innerHTML = `<span>Saving...</span>`;
      button.style.backgroundColor = '#666666 !important';
      button.disabled = true;
      
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
      
      // Show success
      button.innerHTML = `<span>Saved!</span>`;
      button.style.setProperty('background-color', '#057642', 'important');
      button.style.setProperty('border-color', '#057642', 'important');
      button.classList.add('success');
      
      // Reset after 2 seconds
      setTimeout(() => {
        button.innerHTML = originalContent;
        button.disabled = false;
        const originalColor = this.platform === 'youtube' ? '#1976d2' : '#0a66c2';
        button.style.setProperty('background-color', originalColor, 'important');
        button.style.setProperty('border-color', originalColor, 'important');
        button.classList.remove('success');
      }, 2000);
      
    } catch (error) {
      console.error('Social Media Note Saver: Save failed', error);
      
      // Show error
      button.innerHTML = `<span>Error</span>`;
      button.style.backgroundColor = '#cc1016 !important';
      button.classList.add('error');
      button.title = `Save failed: ${error.message}`;
      
      // Reset after 3 seconds
      setTimeout(() => {
        button.innerHTML = originalContent;
        button.disabled = false;
        button.style.backgroundColor = this.platform === 'youtube' ? '#1976d2 !important' : '#0a66c2 !important';
        button.classList.remove('error');
        button.title = 'Save post to notes';
      }, 3000);
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
/**
 * LinkedInHandler - Platform handler for LinkedIn
 *
 * Handles post detection, content extraction, and metadata retrieval for LinkedIn.
 * Extends BasePlatformHandler to implement platform-specific logic.
 *
 * Note: LinkedIn's DOM selectors are particularly fragile and change frequently.
 */

import { BasePlatformHandler } from './base-platform-handler.js';
import { LINKEDIN_SELECTORS } from '../constants/selectors.js';
import { PATTERNS, CONTENT_LIMITS } from '../constants/config.js';

class LinkedInHandler extends BasePlatformHandler {
  constructor(config) {
    super(config);
    this.platform = 'linkedin';
    this.processedPosts = new Set(); // Track processed posts for findPosts filtering
  }

  /**
   * Set processed posts tracker (needed for filtering in findPosts)
   * @param {Set} processedPosts - Set of processed post IDs
   */
  setProcessedPosts(processedPosts) {
    this.processedPosts = processedPosts;
  }

  /**
   * Find all LinkedIn post elements on the current page
   * @returns {Array<Element>} Array of post DOM elements
   */
  findPosts() {
    console.log('Social Media Note Saver: Looking for LinkedIn posts...');

    // Try specific selectors first - updated for current LinkedIn interface
    let posts = [];
    for (const selector of LINKEDIN_SELECTORS.posts) {
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
      posts = this.findPostsByContent();
    }

    console.log('Social Media Note Saver: Raw posts found:', posts.length);

    // Filter out already processed posts and ensure they have content
    const filteredPosts = posts.filter(post => {
      const postId = this.getPostId(post);
      if (this.processedPosts.has(postId)) {
        console.log('Social Media Note Saver: Post already processed:', postId);
        return false;
      }
      // Only process if it has actual post content (use sync check for filtering)
      const hasContent = this.hasContent(post, { minLength: 20, excludePattern: PATTERNS.timeAgo });
      console.log('Social Media Note Saver: Post has content:', hasContent, postId);
      return hasContent;
    });

    console.log('Social Media Note Saver: Filtered posts:', filteredPosts.length);
    return filteredPosts;
  }

  /**
   * Fallback method to find LinkedIn posts by content patterns
   * @returns {Array<Element>} Array of potential post elements
   */
  findPostsByContent() {
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

  /**
   * Extract unique identifier for a LinkedIn post
   * @param {Element} postElement - The post element
   * @returns {string} Unique post identifier
   */
  getPostId(postElement) {
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
    const contentElement = this.querySelector(postElement, LINKEDIN_SELECTORS.content);
    if (contentElement) {
      // Use the element's position in the document plus content hash
      const rect = postElement.getBoundingClientRect();
      const contentHash = btoa(contentElement.textContent.substring(0, 50)).replace(/[^a-zA-Z0-9]/g, '');
      return `post-${rect.top}-${contentHash}`;
    }

    // Last resort: use a combination of element attributes
    const classList = Array.from(postElement.classList).join('-');
    const position = Array.from(postElement.parentElement?.children || []).indexOf(postElement);
    return `fallback-${classList}-${position}`;
  }

  /**
   * Extract post content (async to handle expansion)
   * @param {Element} postElement - The post element
   * @returns {Promise<string|null>} Post content
   */
  async getPostContent(postElement) {
    // First, try to expand any "Show more" content
    await this.expandContent(postElement);

    // Try different selectors for LinkedIn post content - updated for current interface
    for (const selector of LINKEDIN_SELECTORS.content) {
      const contentElement = postElement.querySelector(selector);
      if (contentElement && contentElement.textContent.trim()) {
        const text = contentElement.textContent.trim();
        // Make sure it's substantial content (not just metadata)
        if (text.length > 20 && !text.match(PATTERNS.timeAgo)) {
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
        if (!text.match(PATTERNS.timeAgo) &&
            !text.match(PATTERNS.engagement) &&
            !text.includes('•') &&
            text.split(' ').length > 5) {
          return text;
        }
      }
    }

    return null;
  }

  /**
   * Expand collapsed LinkedIn content by clicking "Show more" buttons
   * @param {Element} postElement - The post element
   * @returns {Promise<void>}
   */
  async expandContent(postElement) {
    // Look for "Show more" or "see more" buttons in LinkedIn posts
    for (const selector of LINKEDIN_SELECTORS.expandButtons) {
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
    const expandableElements = postElement.querySelectorAll(LINKEDIN_SELECTORS.expandable);
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

  /**
   * Extract author name
   * @param {Element} postElement - The post element
   * @returns {string} Author name
   */
  getPostAuthor(postElement) {
    // Try different selectors for LinkedIn author - updated for current interface
    for (const selector of LINKEDIN_SELECTORS.author) {
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

  /**
   * Extract author handle (LinkedIn uses /in/username format)
   * @param {Element} postElement - The post element
   * @returns {string} Author handle
   */
  getPostHandle(postElement) {
    // LinkedIn uses profile URLs instead of handles - updated selectors
    for (const selector of LINKEDIN_SELECTORS.profile) {
      const linkElement = postElement.querySelector(selector);
      if (linkElement) {
        const href = linkElement.getAttribute('href');
        if (href && href.includes('/in/')) {
          const match = href.match(PATTERNS.linkedInProfile);
          if (match) return `/in/${match[1]}`;
        }
      }
    }

    return '/in/unknown';
  }

  /**
   * Extract direct URL to the post
   * @param {Element} postElement - The post element
   * @returns {string} Post URL
   */
  getPostUrl(postElement) {
    // Try to find post permalink
    for (const selector of LINKEDIN_SELECTORS.permalink) {
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

  /**
   * Extract or estimate post timestamp
   * @param {Element} postElement - The post element
   * @returns {string} ISO 8601 timestamp
   */
  getPostTimestamp(postElement) {
    // Try to find timestamp - updated for current interface
    // Also look for relative timestamps in text (e.g., "4d •")
    const relativeTimeElements = postElement.querySelectorAll(LINKEDIN_SELECTORS.relativeTime);
    for (const element of relativeTimeElements) {
      const text = element.textContent.trim();
      const timeMatch = text.match(PATTERNS.relativeTime);
      if (timeMatch) {
        // Use base class helper to parse relative time
        return this.parseRelativeTime(timeMatch[1]);
      }
    }

    for (const selector of LINKEDIN_SELECTORS.timestamp) {
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

  /**
   * Extract share/repost information
   * @param {Element} postElement - The post element
   * @returns {Object} Share info
   */
  getShareInfo(postElement) {
    // Check if this is a shared/reposted content - updated for current interface
    // Check for "celebrates this" pattern in header
    const headerElement = postElement.querySelector(LINKEDIN_SELECTORS.shareIndicators[0]);
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

    for (const selector of LINKEDIN_SELECTORS.shareIndicators) {
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

  /**
   * Extract engagement metrics
   * @param {Element} postElement - The post element
   * @returns {Object} Metrics object
   */
  getMetrics(postElement) {
    // Get engagement metrics if visible - updated for current interface
    const metrics = {};

    // Look for reaction count in the new interface
    const reactionCount = postElement.querySelector(LINKEDIN_SELECTORS.metrics.reactions);
    if (reactionCount) {
      const text = reactionCount.textContent.trim();
      const match = text.match(/(\d+)/);
      if (match) {
        metrics.reactions = match[1];
      }
    }

    // Look for repost count
    const repostCount = postElement.querySelector(LINKEDIN_SELECTORS.metrics.reposts);
    if (repostCount) {
      const text = repostCount.textContent.trim();
      const match = text.match(/(\d+)/);
      if (match) {
        metrics.reposts = match[1];
      }
    }

    // Try legacy selectors as fallback
    const socialCounts = postElement.querySelector(LINKEDIN_SELECTORS.metrics.socialCounts);
    if (socialCounts) {
      const reactionsText = socialCounts.textContent.trim();
      if (reactionsText) {
        metrics.reactions = reactionsText;
      }
    }

    // Try to get comment count
    const commentButton = postElement.querySelector(LINKEDIN_SELECTORS.metrics.commentButton);
    if (commentButton) {
      const commentText = commentButton.textContent.trim();
      const match = commentText.match(/(\d+)/);
      if (match) {
        metrics.comments = match[1];
      }
    }

    // Try to get share count
    const shareButton = postElement.querySelector(LINKEDIN_SELECTORS.metrics.shareButton);
    if (shareButton) {
      const shareText = shareButton.textContent.trim();
      const match = shareText.match(/(\d+)/);
      if (match) {
        metrics.shares = match[1];
      }
    }

    return metrics;
  }

  /**
   * Find action bar for inserting save button
   * @param {Element} postElement - The post element
   * @returns {Element|null} Action bar element
   */
  findActionBar(postElement) {
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
}

// Export for ES6 modules
export { LinkedInHandler };

// Also make available globally for content scripts (when loaded as regular script)
if (typeof window !== 'undefined') {
  window.LinkedInHandler = LinkedInHandler;
}

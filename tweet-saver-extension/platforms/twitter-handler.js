/**
 * TwitterHandler - Platform handler for Twitter/X
 *
 * Handles post detection, content extraction, and metadata retrieval for Twitter/X.
 * Extends BasePlatformHandler to implement platform-specific logic.
 */

class TwitterHandler extends BasePlatformHandler {
  constructor(config) {
    super(config);
    this.platform = 'twitter';
  }

  /**
   * Find all tweet elements on the current page
   * @returns {Array<Element>} Array of tweet DOM elements
   */
  findPosts() {
    // Twitter/X uses various selectors depending on the page structure
    let posts = [];
    for (const selector of TWITTER_SELECTORS.posts) {
      const elements = document.querySelectorAll(selector);
      if (elements.length > 0) {
        posts = Array.from(elements);
        break;
      }
    }

    return posts;
  }

  /**
   * Extract unique identifier for a tweet
   * @param {Element} tweetElement - The tweet element
   * @returns {string} Unique tweet identifier
   */
  getPostId(tweetElement) {
    // Try to get a unique identifier for the tweet
    const link = tweetElement.querySelector('a[href*="/status/"]');
    if (link) {
      const href = link.getAttribute('href');
      const match = href.match(/\/status\/(\d+)/);
      if (match) return match[1];
    }

    // Fallback to element's position and content
    const content = this.getPostContent(tweetElement);
    return content ? btoa(content.substring(0, 50)) : Math.random().toString();
  }

  /**
   * Extract tweet text content
   * @param {Element} tweetElement - The tweet element
   * @returns {string|null} Tweet text or null if not found
   */
  getPostContent(tweetElement) {
    // Try different selectors for tweet text
    for (const selector of TWITTER_SELECTORS.content) {
      const textElement = tweetElement.querySelector(selector);
      if (textElement && textElement.textContent.trim()) {
        return textElement.textContent.trim();
      }
    }

    return null;
  }

  /**
   * Extract author name
   * @param {Element} tweetElement - The tweet element
   * @returns {string} Author name
   */
  getPostAuthor(tweetElement) {
    // Try different selectors for author
    for (const selector of TWITTER_SELECTORS.author) {
      const authorElement = tweetElement.querySelector(selector);
      if (authorElement) {
        const text = authorElement.textContent.trim();
        if (text && !text.includes('·') && !text.includes('•') && !text.includes('@')) {
          return text;
        }
      }
    }

    // Fallback: try to get from URL
    const link = tweetElement.querySelector(TWITTER_SELECTORS.link);
    if (link) {
      const href = link.getAttribute('href');
      const match = href.match(PATTERNS.twitterHandle);
      if (match) return match[1];
    }

    return 'Unknown';
  }

  /**
   * Extract author handle (@username)
   * @param {Element} tweetElement - The tweet element
   * @returns {string} Author handle
   */
  getPostHandle(tweetElement) {
    // Get the @handle
    for (const selector of TWITTER_SELECTORS.handle) {
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
    const link = tweetElement.querySelector(TWITTER_SELECTORS.link);
    if (link) {
      const href = link.getAttribute('href');
      const match = href.match(PATTERNS.twitterHandle);
      if (match) return '@' + match[1];
    }

    return '@unknown';
  }

  /**
   * Extract direct URL to the tweet
   * @param {Element} tweetElement - The tweet element
   * @returns {string} Tweet URL
   */
  getPostUrl(tweetElement) {
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

  /**
   * Extract tweet timestamp
   * @param {Element} tweetElement - The tweet element
   * @returns {string} ISO 8601 timestamp
   */
  getPostTimestamp(tweetElement) {
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

  /**
   * Extract retweet information
   * @param {Element} tweetElement - The tweet element
   * @returns {Object} Retweet info { isShare: boolean, sharedBy?: string, shareContext?: string }
   */
  getShareInfo(tweetElement) {
    // Check if this is a retweet
    for (const selector of TWITTER_SELECTORS.retweetIndicators) {
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

  /**
   * Extract engagement metrics (likes, retweets, etc.)
   * @param {Element} tweetElement - The tweet element
   * @returns {Object} Metrics object
   */
  getMetrics(tweetElement) {
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

  /**
   * Find the action bar (like, retweet, share buttons) for inserting save button
   * @param {Element} postElement - The tweet element
   * @returns {Element|null} Action bar element
   */
  findActionBar(postElement) {
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
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TwitterHandler;
}

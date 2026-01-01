/**
 * BasePlatformHandler - Abstract base class for social media platform handlers
 *
 * This class defines the interface that all platform-specific handlers must implement.
 * It provides shared helper methods for DOM manipulation and text extraction.
 *
 * Subclasses must implement all abstract methods or throw 'Not implemented' errors.
 */

class BasePlatformHandler {
  /**
   * @param {Object} config - Configuration object containing API endpoint, templates, etc.
   */
  constructor(config) {
    this.config = config;
  }

  // ============================================================================
  // ABSTRACT METHODS - Must be implemented by subclasses
  // ============================================================================

  /**
   * Find all post elements on the current page
   * @returns {Array<Element>} Array of post DOM elements
   * @throws {Error} If not implemented by subclass
   */
  findPosts() {
    throw new Error('findPosts() must be implemented by subclass');
  }

  /**
   * Extract a unique identifier for a post
   * @param {Element} element - The post element
   * @returns {string} Unique post identifier
   * @throws {Error} If not implemented by subclass
   */
  getPostId(element) {
    throw new Error('getPostId() must be implemented by subclass');
  }

  /**
   * Extract the main content/text of a post
   * @param {Element} element - The post element
   * @returns {string|Promise<string>} Post content (may be async for transcript extraction)
   * @throws {Error} If not implemented by subclass
   */
  getPostContent(element) {
    throw new Error('getPostContent() must be implemented by subclass');
  }

  /**
   * Extract the author/creator name
   * @param {Element} element - The post element
   * @returns {string} Author name
   * @throws {Error} If not implemented by subclass
   */
  getPostAuthor(element) {
    throw new Error('getPostAuthor() must be implemented by subclass');
  }

  /**
   * Extract the author's handle/username
   * @param {Element} element - The post element
   * @returns {string} Author handle (e.g., @username or /in/username)
   * @throws {Error} If not implemented by subclass
   */
  getPostHandle(element) {
    throw new Error('getPostHandle() must be implemented by subclass');
  }

  /**
   * Extract the direct URL to the post
   * @param {Element} element - The post element
   * @returns {string} Post URL
   * @throws {Error} If not implemented by subclass
   */
  getPostUrl(element) {
    throw new Error('getPostUrl() must be implemented by subclass');
  }

  /**
   * Extract or estimate the post timestamp
   * @param {Element} element - The post element
   * @returns {string} ISO 8601 timestamp
   * @throws {Error} If not implemented by subclass
   */
  getPostTimestamp(element) {
    throw new Error('getPostTimestamp() must be implemented by subclass');
  }

  /**
   * Find the action bar element where the save button should be inserted
   * @param {Element} element - The post element
   * @returns {Element|null} Action bar element or null if not found
   * @throws {Error} If not implemented by subclass
   */
  findActionBar(element) {
    throw new Error('findActionBar() must be implemented by subclass');
  }

  // ============================================================================
  // OPTIONAL METHODS - Have default implementations but can be overridden
  // ============================================================================

  /**
   * Extract share/repost information
   * @param {Element} element - The post element
   * @returns {Object} Share info object { isShare: boolean, sharedBy?: string, shareContext?: string }
   */
  getShareInfo(element) {
    return { isShare: false };
  }

  /**
   * Extract engagement metrics (likes, comments, shares, etc.)
   * @param {Element} element - The post element
   * @returns {Object} Metrics object with platform-specific keys
   */
  getMetrics(element) {
    return {};
  }

  // ============================================================================
  // SHARED HELPER METHODS
  // ============================================================================

  /**
   * Try multiple selectors and return the first matching element
   * @param {Element} element - The parent element to search within
   * @param {string|Array<string>} selectors - Single selector or array of selectors to try
   * @returns {Element|null} First matching element or null
   */
  querySelector(element, selectors) {
    // Handle single selector string
    if (typeof selectors === 'string') {
      return element.querySelector(selectors);
    }

    // Handle array of selectors - try each until one matches
    if (Array.isArray(selectors)) {
      for (const selector of selectors) {
        const found = element.querySelector(selector);
        if (found) {
          return found;
        }
      }
    }

    return null;
  }

  /**
   * Try multiple selectors and extract text from the first match
   * @param {Element} element - The parent element to search within
   * @param {string|Array<string>} selectors - Single selector or array of selectors to try
   * @param {Object} options - Extraction options
   * @param {boolean} options.trim - Whether to trim whitespace (default: true)
   * @param {string} options.attribute - Attribute name to extract instead of textContent
   * @param {Function} options.transform - Transform function applied to extracted text
   * @returns {string|null} Extracted text or null if not found
   */
  extractTextFromSelectors(element, selectors, options = {}) {
    const {
      trim = true,
      attribute = null,
      transform = null
    } = options;

    // Find the element using querySelector helper
    const found = this.querySelector(element, selectors);
    if (!found) {
      return null;
    }

    // Extract text from attribute or textContent
    let text;
    if (attribute) {
      text = found.getAttribute(attribute);
    } else {
      text = found.textContent;
    }

    if (!text) {
      return null;
    }

    // Apply trim if requested
    if (trim) {
      text = text.trim();
    }

    // Apply transform function if provided
    if (transform && typeof transform === 'function') {
      text = transform(text);
    }

    return text;
  }

  /**
   * Extract text from multiple elements matching selectors
   * @param {Element} element - The parent element to search within
   * @param {string|Array<string>} selectors - Single selector or array of selectors
   * @param {Object} options - Extraction options
   * @param {string} options.separator - String to join multiple texts (default: '\n')
   * @param {boolean} options.trim - Whether to trim whitespace (default: true)
   * @param {Function} options.filter - Filter function for elements
   * @returns {string|null} Combined text or null if none found
   */
  extractTextFromAll(element, selectors, options = {}) {
    const {
      separator = '\n',
      trim = true,
      filter = null
    } = options;

    // Convert single selector to array
    const selectorArray = Array.isArray(selectors) ? selectors : [selectors];

    const texts = [];

    // Try each selector
    for (const selector of selectorArray) {
      const elements = element.querySelectorAll(selector);

      for (const el of elements) {
        // Apply filter if provided
        if (filter && !filter(el)) {
          continue;
        }

        let text = el.textContent;
        if (trim) {
          text = text.trim();
        }

        if (text) {
          texts.push(text);
        }
      }
    }

    return texts.length > 0 ? texts.join(separator) : null;
  }

  /**
   * Check if an element has content matching criteria
   * @param {Element} element - The element to check
   * @param {Object} options - Check options
   * @param {number} options.minLength - Minimum text length (default: 0)
   * @param {RegExp} options.excludePattern - Pattern to exclude
   * @returns {boolean} True if element has valid content
   */
  hasContent(element, options = {}) {
    const {
      minLength = 0,
      excludePattern = null
    } = options;

    const text = element.textContent?.trim();

    if (!text || text.length < minLength) {
      return false;
    }

    if (excludePattern && excludePattern.test(text)) {
      return false;
    }

    return true;
  }

  /**
   * Parse relative time strings (e.g., "2h ago", "3d") to ISO timestamp
   * @param {string} relativeTime - Relative time string
   * @returns {string} ISO 8601 timestamp
   */
  parseRelativeTime(relativeTime) {
    const match = relativeTime.match(/(\d+)([smhdwy])/i);
    if (!match) {
      return new Date().toISOString();
    }

    const value = parseInt(match[1]);
    const unit = match[2].toLowerCase();

    let milliseconds = 0;
    switch (unit) {
      case 's': milliseconds = value * 1000; break;
      case 'm': milliseconds = value * 60 * 1000; break;
      case 'h': milliseconds = value * 60 * 60 * 1000; break;
      case 'd': milliseconds = value * 24 * 60 * 60 * 1000; break;
      case 'w': milliseconds = value * 7 * 24 * 60 * 60 * 1000; break;
      case 'y': milliseconds = value * 365 * 24 * 60 * 60 * 1000; break;
      default: return new Date().toISOString();
    }

    const estimatedTime = new Date(Date.now() - milliseconds);
    return estimatedTime.toISOString();
  }

  /**
   * Extract numeric value from text with suffix (e.g., "1.2K" -> 1200)
   * @param {string} text - Text containing number with optional suffix
   * @returns {number} Numeric value
   */
  parseMetricValue(text) {
    if (!text) return 0;

    const cleanText = text.trim().replace(/,/g, '');
    const match = cleanText.match(/(\d+\.?\d*)([KMB])?/i);

    if (!match) return 0;

    const value = parseFloat(match[1]);
    const suffix = match[2]?.toUpperCase();

    const multipliers = {
      'K': 1000,
      'M': 1000000,
      'B': 1000000000
    };

    return suffix ? value * multipliers[suffix] : value;
  }

  /**
   * Get platform name from current URL
   * @returns {string} Platform identifier
   */
  getPlatformName() {
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
}

// Export for ES6 modules
export { BasePlatformHandler };

// Also make available globally for content scripts (when loaded as regular script)
if (typeof window !== 'undefined') {
  window.BasePlatformHandler = BasePlatformHandler;
}

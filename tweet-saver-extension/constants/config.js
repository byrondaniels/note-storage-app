// Configuration constants for Social Media Note Saver Extension

/**
 * Platform identifiers
 */
const PLATFORMS = {
  TWITTER: 'twitter',
  LINKEDIN: 'linkedin',
  YOUTUBE: 'youtube',
  UNKNOWN: 'unknown'
};

/**
 * Platform detection patterns
 */
const PLATFORM_PATTERNS = {
  [PLATFORMS.TWITTER]: ['twitter.com', 'x.com'],
  [PLATFORMS.LINKEDIN]: ['linkedin.com'],
  [PLATFORMS.YOUTUBE]: ['youtube.com']
};

/**
 * Button configuration
 */
const BUTTON_CONFIG = {
  className: 'social-save-btn',
  labels: {
    save: 'Save',
    saving: 'Saving...',
    saved: 'Saved!',
    error: 'Error!'
  },
  styles: {
    default: {
      backgroundColor: '#1d9bf0',
      color: 'white'
    },
    saving: {
      backgroundColor: '#8ecdf8',
      cursor: 'wait'
    },
    saved: {
      backgroundColor: '#00ba7c',
      color: 'white'
    },
    error: {
      backgroundColor: '#f91880',
      color: 'white'
    }
  }
};

/**
 * Timing constants (in milliseconds)
 */
const TIMING = {
  mutationDebounce: 500,
  buttonFeedbackDuration: 2000,
  transcriptLoadWait: 5000,
  descriptionExpandWait: 500,
  retryDelay: 1000
};

/**
 * Content validation
 */
const CONTENT_LIMITS = {
  minPostLength: 50,
  maxPostLength: 5000,
  minTranscriptLength: 10
};

/**
 * Regular expression patterns
 */
const PATTERNS = {
  timeAgo: /\d+\s*(hour|day|week|month|year)s?\s*ago/i,
  engagement: /\d+\s*(reaction|like|comment|share|repost)/i,
  relativeTime: /^(\d+[dhwmy])\s*•/,
  twitterHandle: /\/([^\/]+)\/status/,
  linkedInProfile: /\/in\/([^\/\?]+)/,
  linkedInPost: /\/posts\//,
  videoId: /[?&]v=([^&]+)/
};

// Export for ES6 modules
export {
  PLATFORMS,
  PLATFORM_PATTERNS,
  BUTTON_CONFIG,
  TIMING,
  CONTENT_LIMITS,
  PATTERNS
};

// Also make available globally for content scripts
if (typeof window !== 'undefined') {
  window.PLATFORMS = PLATFORMS;
  window.PLATFORM_PATTERNS = PLATFORM_PATTERNS;
  window.BUTTON_CONFIG = BUTTON_CONFIG;
  window.TIMING = TIMING;
  window.CONTENT_LIMITS = CONTENT_LIMITS;
  window.PATTERNS = PATTERNS;
}

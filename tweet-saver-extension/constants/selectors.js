// Platform-specific CSS selectors for Social Media Note Saver Extension
// Centralized location for all DOM selectors to simplify maintenance when platforms update their UI

/**
 * Twitter/X platform selectors
 */
const TWITTER_SELECTORS = {
  // Post containers
  posts: [
    '[data-testid="tweet"]',
    'article[role="article"]',
    '[data-testid="tweetText"]',
    '.tweet'
  ],

  // Tweet content
  content: [
    '[data-testid="tweetText"]',
    '.tweet-text',
    '.TweetTextSize',
    '[lang]'
  ],

  // Author information
  author: [
    '[data-testid="User-Name"] [dir="ltr"]',
    '[data-testid="User-Name"]',
    '.username',
    '.u-linkComplex-target',
    'a[role="link"][href^="/"]'
  ],

  // User handle (@username)
  handle: [
    '[data-testid="User-Name"] [dir="ltr"]:nth-child(2)',
    '[data-testid="User-Name"] span'
  ],

  // Tweet URL/link
  link: 'a[href*="/status/"]',

  // Retweet indicators
  retweetIndicators: [
    '[data-testid="socialContext"]',
    '[aria-label*="retweeted"]',
    'span'
  ],

  // Engagement metrics
  metrics: {
    all: '[role="group"]'
  }
};

/**
 * LinkedIn platform selectors
 */
const LINKEDIN_SELECTORS = {
  // Post containers
  posts: [
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
  ],

  // Post content
  content: [
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
    'span[lang]'
  ],

  // Expandable content elements
  expandable: '[data-testid="expandable-text-box"]',

  // Author information
  author: [
    'a[href*="/in/"] strong',
    '[data-view-name="feed-header-text"] strong',
    '.feed-shared-actor__name',
    '.update-components-actor__name',
    '.feed-shared-actor__title',
    '[data-control-name="actor_name"]',
    '.feed-shared-update-v2__actor-name'
  ],

  // Profile/handle links
  profile: [
    '[data-view-name="feed-header-text"] a[href*="/in/"]',
    '[data-view-name="feed-actor-image"] a[href*="/in/"]',
    'a[href*="/in/"]',
    '.feed-shared-actor__meta a',
    '.update-components-actor__meta a'
  ],

  // Post permalink
  permalink: [
    'a[href*="/posts/"]',
    '[data-control-name="overlay"] a',
    '.feed-shared-control-menu__trigger'
  ],

  // URN/ID elements
  urn: '[data-id*="urn:li:activity"]',

  // Timestamp
  timestamp: [
    'time',
    '[data-live-timestamp]',
    '.feed-shared-actor__sub-description time',
    '.update-components-actor__sub-description time'
  ],

  // Relative time (e.g., "4d •")
  relativeTime: 'p',

  // Share/repost indicators
  shareIndicators: [
    '[data-view-name="feed-header-text"]',
    '.feed-shared-header__text-info',
    '.update-components-header__text-view',
    '[data-control-name="reshare_context"]',
    '.feed-shared-actor__description'
  ],

  // Engagement metrics
  metrics: {
    reactions: '[data-view-name="feed-reaction-count"] p',
    reposts: '[data-view-name="feed-repost-count"] p',
    socialCounts: '.social-counts-reactions',
    commentButton: '[data-control-name="comment"]',
    shareButton: '[data-control-name="share"]'
  },

  // See more/expand buttons
  expandButtons: [
    '[aria-label*="see more"]',
    '[aria-label*="Show more"]',
    'button[aria-expanded="false"]',
    '.feed-shared-inline-show-more-text__see-more-less-toggle',
    '.feed-shared-text__see-more',
    'button',
    'span'
  ]
};

/**
 * YouTube platform selectors
 */
const YOUTUBE_SELECTORS = {
  // Video player
  player: [
    '#movie_player',
    '#player',
    '.html5-video-player'
  ],

  // Video container for button placement
  container: [
    '#primary',
    '#watch7-content',
    '#content'
  ],

  // Save buttons (for cleanup)
  saveButtons: '.social-save-btn[data-platform="youtube"]',

  // Transcript-related
  transcript: {
    buttons: [
      'button[aria-label*="transcript" i]',
      'button[aria-label*="Show transcript" i]',
      'yt-button-renderer:has([aria-label*="transcript" i])',
      '[role="button"]:has-text("Show transcript")',
      'ytd-engagement-panel-title-header-renderer:has-text("Transcript")',
      '#description button:has-text("Show transcript")',
      'button:has-text("Show transcript")'
    ],
    expandDescription: [
      '#description button[aria-label*="more" i]',
      '#expand'
    ],
    panel: [
      'ytd-transcript-renderer',
      '#transcript-scrollbox',
      '[aria-label*="transcript" i]'
    ],
    segments: [
      'ytd-transcript-segment-renderer',
      '.ytd-transcript-segment-renderer',
      '[class*="segment"]'
    ],
    segmentText: '.segment-text'
  }
};

/**
 * Common mutation observer selectors
 */
const MUTATION_SELECTORS = {
  linkedin: {
    feedUpdate: '[data-view-name="feed-full-update"]',
    listItem: '[role="listitem"]',
    primary: '#primary',
    watchFlexy: '.ytd-watch-flexy'
  }
};

// Export for ES6 modules (background, popup, options)
export {
  TWITTER_SELECTORS,
  LINKEDIN_SELECTORS,
  YOUTUBE_SELECTORS,
  MUTATION_SELECTORS
};

// Also make available globally for content scripts (when loaded as regular script)
if (typeof window !== 'undefined') {
  window.TWITTER_SELECTORS = TWITTER_SELECTORS;
  window.LINKEDIN_SELECTORS = LINKEDIN_SELECTORS;
  window.YOUTUBE_SELECTORS = YOUTUBE_SELECTORS;
  window.MUTATION_SELECTORS = MUTATION_SELECTORS;
}

/**
 * YouTubeHandler - Platform handler for YouTube
 *
 * Handles video detection, transcript extraction, and channel scraping for YouTube.
 * Extends BasePlatformHandler to implement platform-specific logic.
 *
 * Note: YouTube transcript extraction requires clicking UI elements and is async.
 */

import { BasePlatformHandler } from './base-platform-handler.js';
import { YOUTUBE_SELECTORS } from '../constants/selectors.js';
import { PATTERNS } from '../constants/config.js';

class YouTubeHandler extends BasePlatformHandler {
  constructor(config) {
    super(config);
    this.platform = 'youtube';
  }

  /**
   * Find YouTube video elements (returns container for button placement)
   * @returns {Array<Element>} Array with video container element
   */
  findPosts() {
    console.log('Social Media Note Saver: Looking for YouTube videos...');

    // Only process if we're on a video or live stream page
    if (!window.location.pathname.includes('/watch') && !window.location.pathname.includes('/live/')) {
      console.log('Social Media Note Saver: Not on a video or live stream page');
      return [];
    }

    // Look for the main video player
    const videoElement = document.querySelector(YOUTUBE_SELECTORS.player.join(', '));
    if (!videoElement) {
      console.log('Social Media Note Saver: No video player found');
      return [];
    }

    // Return the video container for button placement
    const videoContainer = document.querySelector(YOUTUBE_SELECTORS.container.join(', '));
    return videoContainer ? [videoContainer] : [];
  }

  /**
   * Extract video ID from URL
   * @param {Element} postElement - Not used for YouTube
   * @returns {string} Video ID
   */
  getPostId(postElement) {
    // Handle both regular videos (/watch?v=) and live streams (/live/)
    let videoId = new URLSearchParams(window.location.search).get('v');
    if (!videoId && window.location.pathname.includes('/live/')) {
      // Extract video ID from live stream URL: /live/VIDEO_ID
      videoId = window.location.pathname.split('/live/')[1];
    }
    // Always use the video ID if available, or fallback to a static ID for the current page
    return videoId || `youtube-${window.location.pathname}`;
  }

  /**
   * Extract video transcript (async - requires clicking and waiting)
   * @param {Element} postElement - Not used for YouTube
   * @returns {Promise<string>} Video transcript
   */
  async getPostContent(postElement) {
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

  /**
   * Find and click the transcript button to open transcript panel
   * @returns {Promise<Element|null>} Transcript button element
   */
  async findAndClickTranscriptButton() {
    // Look for transcript button in various locations
    for (const selector of YOUTUBE_SELECTORS.transcript.buttons) {
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
    const showMoreButton = document.querySelector(YOUTUBE_SELECTORS.transcript.expandDescription.join(', '));
    if (showMoreButton) {
      console.log('Social Media Note Saver: Expanding description to look for transcript');
      showMoreButton.click();
      await new Promise(resolve => setTimeout(resolve, TIMING.descriptionExpandWait));

      // Try transcript selectors again
      for (const selector of YOUTUBE_SELECTORS.transcript.buttons) {
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

  /**
   * Extract transcript text segments from the transcript panel
   * @returns {Promise<Array<string>>} Array of transcript segments
   */
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

  /**
   * Get current video information
   * @returns {Object} Video info { title, channel, url, videoId, platform }
   */
  getVideoInfo() {
    const videoTitle = document.querySelector('#title h1, .title, .watch-main-col .watch-title')?.textContent?.trim() || 'Unknown Title';
    // Use more specific selector to avoid duplicate text - get the innermost text element
    const channelElement = document.querySelector('#channel-name a, #channel-name yt-formatted-string, ytd-channel-name yt-formatted-string a, .ytd-channel-name a');
    const channelName = channelElement?.textContent?.trim() || 'Unknown Channel';
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

  /**
   * Extract channel name (author)
   * @param {Element} postElement - Not used for YouTube
   * @returns {string} Channel name
   */
  getPostAuthor(postElement) {
    const videoInfo = this.getVideoInfo();
    return videoInfo.channel;
  }

  /**
   * Extract channel handle
   * @param {Element} postElement - Not used for YouTube
   * @returns {string} Channel handle
   */
  getPostHandle(postElement) {
    const videoInfo = this.getVideoInfo();
    return `@${videoInfo.channel}`;
  }

  /**
   * Extract video URL
   * @param {Element} postElement - Not used for YouTube
   * @returns {string} Video URL
   */
  getPostUrl(postElement) {
    const videoInfo = this.getVideoInfo();
    return videoInfo.url;
  }

  /**
   * Extract video timestamp (current time)
   * @param {Element} postElement - Not used for YouTube
   * @returns {string} ISO 8601 timestamp
   */
  getPostTimestamp(postElement) {
    return new Date().toISOString();
  }

  /**
   * Scrape channel videos (for bulk import)
   * @param {number} limit - Maximum number of videos to scrape
   * @returns {Promise<Array<Object>>} Array of video objects
   */
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

  /**
   * Extract and save current video transcript
   * @returns {Promise<Object>} Result object with success status
   */
  async extractAndSaveTranscript() {
    console.log('Social Media Note Saver: Extracting and saving transcript...');

    try {
      // Get video info
      const videoInfo = this.getVideoInfo();
      const videoId = videoInfo.videoId;

      if (!videoId) {
        throw new Error('Could not determine video ID');
      }

      // Extract transcript
      console.log('Social Media Note Saver: Extracting transcript for:', videoInfo.title);
      const transcript = await this.getPostContent();

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

      // Note: buildPayload is not part of this handler, caller must handle payload construction
      return {
        success: true,
        videoId: videoId,
        title: videoInfo.title,
        postData: postData
      };

    } catch (error) {
      console.error('Social Media Note Saver: Failed to extract/save transcript:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Find action bar for inserting save button
   * @param {Element} postElement - Not used for YouTube
   * @returns {Element|null} Action bar element
   */
  findActionBar(postElement) {
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
}

// Export for ES6 modules
export { YouTubeHandler };

// Also make available globally for content scripts (when loaded as regular script)
if (typeof window !== 'undefined') {
  window.YouTubeHandler = YouTubeHandler;
}

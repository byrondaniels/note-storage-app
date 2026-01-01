// Template processing utilities for Social Media Note Saver Extension

/**
 * Replace template placeholders with actual data
 * Recursively processes objects, arrays, and strings to replace {{placeholder}} patterns
 *
 * @param {Object|Array|string} template - Template object with placeholders
 * @param {Object} data - Data object containing values to replace
 * @param {string} data.content - Post content
 * @param {string} data.author - Author name
 * @param {string} data.handle - Author handle/username
 * @param {string} data.url - Post URL
 * @param {string} data.timestamp - Post timestamp
 * @param {string} data.platform - Platform name (twitter, linkedin, youtube)
 * @param {boolean} data.isShare - Whether this is a shared/retweeted post
 * @param {string} data.sharedBy - Username who shared the post
 * @param {string} data.shareContext - Context about the share
 * @param {Object} data.metrics - Engagement metrics (likes, shares, etc.)
 * @returns {Object|Array|string} Processed template with placeholders replaced
 */
function replaceTemplatePlaceholders(template, data) {
  const replacePlaceholders = (obj) => {
    if (typeof obj === 'string') {
      // Handle conditional share context
      let sharePrefix = '';
      if (data.isShare && data.shareContext) {
        sharePrefix = `${data.shareContext}\n\n`;
      }

      return obj
        .replace(/\{\{content\}\}/g, data.content || '')
        .replace(/\{\{author\}\}/g, data.author || '')
        .replace(/\{\{handle\}\}/g, data.handle || '')
        .replace(/\{\{url\}\}/g, data.url || '')
        .replace(/\{\{timestamp\}\}/g, data.timestamp || '')
        .replace(/\{\{platform\}\}/g, data.platform || 'unknown')
        .replace(/\{\{isShare\}\}/g, data.isShare ? 'true' : 'false')
        .replace(/\{\{sharedBy\}\}/g, data.sharedBy || '')
        .replace(/\{\{shareContext\}\}/g, sharePrefix)
        .replace(/\{\{metrics\}\}/g, JSON.stringify(data.metrics || {}))
        // Backward compatibility for existing templates
        .replace(/\{\{isRetweet\}\}/g, data.isShare ? 'true' : 'false')
        .replace(/\{\{retweetedBy\}\}/g, data.sharedBy || '')
        .replace(/\{\{retweetContext\}\}/g, sharePrefix);
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

  return replacePlaceholders(JSON.parse(JSON.stringify(template)));
}

// Export for ES6 modules (background, popup, options)
export { replaceTemplatePlaceholders };

// Also make available globally for content scripts (when loaded as regular script)
if (typeof window !== 'undefined') {
  window.replaceTemplatePlaceholders = replaceTemplatePlaceholders;
}

/**
 * Shared formatting utility functions
 */

/**
 * Format a category name for display (converts kebab-case to Title Case)
 * @param {string} category - The category name in kebab-case
 * @returns {string} The formatted category name
 */
export function formatCategoryName(category) {
  if (!category) return ''
  return category
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

/**
 * Format a date string for display
 * @param {string} dateString - The date string to format
 * @param {Object} options - Formatting options
 * @param {boolean} options.includeTime - Whether to include time (default: false)
 * @returns {string} The formatted date string
 */
export function formatDate(dateString, { includeTime = false } = {}) {
  if (!dateString) return ''
  const date = new Date(dateString)
  if (includeTime) {
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }
  return date.toLocaleDateString()
}

/**
 * Get a preview of content, truncated to a maximum length
 * @param {string} content - The content to preview
 * @param {number} maxLength - Maximum length before truncation (default: 80)
 * @returns {string} The truncated preview
 */
export function getPreview(content, maxLength = 80) {
  if (!content) return 'No content'
  return content.length > maxLength ? content.substring(0, maxLength) + '...' : content
}

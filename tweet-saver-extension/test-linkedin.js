// LinkedIn Test Script - Run this in the browser console on LinkedIn
// This will help debug what's happening with the extension

console.log('=== LinkedIn Extension Debug Test ===');
console.log('Current URL:', window.location.href);
console.log('Hostname:', window.location.hostname);

// Test platform detection
const hostname = window.location.hostname;
const isLinkedIn = hostname.includes('linkedin.com');
console.log('Is LinkedIn?', isLinkedIn);

// Test for common LinkedIn selectors
const testSelectors = [
  '.feed-shared-update-v2',
  '[data-id*="urn:li:activity"]',
  '.occludable-update',
  '.feed-shared-update-v2__description-wrapper',
  '.feed-shared-update-v2__content',
  '[data-id^="urn:li:activity"]',
  '.scaffold-finite-scroll__content',
  '.feed-container-theme'
];

console.log('=== Testing LinkedIn Selectors ===');
testSelectors.forEach(selector => {
  const elements = document.querySelectorAll(selector);
  console.log(`"${selector}": ${elements.length} elements found`);
  if (elements.length > 0) {
    console.log('  First element:', elements[0]);
  }
});

// Check if extension is loaded
console.log('=== Extension Status ===');
console.log('Extension content script loaded?', window.SocialMediaSaver ? 'YES' : 'NO');

// Look for existing save buttons
const existingButtons = document.querySelectorAll('.social-save-btn');
console.log('Existing save buttons found:', existingButtons.length);

console.log('=== Test Complete ===');
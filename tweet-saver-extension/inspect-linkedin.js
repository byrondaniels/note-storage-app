// LinkedIn Structure Inspector
// Run this in the console on LinkedIn to find current selectors

console.log('=== LinkedIn DOM Structure Inspector ===');

// Look for any elements that might be posts
const possiblePostSelectors = [
  'article',
  '[data-urn]',
  '[data-id]',
  '.feed-shared-update',
  '.feed-shared-update-v2',
  '.occludable-update',
  '.artdeco-card',
  '.update-components-text',
  '[class*="feed"]',
  '[class*="update"]',
  '[class*="post"]',
  '[class*="activity"]'
];

console.log('=== Searching for Post Elements ===');
possiblePostSelectors.forEach(selector => {
  try {
    const elements = document.querySelectorAll(selector);
    if (elements.length > 0) {
      console.log(`✅ "${selector}": ${elements.length} elements`);
      // Show the first element's classes and attributes
      const first = elements[0];
      console.log('  Classes:', first.className);
      console.log('  Data attributes:', Array.from(first.attributes).filter(attr => attr.name.startsWith('data-')));
    }
  } catch (e) {
    console.log(`❌ "${selector}": Error - ${e.message}`);
  }
});

// Look specifically in the main feed container
console.log('\n=== Feed Container Analysis ===');
const feedContainer = document.querySelector('.scaffold-finite-scroll__content, .feed-container, .core-rail, main');
if (feedContainer) {
  console.log('Feed container found:', feedContainer.className);
  const children = feedContainer.children;
  console.log('Direct children count:', children.length);
  
  // Analyze first few children
  for (let i = 0; i < Math.min(3, children.length); i++) {
    const child = children[i];
    console.log(`Child ${i + 1}:`);
    console.log('  Tag:', child.tagName);
    console.log('  Classes:', child.className);
    console.log('  Data attributes:', Array.from(child.attributes).filter(attr => attr.name.startsWith('data-')));
  }
} else {
  console.log('No feed container found');
}

// Look for text content that might indicate posts
console.log('\n=== Content Analysis ===');
const elementsWithText = document.querySelectorAll('*');
let postLikeElements = [];

Array.from(elementsWithText).forEach(el => {
  const text = el.textContent;
  if (text && text.length > 50 && text.length < 1000) {
    const hasPostIndicators = text.includes('ago') || text.includes('hour') || text.includes('day') || 
                             text.includes('week') || text.includes('month') || text.includes('•') ||
                             text.includes('Like') || text.includes('Comment') || text.includes('Share');
    if (hasPostIndicators && el.children.length > 0) {
      postLikeElements.push(el);
    }
  }
});

console.log('Elements that look like posts:', postLikeElements.length);
if (postLikeElements.length > 0) {
  const sample = postLikeElements[0];
  console.log('Sample post-like element:');
  console.log('  Classes:', sample.className);
  console.log('  Tag:', sample.tagName);
  console.log('  Text preview:', sample.textContent.substring(0, 100) + '...');
}

console.log('\n=== Inspection Complete ===');
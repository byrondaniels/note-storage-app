/**
 * Localhost Bridge Entry Point
 *
 * Enables communication between the Vue app and the extension
 * by relaying messages from the page to the extension.
 */

// Listen for messages from the Vue app
window.addEventListener('message', async (event) => {
  // Only accept messages from the same window
  if (event.source !== window) return;

  // Only handle messages intended for the extension
  if (event.data.type !== 'EXTENSION_MESSAGE') return;

  try {
    // Forward to extension background script
    const response = await chrome.runtime.sendMessage(event.data.payload);

    // Send response back to page
    window.postMessage({
      type: 'EXTENSION_RESPONSE',
      id: event.data.id,
      response: response
    }, '*');
  } catch (error) {
    window.postMessage({
      type: 'EXTENSION_RESPONSE',
      id: event.data.id,
      error: error.message
    }, '*');
  }
});

// Listen for progress updates from background
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'importProgress') {
    // Forward to page
    window.postMessage({
      type: 'EXTENSION_PROGRESS',
      payload: message
    }, '*');
  }
});

// Notify page that bridge is ready
window.postMessage({ type: 'EXTENSION_BRIDGE_READY' }, '*');

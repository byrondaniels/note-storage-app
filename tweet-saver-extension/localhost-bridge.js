// Localhost Bridge - Forwards messages between extension and Vue app

console.log('Social Media Note Saver: Localhost bridge loaded')

// Listen for messages from background script and forward to page
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'importProgress') {
    console.log('Social Media Note Saver: Forwarding progress to page:', message)
    window.postMessage({
      type: 'SOCIAL_MEDIA_SAVER_PROGRESS',
      payload: message
    }, '*')
  }
})

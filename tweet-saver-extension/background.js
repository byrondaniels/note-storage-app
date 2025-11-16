// Social Media Note Saver - Background Script (Service Worker)

// Handle extension installation
chrome.runtime.onInstalled.addListener((details) => {
  console.log('Social Media Note Saver: Extension installed/updated', details);
  
  // Set default configuration on first install
  if (details.reason === 'install') {
    chrome.storage.sync.set({
      apiEndpoint: 'http://localhost:8080/notes',
      payloadTemplate: {
        content: 'This post is from: {{author}} ({{handle}}) on {{platform}}\n\n{{shareContext}}{{content}}\n\nSource: {{url}}',
        metadata: {
          author: '{{author}}',
          handle: '{{handle}}',
          url: '{{url}}',
          timestamp: '{{timestamp}}',
          platform: '{{platform}}',
          isShare: '{{isShare}}',
          sharedBy: '{{sharedBy}}',
          shareContext: '{{shareContext}}',
          metrics: '{{metrics}}'
        }
      }
    });
  }
});

// Handle messages from content script or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getConfig') {
    chrome.storage.sync.get(['apiEndpoint', 'payloadTemplate'], (result) => {
      sendResponse(result);
    });
    return true; // Required for async response
  }
  
  if (request.action === 'saveConfig') {
    chrome.storage.sync.set(request.config, () => {
      sendResponse({ success: true });
    });
    return true;
  }
  
  if (request.action === 'testAPI') {
    // Test API endpoint
    testAPIEndpoint(request.endpoint, request.payload)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
});

async function testAPIEndpoint(endpoint, payload) {
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      throw new Error(`${response.status}: ${response.statusText}`);
    }
    
    const data = await response.text();
    return { 
      success: true, 
      status: response.status,
      response: data.substring(0, 200) // Limit response size
    };
  } catch (error) {
    return { 
      success: false, 
      error: error.message 
    };
  }
}
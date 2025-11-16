# Quick Installation Guide

## 📋 Prerequisites

- Google Chrome browser
- Basic understanding of Chrome extensions
- An API endpoint that accepts POST requests (optional for testing)

## 🚀 Installation Steps

### 1. Download the Extension

```bash
# Option A: Clone the repository
git clone <repository-url>
cd tweet-saver-extension

# Option B: Download ZIP and extract
# Download ZIP → Extract to folder
```

### 2. Create Icons (Optional but Recommended)

```bash
# Open the icon generator in your browser
open create-png-icons.html

# OR if you have the icons already, skip this step
```

1. Click "Download All Icons" 
2. Save the downloaded PNG files to the `icons/` folder
3. Ensure files are named: `icon16.png`, `icon32.png`, `icon48.png`, `icon128.png`

### 3. Install in Chrome

1. **Open Chrome Extensions**
   - Type `chrome://extensions/` in address bar
   - OR Menu → More tools → Extensions

2. **Enable Developer Mode**
   - Toggle "Developer mode" switch (top-right)

3. **Load Extension**
   - Click "Load unpacked"
   - Select the `tweet-saver-extension` folder
   - Extension should appear in your list

4. **Verify Installation**
   - Look for Tweet Note Saver icon in Chrome toolbar
   - Icon should show a blue bookmark symbol

### 4. Configure API Endpoint

1. **Click the extension icon** in Chrome toolbar
2. **Enter API endpoint URL**:
   - For local notes app: `http://localhost:8080/notes`
   - For testing: `https://httpbin.org/post`
   - For webhook testing: `https://webhook.site/your-unique-url`

3. **Test the connection**:
   - Click "Test API" button
   - Should see success message if endpoint is reachable

4. **Save configuration**:
   - Click "Save Configuration"
   - Configuration is stored in Chrome sync

### 5. Test on Twitter/X

1. **Visit Twitter**:
   - Go to `https://twitter.com` or `https://x.com`
   - Scroll through your timeline

2. **Look for Save buttons**:
   - Blue "Save" buttons should appear next to tweets
   - Buttons should have bookmark icon + "Save" text

3. **Test saving**:
   - Click any "Save" button
   - Should see "Saving..." then "Saved!" or error message
   - Check your API endpoint to confirm data was received

## 🔧 Troubleshooting

### Save Buttons Not Showing

```bash
# Check console for errors
F12 → Console tab → Look for "Tweet Note Saver" messages

# Refresh the page
Ctrl+R (Windows) or Cmd+R (Mac)

# Reload extension
chrome://extensions/ → Click reload button on Tweet Note Saver
```

### API Errors

1. **Check endpoint URL**: Must be valid and accessible
2. **Test with HTTPBin**: Use `https://httpbin.org/post` for testing
3. **Check CORS**: Your API must allow browser requests
4. **Verify JSON**: Make sure payload template is valid JSON

### Configuration Not Saving

1. **Enable Chrome sync**: Chrome Settings → Sync and Google services
2. **Check storage permissions**: Extension should have storage permission
3. **Clear and reconfigure**: Options → Clear All Data → Reconfigure

## 📝 Quick Test Setup

### Option 1: Use HTTPBin (Immediate Testing)
```json
Endpoint: https://httpbin.org/post
Template: {
  "content": "{{content}}",
  "author": "{{author}}",
  "url": "{{url}}"
}
```

### Option 2: Use Webhook.site (See Real Data)
1. Go to https://webhook.site/
2. Copy your unique URL
3. Use as endpoint in extension
4. Save tweets and see them appear on webhook.site

### Option 3: Local Notes API
1. Start the notes app: `docker-compose up -d`
2. Use endpoint: `http://localhost:8080/notes`
3. Use template: `{"content": "{{content}}"}`
4. Saved tweets will appear in your notes app

## 🎯 Success Indicators

✅ **Extension installed**: Icon appears in Chrome toolbar  
✅ **Configuration saved**: No errors when clicking "Save Configuration"  
✅ **API test passes**: "Test API" button shows success  
✅ **Buttons appear**: Save buttons visible on Twitter/X tweets  
✅ **Saving works**: Click save → "Saved!" message appears  
✅ **Data received**: Check your API endpoint for incoming data  

## 🆘 Get Help

If you're still having issues:

1. **Check browser console**: F12 → Console → Look for errors
2. **Test API independently**: Use Postman/curl to test your endpoint
3. **Use test endpoints**: Try HTTPBin or Webhook.site first
4. **Check extension logs**: chrome://extensions/ → Tweet Note Saver → Errors

---

**You're ready to start saving tweets! 🐦→📝**
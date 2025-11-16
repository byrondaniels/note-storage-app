# Tweet Note Saver - Chrome Extension

A Chrome browser extension that adds a "Save Note" button to each tweet on Twitter/X, allowing you to capture tweet content and send it to your notes API with one click.

## 🚀 Features

- **One-Click Saving**: Add "Save" buttons to every tweet on Twitter/X
- **Configurable API**: Point to any REST API endpoint that accepts JSON
- **Customizable Payload**: Define exactly how tweet data is formatted and sent
- **Real-time Feedback**: Visual success/error indicators for each save operation
- **Dynamic Loading**: Works with Twitter's infinite scroll and real-time updates
- **Cross-Platform**: Works on both twitter.com and x.com

## 📦 Installation

### Option 1: Load Unpacked Extension (Development)

1. **Download the Extension**
   ```bash
   git clone <repository-url>
   # OR download and extract the ZIP file
   ```

2. **Open Chrome Extensions Page**
   - Navigate to `chrome://extensions/` in your Chrome browser
   - OR click the three dots menu → More tools → Extensions

3. **Enable Developer Mode**
   - Toggle the "Developer mode" switch in the top-right corner

4. **Load the Extension**
   - Click "Load unpacked" button
   - Select the `tweet-saver-extension` folder
   - The extension should now appear in your extensions list

5. **Verify Installation**
   - You should see the Tweet Note Saver icon in your Chrome toolbar
   - Visit twitter.com or x.com to see save buttons on tweets

### Option 2: Icons Setup (Optional)

If you want proper icons, create PNG files in the `icons/` directory:
- `icon16.png` (16x16 pixels)
- `icon32.png` (32x32 pixels) 
- `icon48.png` (48x48 pixels)
- `icon128.png` (128x128 pixels)

You can use the included `create-icons.html` file to generate these icons.

## ⚙️ Configuration

### Quick Setup

1. **Click the Extension Icon** in your Chrome toolbar
2. **Enter your API endpoint URL** (e.g., `http://localhost:8080/notes`)
3. **Customize the payload template** if needed
4. **Click "Test API"** to verify the connection
5. **Click "Save Configuration"**

### API Endpoint Requirements

Your API endpoint should:
- Accept POST requests
- Accept JSON content type (`application/json`)
- Return a 2xx status code for successful saves
- Have CORS headers configured for browser requests

Example minimal API response:
```json
{ "success": true, "id": "note-123" }
```

### Payload Templates

The extension uses JSON templates with placeholders that get replaced with actual tweet data:

**Available Placeholders:**
- `{{content}}` - Tweet text content
- `{{author}}` - Tweet author username (without @)
- `{{url}}` - Direct link to the tweet
- `{{timestamp}}` - When the tweet was captured (ISO format)

**Default Template:**
```json
{
  "content": "{{content}}",
  "metadata": {
    "author": "{{author}}",
    "url": "{{url}}",
    "timestamp": "{{timestamp}}",
    "source": "twitter"
  }
}
```

**Notes API Compatible Template:**
```json
{
  "content": "Tweet from @{{author}}:\n\n{{content}}\n\nSource: {{url}}"
}
```

### Advanced Configuration

For advanced settings, click "Advanced Settings" in the popup or right-click the extension icon and select "Options".

## 🔧 Integration Examples

### With Your Notes App

If you have the notes app from this repository running:

1. **Set API Endpoint**: `http://localhost:8080/notes`
2. **Use this template**:
   ```json
   {
     "content": "Tweet from @{{author}}:\n\n{{content}}\n\nSource: {{url}}"
   }
   ```

### With Notion API

```json
{
  "parent": { "database_id": "your-database-id" },
  "properties": {
    "Title": {
      "title": [{ "text": { "content": "Tweet from @{{author}}" } }]
    },
    "Content": {
      "rich_text": [{ "text": { "content": "{{content}}" } }]
    },
    "URL": {
      "url": "{{url}}"
    }
  }
}
```

### With Airtable API

```json
{
  "records": [{
    "fields": {
      "Content": "{{content}}",
      "Author": "{{author}}",
      "URL": "{{url}}",
      "Date": "{{timestamp}}"
    }
  }]
}
```

## 🎯 Usage

1. **Visit Twitter/X**: Go to twitter.com or x.com
2. **Find Save Buttons**: Look for "Save" buttons next to each tweet
3. **Click to Save**: Click any save button to send the tweet to your API
4. **See Feedback**: Watch for success ✅ or error ❌ indicators
5. **Manage Settings**: Click the extension icon to adjust configuration

## 🛠️ Development

### File Structure

```
tweet-saver-extension/
├── manifest.json          # Extension configuration
├── content.js             # Main logic that runs on Twitter/X
├── styles.css             # Styling for save buttons
├── background.js          # Service worker for API calls
├── popup.html             # Quick settings popup
├── popup.js               # Popup functionality
├── options.html           # Advanced settings page
├── options.js             # Options page functionality
├── icons/                 # Extension icons (create these)
└── README.md              # This file
```

### Key Components

- **Content Script** (`content.js`): Detects tweets and injects save buttons
- **Background Script** (`background.js`): Handles API communication and storage
- **Popup** (`popup.html/js`): Quick configuration interface
- **Options Page** (`options.html/js`): Advanced settings and templates

### Development Tips

1. **Debugging**: Use Chrome DevTools on Twitter/X pages to see console logs
2. **Reload Extension**: After code changes, go to `chrome://extensions/` and click reload
3. **Test API**: Use the built-in API tester before saving real tweets
4. **Storage**: Configuration is stored in Chrome's sync storage

## 🐛 Troubleshooting

### Save Buttons Not Appearing

- Refresh the Twitter/X page
- Check that the extension is enabled in `chrome://extensions/`
- Open browser console and look for error messages
- Verify you're on twitter.com or x.com

### API Requests Failing

- Test your API endpoint using the built-in tester
- Check that your server has CORS headers configured:
  ```
  Access-Control-Allow-Origin: *
  Access-Control-Allow-Methods: POST
  Access-Control-Allow-Headers: Content-Type
  ```
- Verify your API accepts JSON and returns 2xx status codes
- Check browser console for detailed error messages

### Configuration Not Saving

- Ensure you click "Save Configuration" after making changes
- Check that Chrome sync is enabled for the extension
- Try clearing extension data and reconfiguring

## 🔒 Privacy & Security

- **No Data Collection**: The extension only sends data to your configured API
- **Local Storage**: Configuration is stored locally in Chrome sync storage
- **HTTPS Recommended**: Use HTTPS endpoints for secure data transmission
- **No External Requests**: The extension only communicates with your specified API

## 📝 License

This project is open source. Feel free to modify and distribute according to your needs.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

## 🆘 Support

If you encounter issues:

1. Check the troubleshooting section above
2. Look at browser console errors on Twitter/X pages
3. Test your API endpoint independently
4. Open an issue with detailed error information

---

**Happy tweeting and note-taking! 🐦📝**
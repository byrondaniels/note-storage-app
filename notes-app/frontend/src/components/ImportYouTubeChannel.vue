<template>
  <div class="import-youtube">
    <h1>Import YouTube Channel</h1>
    <p class="subtitle">Import video transcripts from a YouTube channel using the browser extension</p>

    <div v-if="!extensionAvailable" class="message error">
      <strong>Extension Not Found</strong>
      <p>The Social Media Note Saver extension is required for this feature.</p>
      <p>Please install the extension and reload this page.</p>
    </div>

    <form v-else @submit.prevent="startImport" class="import-form">
      <div class="form-group">
        <label for="channelUrl">YouTube Channel URL:</label>
        <input
          type="text"
          id="channelUrl"
          v-model="channelUrl"
          placeholder="https://www.youtube.com/@channelname or https://www.youtube.com/channel/..."
          :disabled="importing"
        />
      </div>

      <div class="form-group">
        <label for="videoLimit">Number of Videos:</label>
        <select id="videoLimit" v-model="videoLimit" :disabled="importing">
          <option value="5">5 videos</option>
          <option value="10">10 videos</option>
          <option value="20">20 videos</option>
          <option value="50">50 videos</option>
          <option value="100">100 videos</option>
        </select>
      </div>

      <button type="submit" :disabled="importing || !channelUrl.trim()">
        {{ importing ? 'Importing...' : 'Import Transcripts' }}
      </button>
    </form>

    <div v-if="progress.active" class="progress-section">
      <div class="progress-info">
        <span class="progress-text">
          Processing video {{ progress.current }} of {{ progress.total }}
        </span>
        <span v-if="progress.videoTitle" class="video-title">
          {{ progress.videoTitle }}
        </span>
      </div>
      <div class="progress-bar">
        <div class="progress-fill" :style="{ width: progressPercentage + '%' }"></div>
      </div>
      <div class="progress-percentage">{{ progressPercentage }}%</div>
    </div>

    <div v-if="message" :class="['message', messageType]">
      {{ message }}
    </div>
  </div>
</template>

<script>
const EXTENSION_ID = 'koodfochknchgnegkcmcfcidkfgdfgkc'

export default {
  name: 'ImportYouTubeChannel',
  data() {
    return {
      channelUrl: '',
      videoLimit: '20',
      importing: false,
      extensionAvailable: false,
      message: '',
      messageType: '',
      progress: {
        active: false,
        current: 0,
        total: 0,
        videoTitle: '',
        status: ''
      }
    }
  },
  computed: {
    progressPercentage() {
      if (this.progress.total === 0) return 0
      return Math.round((this.progress.current / this.progress.total) * 100)
    }
  },
  mounted() {
    this.checkExtension()
    this.setupMessageListener()
  },
  beforeUnmount() {
    if (this.messageListener) {
      window.removeEventListener('message', this.messageListener)
    }
  },
  methods: {
    checkExtension() {
      if (typeof chrome === 'undefined' || !chrome.runtime) {
        this.extensionAvailable = false
        return
      }

      // Try to send a ping message to check if extension is available
      try {
        chrome.runtime.sendMessage(EXTENSION_ID, { action: 'ping' }, (response) => {
          if (chrome.runtime.lastError) {
            console.log('Extension not available:', chrome.runtime.lastError.message)
            this.extensionAvailable = false
          } else {
            this.extensionAvailable = true
          }
        })
      } catch (error) {
        console.log('Extension check failed:', error)
        this.extensionAvailable = false
      }
    },

    setupMessageListener() {
      // Listen for messages from the extension's content script bridge
      this.messageListener = (event) => {
        // Only accept messages from our content script
        if (event.data && event.data.type === 'SOCIAL_MEDIA_SAVER_PROGRESS') {
          console.log('ImportYouTubeChannel: Received progress:', event.data.payload)
          this.handleProgress(event.data.payload)
        }
      }

      window.addEventListener('message', this.messageListener)
    },

    validateUrl(url) {
      try {
        const parsed = new URL(url)
        return parsed.hostname.includes('youtube.com')
      } catch {
        return false
      }
    },

    async startImport() {
      this.message = ''
      this.messageType = ''

      const url = this.channelUrl.trim()

      if (!url) {
        this.message = 'Please enter a YouTube channel URL'
        this.messageType = 'error'
        return
      }

      if (!this.validateUrl(url)) {
        this.message = 'Please enter a valid YouTube channel URL'
        this.messageType = 'error'
        return
      }

      this.importing = true
      this.progress = {
        active: true,
        current: 0,
        total: 0,
        videoTitle: '',
        status: 'Starting import...'
      }

      try {
        chrome.runtime.sendMessage(EXTENSION_ID, {
          action: 'importChannel',
          channelUrl: url,
          limit: parseInt(this.videoLimit)
        }, (response) => {
          if (chrome.runtime.lastError) {
            this.message = 'Failed to communicate with extension: ' + chrome.runtime.lastError.message
            this.messageType = 'error'
            this.importing = false
            this.progress.active = false
          }
        })
      } catch (error) {
        this.message = 'Error starting import: ' + error.message
        this.messageType = 'error'
        this.importing = false
        this.progress.active = false
      }
    },

    handleProgress(message) {
      const { current, total, status, videoTitle, completed, error, succeeded, skipped, failed } = message

      if (completed) {
        this.importing = false
        this.progress.active = false

        if (error) {
          this.message = `Import failed: ${error}`
          this.messageType = 'error'
        } else {
          const parts = []
          if (succeeded > 0) parts.push(`${succeeded} imported`)
          if (skipped > 0) parts.push(`${skipped} skipped`)
          if (failed > 0) parts.push(`${failed} failed`)

          this.message = `Import complete! ${parts.join(', ')}`
          this.messageType = succeeded > 0 ? 'success' : 'warning'
        }
        return
      }

      this.progress = {
        active: true,
        current: current || 0,
        total: total || 0,
        videoTitle: videoTitle || '',
        status: status || ''
      }
    }
  }
}
</script>

<style scoped>
.import-youtube {
  max-width: 600px;
  margin: 0 auto;
  padding: 20px;
}

h1 {
  text-align: center;
  color: #2c3e50;
  margin-bottom: 10px;
}

.subtitle {
  text-align: center;
  color: #666;
  margin-bottom: 30px;
  font-style: italic;
}

.import-form {
  background: #f9f9f9;
  padding: 30px;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
}

.form-group {
  margin-bottom: 20px;
}

label {
  display: block;
  margin-bottom: 5px;
  font-weight: bold;
  color: #333;
}

input[type="text"],
select {
  width: 100%;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 16px;
  box-sizing: border-box;
}

select {
  background-color: white;
  cursor: pointer;
}

button {
  background-color: #ff0000;
  color: white;
  padding: 12px 24px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 16px;
  transition: background-color 0.3s;
  width: 100%;
}

button:hover:not(:disabled) {
  background-color: #cc0000;
}

button:disabled {
  background-color: #ccc;
  cursor: not-allowed;
}

.progress-section {
  margin-top: 20px;
  padding: 20px;
  background: #f0f8ff;
  border-radius: 8px;
  border: 1px solid #b3d9ff;
}

.progress-info {
  margin-bottom: 10px;
}

.progress-text {
  display: block;
  font-weight: bold;
  color: #333;
}

.video-title {
  display: block;
  color: #666;
  font-size: 14px;
  margin-top: 5px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.progress-bar {
  height: 20px;
  background: #e0e0e0;
  border-radius: 10px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #ff0000, #ff4444);
  transition: width 0.3s ease;
  border-radius: 10px;
}

.progress-percentage {
  text-align: center;
  margin-top: 5px;
  font-weight: bold;
  color: #333;
}

.message {
  margin-top: 20px;
  padding: 15px;
  border-radius: 4px;
  text-align: center;
}

.message.success {
  background-color: #d4edda;
  color: #155724;
  border: 1px solid #c3e6cb;
}

.message.error {
  background-color: #f8d7da;
  color: #721c24;
  border: 1px solid #f5c6cb;
}

.message.warning {
  background-color: #fff3cd;
  color: #856404;
  border: 1px solid #ffeeba;
}

.message.error strong {
  display: block;
  margin-bottom: 10px;
}

.message.error p {
  margin: 5px 0;
}
</style>

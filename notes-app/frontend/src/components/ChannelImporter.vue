<template>
  <div class="import-section">
    <h2>Import YouTube Channel</h2>

    <div v-if="!extensionAvailable" class="extension-warning">
      <strong>Extension Not Found</strong>
      <p>The Social Media Note Saver extension is required for importing.</p>
    </div>

    <div v-else class="import-form">
      <div class="import-row">
        <div class="form-group flex-grow">
          <label for="channelUrl">YouTube Channel URL:</label>
          <input
            type="text"
            id="channelUrl"
            v-model="channelUrl"
            placeholder="https://www.youtube.com/@channelname"
            :disabled="importing"
          />
        </div>

        <div class="form-group video-limit">
          <label for="videoLimit">Videos:</label>
          <select id="videoLimit" v-model="videoLimit" :disabled="importing">
            <option value="5">5</option>
            <option value="10">10</option>
            <option value="20">20</option>
            <option value="50">50</option>
            <option value="100">100</option>
          </select>
        </div>
      </div>

      <div class="form-group">
        <label>Prompt Template:</label>
        <div class="prompt-template-row">
          <select v-model="promptTemplate" @change="onTemplateChange" :disabled="importing" class="template-select">
            <option value="default">Default</option>
            <option v-for="ch in channelsWithCustomPrompts" :key="ch.name" :value="ch.name">
              {{ ch.name }}
            </option>
            <option value="custom">Custom</option>
          </select>
        </div>
      </div>

      <div class="form-group">
        <label>Prompt Text:</label>
        <div v-if="promptTemplate !== 'custom'" class="prompt-readonly">
          {{ promptTextDisplay }}
        </div>
        <textarea
          v-else
          v-model="promptText"
          placeholder="Enter instructions for how to analyze and summarize the content..."
          rows="4"
          :disabled="importing"
          class="prompt-textarea"
        ></textarea>
      </div>

      <div class="form-group">
        <label>Output Schema (JSON):</label>
        <div v-if="promptTemplate !== 'custom'" class="prompt-readonly schema-readonly">
          {{ promptSchemaDisplay }}
        </div>
        <textarea
          v-else
          v-model="promptSchema"
          placeholder='{"summary": "string", "key_points": ["string"]}'
          rows="6"
          :disabled="importing"
          class="prompt-textarea schema-textarea"
          @blur="validateSchemaInput"
        ></textarea>
        <p v-if="schemaError" class="schema-error">{{ schemaError }}</p>
        <p class="help-text">Define the JSON structure for extracted data. Must include a "summary" field.</p>
      </div>

      <button
        @click="startImport"
        :disabled="importing || !channelUrl.trim()"
        class="import-btn"
      >
        {{ importing ? 'Importing...' : 'Import Transcripts' }}
      </button>
    </div>

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

    <div v-if="message" :class="['import-message', messageType]">
      {{ message }}
    </div>
  </div>
</template>

<script>
export default {
  name: 'ChannelImporter',
  props: {
    extensionAvailable: {
      type: Boolean,
      required: true
    },
    channelsWithCustomPrompts: {
      type: Array,
      default: () => []
    },
    channelSettings: {
      type: Object,
      default: () => ({})
    },
    defaultPromptText: {
      type: String,
      required: true
    },
    defaultPromptSchema: {
      type: String,
      required: true
    }
  },
  data() {
    return {
      channelUrl: '',
      videoLimit: '20',
      promptTemplate: 'default',
      promptText: '',
      promptSchema: '',
      schemaError: '',
      importing: false,
      progress: {
        active: false,
        current: 0,
        total: 0,
        videoTitle: ''
      },
      message: '',
      messageType: ''
    }
  },
  computed: {
    progressPercentage() {
      if (this.progress.total === 0) return 0
      return Math.round((this.progress.current / this.progress.total) * 100)
    },
    promptTextDisplay() {
      if (this.promptTemplate === 'default') {
        return this.defaultPromptText
      } else if (this.promptTemplate !== 'custom') {
        const sourceSettings = this.channelSettings[this.promptTemplate]
        if (sourceSettings && sourceSettings.promptText) {
          return sourceSettings.promptText
        }
      }
      return this.defaultPromptText
    },
    promptSchemaDisplay() {
      if (this.promptTemplate === 'default') {
        return this.defaultPromptSchema
      } else if (this.promptTemplate !== 'custom') {
        const sourceSettings = this.channelSettings[this.promptTemplate]
        if (sourceSettings && sourceSettings.promptSchema) {
          return sourceSettings.promptSchema
        }
      }
      return this.defaultPromptSchema
    }
  },
  methods: {
    onTemplateChange() {
      if (this.promptTemplate === 'custom') {
        if (!this.promptText) this.promptText = ''
        if (!this.promptSchema) this.promptSchema = ''
      }
      this.schemaError = ''
    },
    validateSchemaInput() {
      this.schemaError = this.validateSchema(this.promptSchema) || ''
    },
    validateSchema(schemaString) {
      if (!schemaString || !schemaString.trim()) {
        return null
      }
      try {
        JSON.parse(schemaString)
        return null
      } catch (e) {
        return e.message
      }
    },
    startImport() {
      const url = this.channelUrl.trim()

      if (!url) {
        this.message = 'Please enter a YouTube channel URL'
        this.messageType = 'error'
        return
      }

      try {
        const parsed = new URL(url)
        if (!parsed.hostname.includes('youtube.com')) {
          this.message = 'Please enter a valid YouTube channel URL'
          this.messageType = 'error'
          return
        }
      } catch {
        this.message = 'Please enter a valid YouTube channel URL'
        this.messageType = 'error'
        return
      }

      let promptTextToUse = ''
      let promptSchemaToUse = ''

      if (this.promptTemplate === 'custom') {
        promptTextToUse = this.promptText
        promptSchemaToUse = this.promptSchema

        if (promptSchemaToUse && promptSchemaToUse.trim()) {
          const schemaError = this.validateSchema(promptSchemaToUse)
          if (schemaError) {
            this.message = 'Invalid JSON schema: ' + schemaError
            this.messageType = 'error'
            return
          }
        }
      } else if (this.promptTemplate !== 'default') {
        const sourceSettings = this.channelSettings[this.promptTemplate]
        if (sourceSettings) {
          promptTextToUse = sourceSettings.promptText || ''
          promptSchemaToUse = sourceSettings.promptSchema || ''
        }
      }

      this.$emit('import-start', {
        channelUrl: url,
        videoLimit: parseInt(this.videoLimit),
        promptText: promptTextToUse,
        promptSchema: promptSchemaToUse
      })
    },
    updateProgress(progressData) {
      this.progress = progressData
    },
    setImportingState(state) {
      this.importing = state
    },
    setMessage(msg, type) {
      this.message = msg
      this.messageType = type
    },
    clearMessage() {
      this.message = ''
      this.messageType = ''
    }
  }
}
</script>

<style scoped>
.import-section {
  background: #f9f9f9;
  border-radius: 8px;
  padding: 24px;
  margin-bottom: 30px;
  border: 1px solid #e0e0e0;
}

.import-section h2 {
  margin: 0 0 16px 0;
  font-size: 18px;
  color: #333;
}

.extension-warning {
  background: #fff3cd;
  border: 1px solid #ffeeba;
  border-radius: 6px;
  padding: 16px;
  color: #856404;
}

.extension-warning strong {
  display: block;
  margin-bottom: 8px;
}

.extension-warning p {
  margin: 0;
  font-size: 14px;
}

.import-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.import-row {
  display: flex;
  gap: 16px;
  align-items: flex-end;
}

.flex-grow {
  flex: 1;
}

.video-limit {
  width: 100px;
}

.import-form input[type="text"],
.import-form select {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
  box-sizing: border-box;
}

.import-form label {
  display: block;
  font-weight: 500;
  margin-bottom: 6px;
  color: #333;
  font-size: 14px;
}

.prompt-template-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}

.template-select {
  padding: 6px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  background: white;
  cursor: pointer;
}

.template-select:focus {
  outline: none;
  border-color: #007AFF;
}

.prompt-textarea {
  width: 100%;
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 13px;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  line-height: 1.5;
  resize: vertical;
  box-sizing: border-box;
}

.prompt-textarea:focus {
  outline: none;
  border-color: #007AFF;
}

.prompt-readonly {
  background: #f5f5f5;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  padding: 12px;
  font-size: 13px;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  line-height: 1.5;
  color: #555;
  white-space: pre-wrap;
  max-height: 150px;
  overflow-y: auto;
}

.schema-readonly,
.schema-textarea {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 12px;
}

.schema-error {
  color: #dc3545;
  font-size: 13px;
  margin-top: 4px;
  margin-bottom: 0;
}

.help-text {
  font-size: 13px;
  color: #666;
  margin-top: 8px;
}

.import-btn {
  background: #ff0000;
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
  align-self: flex-start;
}

.import-btn:hover:not(:disabled) {
  background: #cc0000;
}

.import-btn:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.progress-section {
  margin-top: 16px;
  padding: 16px;
  background: #e3f2fd;
  border-radius: 6px;
  border: 1px solid #90caf9;
}

.progress-info {
  margin-bottom: 10px;
}

.progress-text {
  display: block;
  font-weight: 500;
  color: #333;
  font-size: 14px;
}

.video-title {
  display: block;
  color: #666;
  font-size: 13px;
  margin-top: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.progress-bar {
  height: 16px;
  background: #e0e0e0;
  border-radius: 8px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #ff0000, #ff4444);
  transition: width 0.3s ease;
  border-radius: 8px;
}

.progress-percentage {
  text-align: center;
  margin-top: 6px;
  font-weight: 500;
  color: #333;
  font-size: 13px;
}

.import-message {
  margin-top: 16px;
  padding: 12px 16px;
  border-radius: 6px;
  font-size: 14px;
}

.import-message.success {
  background: #d4edda;
  color: #155724;
  border: 1px solid #c3e6cb;
}

.import-message.error {
  background: #f8d7da;
  color: #721c24;
  border: 1px solid #f5c6cb;
}

.import-message.warning {
  background: #fff3cd;
  color: #856404;
  border: 1px solid #ffeeba;
}

.form-group {
  margin-bottom: 0;
}
</style>

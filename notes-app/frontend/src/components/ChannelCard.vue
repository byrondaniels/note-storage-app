<template>
  <div class="channel-card" :class="{ 'expanded': isExpanded }">
    <!-- Collapsed Header -->
    <div class="channel-header" @click="toggleExpand">
      <div class="channel-info">
        <span class="platform-icon">{{ platformIcon }}</span>
        <span class="channel-name">{{ channel.name }}</span>
        <span class="note-count">{{ channel.noteCount }} notes</span>
      </div>
      <div class="channel-actions">
        <button
          v-if="channel.platform === 'youtube' && extensionAvailable && !isExpanded"
          @click.stop="quickSync"
          class="quick-sync-btn"
          title="Sync new videos"
        >
          Sync
        </button>
        <span v-if="hasCustomPrompt" class="custom-badge">Custom</span>
        <span class="expand-icon">{{ isExpanded ? '▼' : '▶' }}</span>
      </div>
    </div>

    <!-- Expanded Content -->
    <div v-if="isExpanded" class="channel-content">
      <!-- Quick Actions Bar -->
      <div class="quick-actions">
        <SyncVideos
          v-if="channel.platform === 'youtube'"
          :channel="channel"
          :extensionAvailable="extensionAvailable"
          :channelUrl="channelUrl"
          :progress="syncProgress"
          @sync-start="$emit('sync-start', $event)"
        />
      </div>

      <!-- Advanced Settings Toggle -->
      <div class="advanced-toggle" @click="showAdvanced = !showAdvanced">
        <span class="toggle-icon">{{ showAdvanced ? '▼' : '▶' }}</span>
        <span class="toggle-label">Advanced Settings</span>
      </div>

      <!-- Advanced Settings Content -->
      <div v-if="showAdvanced" class="advanced-content">
        <!-- Prompt Settings -->
        <div class="settings-section">
          <h4>Summary Prompt</h4>

          <div class="form-group">
            <label>Template:</label>
            <select
              v-model="templateSource"
              @change="onTemplateChange"
              class="template-select"
            >
              <option value="default">Default</option>
              <option
                v-for="ch in otherChannelsWithPrompts"
                :key="ch.name"
                :value="ch.name"
              >
                {{ ch.name }}
              </option>
              <option value="custom">Custom</option>
            </select>
          </div>

          <div class="form-group">
            <label>Prompt Text:</label>
            <div v-if="templateSource !== 'custom'" class="prompt-readonly">
              {{ promptTextDisplay }}
            </div>
            <textarea
              v-else
              v-model="promptText"
              placeholder="Enter instructions for how to analyze and summarize the content..."
              rows="3"
              class="prompt-textarea"
            ></textarea>
          </div>

          <div class="form-group">
            <label>Output Schema (JSON):</label>
            <div v-if="templateSource !== 'custom'" class="prompt-readonly schema-readonly">
              {{ promptSchemaDisplay }}
            </div>
            <textarea
              v-else
              v-model="promptSchema"
              placeholder='{"summary": "string", "key_points": ["string"]}'
              rows="4"
              class="prompt-textarea schema-textarea"
            ></textarea>
          </div>

          <div class="form-actions">
            <button
              @click="saveSettings"
              :disabled="saving"
              class="save-btn"
            >
              {{ saving ? 'Saving...' : 'Save Settings' }}
            </button>
            <span v-if="showSaved" class="saved-indicator">Saved!</span>
          </div>
        </div>

        <!-- Resummarize Section -->
        <ResummarizePanel
          :channel="channel"
          :notes="notes"
          :loadingNotes="loadingNotes"
          :templateSource="templateSource"
          :promptText="promptText"
          :promptSchema="promptSchema"
          :channelSettings="channelSettings"
          @refresh-summary="$emit('refresh-summary', $event)"
        />

        <!-- Danger Zone -->
        <div class="danger-zone">
          <h4>Danger Zone</h4>
          <p>Permanently delete all notes from this channel.</p>
          <button @click="$emit('delete-channel', channel)" class="delete-all-btn">
            Delete All Notes
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import SyncVideos from './SyncVideos.vue'
import ResummarizePanel from './ResummarizePanel.vue'

export default {
  name: 'ChannelCard',
  components: {
    SyncVideos,
    ResummarizePanel
  },
  props: {
    channel: {
      type: Object,
      required: true
    },
    isExpanded: {
      type: Boolean,
      default: false
    },
    channelSettings: {
      type: Object,
      default: () => ({})
    },
    otherChannelsWithPrompts: {
      type: Array,
      default: () => []
    },
    defaultPromptText: {
      type: String,
      required: true
    },
    defaultPromptSchema: {
      type: String,
      required: true
    },
    extensionAvailable: {
      type: Boolean,
      required: true
    },
    notes: {
      type: Array,
      default: () => []
    },
    loadingNotes: {
      type: Boolean,
      default: false
    },
    syncProgress: {
      type: Object,
      default: () => ({
        active: false,
        channelName: '',
        current: 0,
        total: 0,
        videoTitle: ''
      })
    }
  },
  data() {
    return {
      showAdvanced: false,
      templateSource: 'default',
      promptText: '',
      promptSchema: '',
      saving: false,
      showSaved: false
    }
  },
  computed: {
    platformIcon() {
      switch (this.channel.platform) {
        case 'youtube': return '📺'
        case 'twitter': return '🐦'
        case 'linkedin': return '💼'
        default: return '📝'
      }
    },
    hasCustomPrompt() {
      const settings = this.channelSettings[this.channel.name]
      return settings && (settings.promptText || settings.promptSchema)
    },
    channelUrl() {
      return this.channelSettings[this.channel.name]?.channelUrl || ''
    },
    promptTextDisplay() {
      if (this.templateSource === 'default') {
        return this.defaultPromptText
      } else if (this.templateSource && this.templateSource !== 'custom') {
        const sourceSettings = this.channelSettings[this.templateSource]
        if (sourceSettings && sourceSettings.promptText) {
          return sourceSettings.promptText
        }
      }
      return this.defaultPromptText
    },
    promptSchemaDisplay() {
      if (this.templateSource === 'default') {
        return this.defaultPromptSchema
      } else if (this.templateSource && this.templateSource !== 'custom') {
        const sourceSettings = this.channelSettings[this.templateSource]
        if (sourceSettings && sourceSettings.promptSchema) {
          return sourceSettings.promptSchema
        }
      }
      return this.defaultPromptSchema
    }
  },
  watch: {
    isExpanded(newVal) {
      if (newVal) {
        this.initializeSettings()
      } else {
        this.showAdvanced = false
      }
    }
  },
  mounted() {
    this.initializeSettings()
  },
  methods: {
    initializeSettings() {
      const existing = this.channelSettings[this.channel.name]
      const hasCustomPrompt = existing?.promptText || existing?.promptSchema
      this.templateSource = hasCustomPrompt ? 'custom' : 'default'
      this.promptText = existing?.promptText || ''
      this.promptSchema = existing?.promptSchema || ''
    },
    toggleExpand() {
      this.$emit('toggle-expand', this.channel.name)
    },
    quickSync() {
      this.$emit('sync-start', { channel: this.channel, videoLimit: 10 })
    },
    onTemplateChange() {
      if (this.templateSource === 'custom') {
        if (!this.promptText) {
          this.promptText = ''
        }
        if (!this.promptSchema) {
          this.promptSchema = ''
        }
      }
    },
    async saveSettings() {
      this.saving = true
      this.showSaved = false

      try {
        let promptTextToSave = ''
        let promptSchemaToSave = ''

        if (this.templateSource === 'custom') {
          promptTextToSave = this.promptText
          promptSchemaToSave = this.promptSchema

          if (promptSchemaToSave && promptSchemaToSave.trim()) {
            const schemaError = this.validateSchema(promptSchemaToSave)
            if (schemaError) {
              alert('Invalid JSON schema: ' + schemaError)
              return
            }
          }
        } else if (this.templateSource !== 'default') {
          const sourceSettings = this.channelSettings[this.templateSource]
          if (sourceSettings) {
            promptTextToSave = sourceSettings.promptText || ''
            promptSchemaToSave = sourceSettings.promptSchema || ''
          }
        }

        await this.$emit('save-settings', {
          channel: this.channel,
          promptText: promptTextToSave,
          promptSchema: promptSchemaToSave
        })

        this.showSaved = true
        setTimeout(() => {
          this.showSaved = false
        }, 2000)
      } finally {
        this.saving = false
      }
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
    }
  }
}
</script>

<style scoped>
.channel-card {
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 10px;
  overflow: hidden;
  transition: all 0.2s;
}

.channel-card:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.channel-card.expanded {
  border-color: #007AFF;
  box-shadow: 0 4px 12px rgba(0, 122, 255, 0.15);
}

/* Header */
.channel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  cursor: pointer;
  transition: background 0.2s;
}

.channel-header:hover {
  background: #f8f8f8;
}

.channel-card.expanded .channel-header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.channel-card.expanded .channel-header:hover {
  background: linear-gradient(135deg, #5a6fd6 0%, #6a4190 100%);
}

.channel-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.platform-icon {
  font-size: 22px;
}

.channel-name {
  font-weight: 600;
  font-size: 16px;
}

.note-count {
  font-size: 13px;
  opacity: 0.7;
}

.channel-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.quick-sync-btn {
  background: #007AFF;
  color: white;
  border: none;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
}

.quick-sync-btn:hover {
  background: #0056b3;
}

.custom-badge {
  background: #28a745;
  color: white;
  padding: 3px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.channel-card.expanded .custom-badge {
  background: rgba(255, 255, 255, 0.25);
}

.expand-icon {
  font-size: 11px;
  opacity: 0.6;
  margin-left: 4px;
}

/* Content */
.channel-content {
  border-top: 1px solid #e5e5e5;
}

.quick-actions {
  padding: 16px 20px;
  background: #fafafa;
  border-bottom: 1px solid #e5e5e5;
}

/* Advanced Toggle */
.advanced-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 14px 20px;
  cursor: pointer;
  color: #666;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s;
  border-bottom: 1px solid #f0f0f0;
}

.advanced-toggle:hover {
  background: #f8f8f8;
  color: #333;
}

.toggle-icon {
  font-size: 10px;
  color: #999;
}

.toggle-label {
  color: inherit;
}

/* Advanced Content */
.advanced-content {
  padding: 20px;
}

.settings-section {
  margin-bottom: 24px;
}

.settings-section h4 {
  margin: 0 0 16px 0;
  font-size: 14px;
  font-weight: 600;
  color: #333;
}

.form-group {
  margin-bottom: 16px;
}

.form-group > label {
  display: block;
  font-weight: 500;
  margin-bottom: 8px;
  color: #555;
  font-size: 13px;
}

.template-select {
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
  background: white;
  cursor: pointer;
  min-width: 150px;
}

.template-select:focus {
  outline: none;
  border-color: #007AFF;
}

.prompt-textarea {
  width: 100%;
  padding: 10px 12px;
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
  padding: 10px 12px;
  font-size: 13px;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  line-height: 1.5;
  color: #666;
  white-space: pre-wrap;
  max-height: 100px;
  overflow-y: auto;
}

.schema-readonly,
.schema-textarea {
  font-size: 12px;
}

.form-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 16px;
}

.save-btn {
  background: #007AFF;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
}

.save-btn:hover:not(:disabled) {
  background: #0056b3;
}

.save-btn:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.saved-indicator {
  color: #28a745;
  font-weight: 500;
  font-size: 14px;
}

/* Danger Zone */
.danger-zone {
  margin-top: 24px;
  padding: 16px;
  background: #fff5f5;
  border: 1px solid #fed7d7;
  border-radius: 8px;
}

.danger-zone h4 {
  color: #c53030;
  margin: 0 0 8px 0;
  font-size: 14px;
  font-weight: 600;
}

.danger-zone p {
  color: #742a2a;
  font-size: 13px;
  margin: 0 0 12px 0;
}

.delete-all-btn {
  background: #dc3545;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
}

.delete-all-btn:hover {
  background: #c82333;
}
</style>

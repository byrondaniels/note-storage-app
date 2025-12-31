<template>
  <div class="channel-settings">
    <h1>Channel Settings</h1>
    <p class="subtitle">Import YouTube channels and configure custom summary prompts</p>

    <!-- Import YouTube Channel Section -->
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
              v-model="importChannelUrl"
              placeholder="https://www.youtube.com/@channelname"
              :disabled="importing"
            />
          </div>

          <div class="form-group video-limit">
            <label for="videoLimit">Videos:</label>
            <select id="videoLimit" v-model="importVideoLimit" :disabled="importing">
              <option value="5">5</option>
              <option value="10">10</option>
              <option value="20">20</option>
              <option value="50">50</option>
              <option value="100">100</option>
            </select>
          </div>
        </div>

        <div class="form-group">
          <label>Summary Prompt:</label>
          <div class="prompt-template-row">
            <select v-model="importPromptTemplate" @change="onImportTemplateChange" :disabled="importing" class="template-select">
              <option value="default">Default</option>
              <option v-for="ch in channelsWithCustomPrompts" :key="ch.name" :value="ch.name">
                {{ ch.name }}
              </option>
              <option value="custom">Custom</option>
            </select>
          </div>
          <div v-if="importPromptTemplate !== 'custom'" class="prompt-readonly">
            {{ importPromptDisplay }}
          </div>
          <textarea
            v-else
            v-model="importCustomPrompt"
            placeholder="Enter your custom summary prompt. The transcript will be appended automatically."
            rows="6"
            :disabled="importing"
            class="prompt-textarea"
          ></textarea>
          <p class="help-text">The video transcript will be appended when generating summaries.</p>
        </div>

        <button
          @click="startImport"
          :disabled="importing || !importChannelUrl.trim()"
          class="import-btn"
        >
          {{ importing ? 'Importing...' : 'Import Transcripts' }}
        </button>
      </div>

      <div v-if="importProgress.active" class="progress-section">
        <div class="progress-info">
          <span class="progress-text">
            Processing video {{ importProgress.current }} of {{ importProgress.total }}
          </span>
          <span v-if="importProgress.videoTitle" class="video-title">
            {{ importProgress.videoTitle }}
          </span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill" :style="{ width: importProgressPercentage + '%' }"></div>
        </div>
        <div class="progress-percentage">{{ importProgressPercentage }}%</div>
      </div>

      <div v-if="importMessage" :class="['import-message', importMessageType]">
        {{ importMessage }}
      </div>
    </div>

    <!-- Delete Confirmation Modal -->
    <div v-if="showDeleteModal" class="modal-overlay" @click.self="showDeleteModal = false">
      <div class="modal-content">
        <h2>Delete All Notes</h2>
        <p>Are you sure you want to delete all <strong>{{ channelToDelete?.noteCount }}</strong> notes from <strong>{{ channelToDelete?.name }}</strong>?</p>
        <p class="warning">This action cannot be undone.</p>
        <div class="modal-actions">
          <button @click="showDeleteModal = false" class="cancel-btn">Cancel</button>
          <button @click="confirmDelete" :disabled="deleting" class="delete-btn">
            {{ deleting ? 'Deleting...' : 'Delete All' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Prompt Templates Section -->
    <div class="templates-section">
      <h2>Prompt Templates</h2>
      <p class="section-desc">Manage saved prompts. These persist even when channel notes are deleted.</p>

      <div v-if="savedTemplates.length === 0" class="no-templates">
        <p>No custom prompts saved yet. Import a channel or save settings to create one.</p>
      </div>

      <div v-else class="templates-list">
        <div
          v-for="template in savedTemplates"
          :key="template.channelName"
          class="template-card"
          :class="{ 'expanded': expandedTemplate === template.channelName }"
        >
          <div class="template-header" @click="toggleTemplate(template.channelName)">
            <span class="template-name">{{ template.channelName }}</span>
            <span class="expand-icon">{{ expandedTemplate === template.channelName ? '▼' : '▶' }}</span>
          </div>

          <div v-if="expandedTemplate === template.channelName" class="template-content">
            <div class="form-group">
              <label>Custom Prompt:</label>
              <textarea
                v-model="editingTemplates[template.channelName]"
                placeholder="Enter your custom summary prompt..."
                rows="6"
                class="prompt-textarea"
              ></textarea>
            </div>
            <div class="template-actions">
              <button
                @click="saveTemplate(template.channelName)"
                :disabled="savingTemplate === template.channelName"
                class="save-btn"
              >
                {{ savingTemplate === template.channelName ? 'Saving...' : 'Save' }}
              </button>
              <button
                @click="deleteTemplate(template.channelName)"
                :disabled="deletingTemplate === template.channelName"
                class="delete-template-btn"
              >
                {{ deletingTemplate === template.channelName ? 'Deleting...' : 'Delete Prompt' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Channels Section -->
    <div class="channels-section">
      <h2>Channels</h2>
      <p class="section-desc">Channels with imported notes.</p>

      <div v-if="loading" class="loading">Loading channels...</div>

      <div v-else-if="channels.length === 0" class="no-channels">
        <p>No channels with notes yet. Import some YouTube videos to get started.</p>
      </div>

      <div v-else class="channels-list">
      <div
        v-for="channel in channels"
        :key="channel.name"
        class="channel-card"
        :class="{ 'expanded': expandedChannel === channel.name }"
      >
        <div class="channel-header" @click="toggleChannel(channel.name)">
          <div class="channel-info">
            <span class="platform-icon">
              {{ channel.platform === 'youtube' ? '📺' : channel.platform === 'twitter' ? '🐦' : channel.platform === 'linkedin' ? '💼' : '📝' }}
            </span>
            <span class="channel-name">{{ channel.name }}</span>
            <span class="note-count">{{ channel.noteCount }} notes</span>
          </div>
          <div class="channel-status">
            <span v-if="getChannelSetting(channel.name)?.summaryMode === 'custom'" class="custom-badge">Custom</span>
            <span class="expand-icon">{{ expandedChannel === channel.name ? '▼' : '▶' }}</span>
          </div>
        </div>

        <div v-if="expandedChannel === channel.name" class="channel-settings-form">
          <div class="form-group">
            <label>Summary Prompt:</label>
            <div class="prompt-template-row">
              <select
                v-model="editingSettings[channel.name].templateSource"
                @change="onChannelTemplateChange(channel.name)"
                class="template-select"
              >
                <option value="default">Default</option>
                <option
                  v-for="ch in getOtherChannelsWithPrompts(channel.name)"
                  :key="ch.name"
                  :value="ch.name"
                >
                  {{ ch.name }}
                </option>
                <option value="custom">Custom</option>
              </select>
            </div>
            <div v-if="editingSettings[channel.name].templateSource !== 'custom'" class="prompt-readonly">
              {{ getChannelPromptDisplay(channel.name) }}
            </div>
            <textarea
              v-else
              v-model="editingSettings[channel.name].customPrompt"
              placeholder="Enter your custom summary prompt. The transcript will be appended automatically."
              rows="6"
              class="prompt-textarea"
            ></textarea>
            <p class="help-text">The video transcript will be appended when generating summaries.</p>
          </div>

          <div class="form-actions">
            <button
              @click="saveSettings(channel)"
              :disabled="saving === channel.name"
              class="save-btn"
            >
              {{ saving === channel.name ? 'Saving...' : 'Save Settings' }}
            </button>
            <span v-if="savedChannel === channel.name" class="saved-indicator">Saved!</span>
          </div>

          <div class="resummary-section">
            <h4>Refresh Note Summary</h4>
            <p>Select a note and regenerate its summary using the current prompt settings.</p>

            <div v-if="loadingNotes === channel.name" class="loading-notes">
              Loading notes...
            </div>

            <div v-else-if="channelNotes[channel.name]?.length > 0" class="resummary-controls">
              <select v-model="selectedNote[channel.name]" class="note-select">
                <option value="">Select a note...</option>
                <option
                  v-for="note in channelNotes[channel.name]"
                  :key="note.id"
                  :value="note.id"
                >
                  {{ note.title || 'Untitled' }}
                </option>
              </select>
              <button
                @click="refreshSummary(channel)"
                :disabled="!selectedNote[channel.name] || refreshingSummary === channel.name"
                class="refresh-btn"
              >
                {{ refreshingSummary === channel.name ? 'Refreshing...' : 'Refresh Summary' }}
              </button>
            </div>

            <div v-else-if="channelNotes[channel.name]" class="no-notes">
              No notes found for this channel.
            </div>
          </div>

          <div class="danger-zone">
            <h4>Danger Zone</h4>
            <p>Delete all notes from this channel. This cannot be undone.</p>
            <button @click="promptDelete(channel)" class="delete-all-btn">
              Delete All Notes
            </button>
          </div>
        </div>
      </div>
      </div>
    </div>
  </div>
</template>

<script>
import axios from 'axios'

const API_URL = process.env.VUE_APP_API_URL || 'http://localhost:8080'
const EXTENSION_ID = 'koodfochknchgnegkcmcfcidkfgdfgkc'

const DEFAULT_PROMPT = `Please provide a concise and well-formatted summary of the following content. The summary should:

1. Be concise and to-the-point - avoid unnecessary words
2. If the content includes lists or multiple points, clearly outline each point with bullet points or numbered lists
3. Use proper spacing with line breaks between different sections or topics
4. Structure the information logically with clear paragraphs
5. Capture the key takeaways and main ideas
6. If there are actionable items or recommendations, list them clearly
7. Maintain the essential context but eliminate redundancy

Format your response with:
- Clear paragraph breaks between different topics
- Bullet points (•) or numbered lists when covering multiple items
- Proper spacing for readability`

export default {
  name: 'ChannelSettings',
  data() {
    return {
      channels: [],
      channelSettings: {},
      editingSettings: {},
      loading: true,
      expandedChannel: null,
      saving: null,
      savedChannel: null,
      showDeleteModal: false,
      channelToDelete: null,
      deleting: false,
      // Note resummary
      channelNotes: {},
      loadingNotes: null,
      selectedNote: {},
      refreshingSummary: null,
      // Import functionality
      extensionAvailable: false,
      importing: false,
      importChannelUrl: '',
      importVideoLimit: '20',
      importPromptTemplate: 'default',
      importCustomPrompt: '',
      importProgress: {
        active: false,
        current: 0,
        total: 0,
        videoTitle: ''
      },
      importMessage: '',
      importMessageType: '',
      // Template management
      expandedTemplate: null,
      editingTemplates: {},
      savingTemplate: null,
      deletingTemplate: null
    }
  },
  computed: {
    savedTemplates() {
      // Return all saved channel settings as an array
      return Object.values(this.channelSettings).filter(s => s && s.customPrompt)
    },
    channelsWithCustomPrompts() {
      return this.channels.filter(ch => {
        const settings = this.channelSettings[ch.name]
        return settings && settings.customPrompt && settings.customPrompt.trim() !== ''
      })
    },
    importProgressPercentage() {
      if (this.importProgress.total === 0) return 0
      return Math.round((this.importProgress.current / this.importProgress.total) * 100)
    },
    importPromptDisplay() {
      if (this.importPromptTemplate === 'default') {
        return DEFAULT_PROMPT
      } else if (this.importPromptTemplate !== 'custom') {
        const sourceSettings = this.channelSettings[this.importPromptTemplate]
        if (sourceSettings && sourceSettings.customPrompt) {
          return sourceSettings.customPrompt
        }
      }
      return DEFAULT_PROMPT
    }
  },
  async mounted() {
    await this.loadData()
    this.checkExtension()
    this.setupMessageListener()
  },
  beforeUnmount() {
    if (this.messageListener) {
      window.removeEventListener('message', this.messageListener)
    }
  },
  methods: {
    async loadData() {
      this.loading = true
      try {
        // Load channels and settings in parallel
        const [channelsRes, settingsRes] = await Promise.all([
          axios.get(`${API_URL}/channels`),
          axios.get(`${API_URL}/channel-settings`)
        ])

        this.channels = channelsRes.data || []

        // Index settings by channel name
        const settings = settingsRes.data || []
        this.channelSettings = {}
        for (const s of settings) {
          this.channelSettings[s.channelName] = s
        }

        // Initialize editing state for each channel
        this.editingSettings = {}
        for (const channel of this.channels) {
          const existing = this.channelSettings[channel.name]
          const hasCustomPrompt = existing?.customPrompt && existing.customPrompt.trim() !== ''
          this.editingSettings[channel.name] = {
            // If channel has custom prompt, show as "custom", otherwise "default"
            templateSource: hasCustomPrompt ? 'custom' : 'default',
            customPrompt: hasCustomPrompt ? existing.customPrompt : ''
          }
        }

        // Initialize editing state for templates
        this.editingTemplates = {}
        for (const s of settings) {
          if (s.customPrompt) {
            this.editingTemplates[s.channelName] = s.customPrompt
          }
        }
      } catch (error) {
        console.error('Failed to load channel data:', error)
      } finally {
        this.loading = false
      }
    },

    getChannelSetting(channelName) {
      return this.channelSettings[channelName]
    },

    // Template management methods
    toggleTemplate(channelName) {
      if (this.expandedTemplate === channelName) {
        this.expandedTemplate = null
      } else {
        this.expandedTemplate = channelName
      }
    },

    async saveTemplate(channelName) {
      this.savingTemplate = channelName
      try {
        const prompt = this.editingTemplates[channelName]
        await axios.put(`${API_URL}/channel-settings/${encodeURIComponent(channelName)}`, {
          platform: this.channelSettings[channelName]?.platform || 'youtube',
          summaryMode: 'custom',
          customPrompt: prompt
        })

        // Update local cache
        this.channelSettings[channelName] = {
          ...this.channelSettings[channelName],
          channelName: channelName,
          customPrompt: prompt
        }
      } catch (error) {
        console.error('Failed to save template:', error)
        alert('Failed to save template. Please try again.')
      } finally {
        this.savingTemplate = null
      }
    },

    async deleteTemplate(channelName) {
      if (!confirm(`Delete the prompt template for "${channelName}"?`)) {
        return
      }

      this.deletingTemplate = channelName
      try {
        await axios.delete(`${API_URL}/channel-settings/${encodeURIComponent(channelName)}`)

        // Remove from local cache
        delete this.channelSettings[channelName]
        delete this.editingTemplates[channelName]
        this.expandedTemplate = null
      } catch (error) {
        console.error('Failed to delete template:', error)
        alert('Failed to delete template. Please try again.')
      } finally {
        this.deletingTemplate = null
      }
    },

    getOtherChannelsWithPrompts(currentChannel) {
      return this.channels.filter(ch => {
        if (ch.name === currentChannel) return false
        const settings = this.channelSettings[ch.name]
        return settings && settings.customPrompt && settings.customPrompt.trim() !== ''
      })
    },

    getChannelPromptDisplay(channelName) {
      const templateSource = this.editingSettings[channelName]?.templateSource
      if (templateSource === 'default') {
        return DEFAULT_PROMPT
      } else if (templateSource && templateSource !== 'custom') {
        const sourceSettings = this.channelSettings[templateSource]
        if (sourceSettings && sourceSettings.customPrompt) {
          return sourceSettings.customPrompt
        }
      }
      return DEFAULT_PROMPT
    },

    onImportTemplateChange() {
      // When switching to custom, initialize with empty or keep existing
      if (this.importPromptTemplate === 'custom' && !this.importCustomPrompt) {
        this.importCustomPrompt = ''
      }
    },

    onChannelTemplateChange(channelName) {
      // When switching to custom, initialize with empty if not already set
      if (this.editingSettings[channelName].templateSource === 'custom') {
        if (!this.editingSettings[channelName].customPrompt) {
          this.editingSettings[channelName].customPrompt = ''
        }
      }
    },

    toggleChannel(channelName) {
      if (this.expandedChannel === channelName) {
        this.expandedChannel = null
      } else {
        this.expandedChannel = channelName
        // Load notes for this channel if not already loaded
        if (!this.channelNotes[channelName]) {
          this.loadChannelNotes(channelName)
        }
      }
    },

    async loadChannelNotes(channelName) {
      this.loadingNotes = channelName
      try {
        const response = await axios.get(`${API_URL}/notes`, {
          params: { channel: channelName }
        })
        this.channelNotes[channelName] = response.data || []
      } catch (error) {
        console.error('Failed to load notes for channel:', error)
        this.channelNotes[channelName] = []
      } finally {
        this.loadingNotes = null
      }
    },

    async refreshSummary(channel) {
      const noteId = this.selectedNote[channel.name]
      if (!noteId) {
        alert('Please select a note first')
        return
      }

      this.refreshingSummary = channel.name
      try {
        // Determine which prompt to use based on template selection
        const settings = this.editingSettings[channel.name]
        let customPrompt = ''

        if (settings.templateSource === 'custom') {
          customPrompt = settings.customPrompt
        } else if (settings.templateSource !== 'default') {
          const sourceSettings = this.channelSettings[settings.templateSource]
          if (sourceSettings && sourceSettings.customPrompt) {
            customPrompt = sourceSettings.customPrompt
          }
        }
        // If default, customPrompt stays empty and backend uses default

        await axios.post(`${API_URL}/summarize/${noteId}`, {
          customPrompt: customPrompt
        })

        // Reload notes to get updated summary
        await this.loadChannelNotes(channel.name)

        alert('Summary refreshed successfully!')
      } catch (error) {
        console.error('Failed to refresh summary:', error)
        alert('Failed to refresh summary. Please try again.')
      } finally {
        this.refreshingSummary = null
      }
    },

    async saveSettings(channel) {
      this.saving = channel.name
      this.savedChannel = null

      try {
        const settings = this.editingSettings[channel.name]

        // Determine which prompt to save based on template selection
        let promptToSave = ''
        let modeToSave = 'default'

        if (settings.templateSource === 'custom') {
          promptToSave = settings.customPrompt
          modeToSave = 'custom'
        } else if (settings.templateSource !== 'default') {
          // Copying from another channel - save that prompt
          const sourceSettings = this.channelSettings[settings.templateSource]
          if (sourceSettings && sourceSettings.customPrompt) {
            promptToSave = sourceSettings.customPrompt
            modeToSave = 'custom'
          }
        }

        await axios.put(`${API_URL}/channel-settings/${encodeURIComponent(channel.name)}`, {
          platform: channel.platform,
          summaryMode: modeToSave,
          customPrompt: promptToSave
        })

        // Update local cache
        this.channelSettings[channel.name] = {
          channelName: channel.name,
          platform: channel.platform,
          summaryMode: modeToSave,
          customPrompt: promptToSave
        }

        this.savedChannel = channel.name
        setTimeout(() => {
          if (this.savedChannel === channel.name) {
            this.savedChannel = null
          }
        }, 2000)
      } catch (error) {
        console.error('Failed to save settings:', error)
        alert('Failed to save settings. Please try again.')
      } finally {
        this.saving = null
      }
    },

    promptDelete(channel) {
      this.channelToDelete = channel
      this.showDeleteModal = true
    },

    async confirmDelete() {
      if (!this.channelToDelete) return

      this.deleting = true
      try {
        await axios.delete(`${API_URL}/channels/${encodeURIComponent(this.channelToDelete.name)}/notes`)

        // Remove channel from list
        this.channels = this.channels.filter(c => c.name !== this.channelToDelete.name)

        // Close modal
        this.showDeleteModal = false
        this.channelToDelete = null
        this.expandedChannel = null
      } catch (error) {
        console.error('Failed to delete channel notes:', error)
        alert('Failed to delete notes. Please try again.')
      } finally {
        this.deleting = false
      }
    },

    // Import functionality
    checkExtension() {
      if (typeof chrome === 'undefined' || !chrome.runtime) {
        this.extensionAvailable = false
        return
      }

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
      this.messageListener = (event) => {
        if (event.data && event.data.type === 'SOCIAL_MEDIA_SAVER_PROGRESS') {
          this.handleImportProgress(event.data.payload)
        }
      }
      window.addEventListener('message', this.messageListener)
    },

    async startImport() {
      this.importMessage = ''
      this.importMessageType = ''

      const url = this.importChannelUrl.trim()

      if (!url) {
        this.importMessage = 'Please enter a YouTube channel URL'
        this.importMessageType = 'error'
        return
      }

      try {
        const parsed = new URL(url)
        if (!parsed.hostname.includes('youtube.com')) {
          this.importMessage = 'Please enter a valid YouTube channel URL'
          this.importMessageType = 'error'
          return
        }
      } catch {
        this.importMessage = 'Please enter a valid YouTube channel URL'
        this.importMessageType = 'error'
        return
      }

      // Determine which prompt to use based on template selection
      let promptToUse = ''
      if (this.importPromptTemplate === 'custom') {
        promptToUse = this.importCustomPrompt
      } else if (this.importPromptTemplate !== 'default') {
        // Using another channel's prompt
        const sourceSettings = this.channelSettings[this.importPromptTemplate]
        if (sourceSettings && sourceSettings.customPrompt) {
          promptToUse = sourceSettings.customPrompt
        }
      }
      // If default or empty, promptToUse stays empty (backend uses default)

      // Store the prompt to be applied after first video is imported
      this.pendingImportPrompt = {
        mode: promptToUse ? 'custom' : 'default',
        prompt: promptToUse
      }

      this.importing = true
      this.importProgress = {
        active: true,
        current: 0,
        total: 0,
        videoTitle: ''
      }

      try {
        chrome.runtime.sendMessage(EXTENSION_ID, {
          action: 'importChannel',
          channelUrl: url,
          limit: parseInt(this.importVideoLimit)
        }, (response) => {
          if (chrome.runtime.lastError) {
            this.importMessage = 'Failed to communicate with extension: ' + chrome.runtime.lastError.message
            this.importMessageType = 'error'
            this.importing = false
            this.importProgress.active = false
          }
        })
      } catch (error) {
        this.importMessage = 'Error starting import: ' + error.message
        this.importMessageType = 'error'
        this.importing = false
        this.importProgress.active = false
      }
    },

    async handleImportProgress(message) {
      const { current, total, status, videoTitle, completed, error, succeeded, skipped, failed, channelName } = message

      // When we get the channel name and have pending prompt settings, save them
      if (channelName && this.pendingImportPrompt && current === 1) {
        try {
          await axios.put(`${API_URL}/channel-settings/${encodeURIComponent(channelName)}`, {
            platform: 'youtube',
            summaryMode: this.pendingImportPrompt.mode,
            customPrompt: this.pendingImportPrompt.prompt
          })
          console.log('Saved channel settings for:', channelName)
        } catch (err) {
          console.error('Failed to save channel settings:', err)
        }
        this.pendingImportPrompt = null
      }

      if (completed) {
        this.importing = false
        this.importProgress.active = false

        if (error) {
          this.importMessage = `Import failed: ${error}`
          this.importMessageType = 'error'
        } else {
          const parts = []
          if (succeeded > 0) parts.push(`${succeeded} imported`)
          if (skipped > 0) parts.push(`${skipped} skipped`)
          if (failed > 0) parts.push(`${failed} failed`)

          this.importMessage = `Import complete! ${parts.join(', ')}`
          this.importMessageType = succeeded > 0 ? 'success' : 'warning'

          // Reload channels list to show new channel
          await this.loadData()
        }
        return
      }

      this.importProgress = {
        active: true,
        current: current || 0,
        total: total || 0,
        videoTitle: videoTitle || ''
      }
    }
  }
}
</script>

<style scoped>
.channel-settings {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
}

/* Import Section */
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

.template-label {
  font-size: 13px;
  color: #666;
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
  max-height: 200px;
  overflow-y: auto;
}

.copy-channel-select {
  padding: 6px 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  margin-left: 4px;
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

/* Templates Section */
.templates-section,
.channels-section {
  margin-bottom: 30px;
}

.templates-section h2,
.channels-section h2 {
  font-size: 18px;
  color: #333;
  margin: 0 0 8px 0;
}

.section-desc {
  color: #666;
  font-size: 14px;
  margin: 0 0 16px 0;
}

.no-templates {
  background: #f9f9f9;
  padding: 20px;
  border-radius: 8px;
  text-align: center;
  color: #666;
}

.no-templates p {
  margin: 0;
}

.templates-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.template-card {
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  overflow: hidden;
}

.template-card.expanded {
  border-color: #007AFF;
}

.template-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  cursor: pointer;
  background: #fafafa;
}

.template-card.expanded .template-header {
  background: #f0f7ff;
  border-bottom: 1px solid #e0e0e0;
}

.template-name {
  font-weight: 500;
  color: #333;
}

.template-content {
  padding: 16px;
}

.template-actions {
  display: flex;
  gap: 12px;
  margin-top: 12px;
}

.delete-template-btn {
  background: transparent;
  color: #dc3545;
  border: 1px solid #dc3545;
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.delete-template-btn:hover:not(:disabled) {
  background: #dc3545;
  color: white;
}

.delete-template-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
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
}

.loading {
  text-align: center;
  padding: 40px;
  color: #666;
}

.no-channels {
  text-align: center;
  padding: 60px 20px;
  background: #f9f9f9;
  border-radius: 8px;
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.no-channels p {
  margin: 8px 0;
  color: #666;
}

.hint {
  font-size: 14px;
  color: #999;
}

.channels-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.channel-card {
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  overflow: hidden;
  transition: box-shadow 0.2s;
}

.channel-card:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.channel-card.expanded {
  border-color: #007AFF;
}

.channel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  cursor: pointer;
  background: #fafafa;
}

.channel-card.expanded .channel-header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.channel-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.platform-icon {
  font-size: 20px;
}

.channel-name {
  font-weight: 600;
  font-size: 16px;
}

.note-count {
  font-size: 13px;
  opacity: 0.7;
}

.channel-status {
  display: flex;
  align-items: center;
  gap: 12px;
}

.custom-badge {
  background: #28a745;
  color: white;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
}

.channel-card.expanded .custom-badge {
  background: rgba(255, 255, 255, 0.2);
}

.expand-icon {
  font-size: 12px;
  opacity: 0.6;
}

.channel-settings-form {
  padding: 20px;
  border-top: 1px solid #e0e0e0;
}

.form-group {
  margin-bottom: 20px;
}

.form-group > label {
  display: block;
  font-weight: 600;
  margin-bottom: 10px;
  color: #333;
}

.radio-group {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.radio-option {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px;
  background: #f9f9f9;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.2s;
}

.radio-option:hover {
  background: #f0f0f0;
}

.radio-option input[type="radio"] {
  margin-top: 3px;
}

.radio-label {
  font-weight: 500;
  color: #333;
}

.radio-desc {
  display: block;
  font-size: 13px;
  color: #666;
  margin-top: 2px;
}

textarea {
  width: 100%;
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
  font-family: inherit;
  resize: vertical;
  box-sizing: border-box;
}

textarea:focus {
  outline: none;
  border-color: #007AFF;
}

.help-text {
  font-size: 13px;
  color: #666;
  margin-top: 8px;
}

.form-actions {
  display: flex;
  align-items: center;
  gap: 16px;
}

.save-btn {
  background: #007AFF;
  color: white;
  border: none;
  padding: 10px 24px;
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
}

/* Resummary Section */
.resummary-section {
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px solid #e0e0e0;
}

.resummary-section h4 {
  color: #333;
  margin: 0 0 8px 0;
  font-size: 14px;
}

.resummary-section > p {
  color: #666;
  font-size: 13px;
  margin: 0 0 12px 0;
}

.loading-notes {
  color: #666;
  font-size: 13px;
  font-style: italic;
}

.resummary-controls {
  display: flex;
  gap: 12px;
  align-items: center;
}

.note-select {
  flex: 1;
  padding: 10px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
  background: white;
  cursor: pointer;
}

.note-select:focus {
  outline: none;
  border-color: #007AFF;
}

.refresh-btn {
  background: #28a745;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
  white-space: nowrap;
}

.refresh-btn:hover:not(:disabled) {
  background: #218838;
}

.refresh-btn:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.no-notes {
  color: #999;
  font-size: 13px;
  font-style: italic;
}

/* Danger Zone */
.danger-zone {
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px solid #ffcccc;
}

.danger-zone h4 {
  color: #dc3545;
  margin: 0 0 8px 0;
  font-size: 14px;
}

.danger-zone p {
  color: #666;
  font-size: 13px;
  margin: 0 0 12px 0;
}

.delete-all-btn {
  background: #dc3545;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
  transition: background 0.2s;
}

.delete-all-btn:hover {
  background: #c82333;
}

/* Modal */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  padding: 24px;
  border-radius: 12px;
  max-width: 400px;
  width: 90%;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
}

.modal-content h2 {
  margin: 0 0 16px 0;
  color: #333;
}

.modal-content p {
  margin: 0 0 12px 0;
  color: #666;
}

.modal-content .warning {
  color: #dc3545;
  font-weight: 500;
}

.modal-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  margin-top: 20px;
}

.modal-actions .cancel-btn {
  background: #e0e0e0;
  color: #333;
  border: none;
  padding: 10px 20px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
}

.modal-actions .cancel-btn:hover {
  background: #d0d0d0;
}

.modal-actions .delete-btn {
  background: #dc3545;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
}

.modal-actions .delete-btn:hover:not(:disabled) {
  background: #c82333;
}

.modal-actions .delete-btn:disabled {
  background: #999;
  cursor: not-allowed;
}
</style>

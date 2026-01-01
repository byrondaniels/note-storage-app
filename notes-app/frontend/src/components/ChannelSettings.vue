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
          <label>Prompt Template:</label>
          <div class="prompt-template-row">
            <select v-model="importPromptTemplate" @change="onImportTemplateChange" :disabled="importing" class="template-select">
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
          <div v-if="importPromptTemplate !== 'custom'" class="prompt-readonly">
            {{ importPromptTextDisplay }}
          </div>
          <textarea
            v-else
            v-model="importPromptText"
            placeholder="Enter instructions for how to analyze and summarize the content..."
            rows="4"
            :disabled="importing"
            class="prompt-textarea"
          ></textarea>
        </div>

        <div class="form-group">
          <label>Output Schema (JSON):</label>
          <div v-if="importPromptTemplate !== 'custom'" class="prompt-readonly schema-readonly">
            {{ importPromptSchemaDisplay }}
          </div>
          <textarea
            v-else
            v-model="importPromptSchema"
            placeholder='{"summary": "string", "key_points": ["string"]}'
            rows="6"
            :disabled="importing"
            class="prompt-textarea schema-textarea"
            @blur="schemaError = validateSchema(importPromptSchema) || ''"
          ></textarea>
          <p v-if="schemaError" class="schema-error">{{ schemaError }}</p>
          <p class="help-text">Define the JSON structure for extracted data. Must include a "summary" field.</p>
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
    <BaseModal
      :show="showDeleteModal"
      title="Delete All Notes"
      size="small"
      @close="showDeleteModal = false"
    >
      <p>Are you sure you want to delete all <strong>{{ channelToDelete?.noteCount }}</strong> notes from <strong>{{ channelToDelete?.name }}</strong>?</p>
      <p class="warning">This action cannot be undone.</p>

      <template #footer>
        <button @click="showDeleteModal = false" class="cancel-btn">Cancel</button>
        <button @click="confirmDelete" :disabled="deleting" class="delete-btn">
          {{ deleting ? 'Deleting...' : 'Delete All' }}
        </button>
      </template>
    </BaseModal>

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
              <label>Prompt Text:</label>
              <textarea
                v-model="editingTemplates[template.channelName].promptText"
                placeholder="Enter instructions for how to analyze and summarize the content..."
                rows="4"
                class="prompt-textarea"
              ></textarea>
            </div>
            <div class="form-group">
              <label>Output Schema (JSON):</label>
              <textarea
                v-model="editingTemplates[template.channelName].promptSchema"
                placeholder='{"summary": "string", "key_points": ["string"]}'
                rows="6"
                class="prompt-textarea schema-textarea"
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
            <span v-if="getChannelSetting(channel.name)?.promptText || getChannelSetting(channel.name)?.promptSchema" class="custom-badge">Custom</span>
            <span class="expand-icon">{{ expandedChannel === channel.name ? '▼' : '▶' }}</span>
          </div>
        </div>

        <div v-if="expandedChannel === channel.name" class="channel-settings-form">
          <div class="form-group">
            <label>Prompt Template:</label>
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
          </div>

          <div class="form-group">
            <label>Prompt Text:</label>
            <div v-if="editingSettings[channel.name].templateSource !== 'custom'" class="prompt-readonly">
              {{ getChannelPromptTextDisplay(channel.name) }}
            </div>
            <textarea
              v-else
              v-model="editingSettings[channel.name].promptText"
              placeholder="Enter instructions for how to analyze and summarize the content..."
              rows="4"
              class="prompt-textarea"
            ></textarea>
          </div>

          <div class="form-group">
            <label>Output Schema (JSON):</label>
            <div v-if="editingSettings[channel.name].templateSource !== 'custom'" class="prompt-readonly schema-readonly">
              {{ getChannelPromptSchemaDisplay(channel.name) }}
            </div>
            <textarea
              v-else
              v-model="editingSettings[channel.name].promptSchema"
              placeholder='{"summary": "string", "key_points": ["string"]}'
              rows="6"
              class="prompt-textarea schema-textarea"
            ></textarea>
            <p class="help-text">Define the JSON structure for extracted data. Must include a "summary" field.</p>
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

          <!-- Sync New Videos Section -->
          <div class="sync-section" v-if="channel.platform === 'youtube'">
            <h4>Sync New Videos</h4>
            <p>Import new videos from this channel. Already-imported videos will be skipped.</p>

            <div v-if="!extensionAvailable" class="extension-warning-inline">
              Extension required for syncing.
            </div>

            <div v-else-if="!channelSettings[channel.name]?.channelUrl" class="no-url-message">
              No channel URL saved. Re-import this channel to enable syncing.
            </div>

            <div v-else class="sync-controls">
              <div class="sync-row">
                <select
                  v-model="syncVideoLimit[channel.name]"
                  :disabled="syncing === channel.name"
                  class="sync-limit-select"
                >
                  <option value="5">5</option>
                  <option value="10">10</option>
                  <option value="20">20</option>
                  <option value="50">50</option>
                </select>
                <button
                  @click="startSync(channel)"
                  :disabled="syncing === channel.name"
                  class="sync-btn"
                >
                  {{ syncing === channel.name ? 'Syncing...' : 'Sync New Videos' }}
                </button>
              </div>

              <div v-if="syncProgress.active && syncProgress.channelName === channel.name" class="sync-progress">
                <div class="progress-info">
                  <span class="progress-text">
                    Processing video {{ syncProgress.current }} of {{ syncProgress.total }}
                  </span>
                  <span v-if="syncProgress.videoTitle" class="video-title">
                    {{ syncProgress.videoTitle }}
                  </span>
                </div>
                <div class="progress-bar">
                  <div class="progress-fill sync-fill" :style="{ width: getSyncProgressPercentage(channel.name) + '%' }"></div>
                </div>
              </div>
            </div>
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
import { API_URL } from '../utils/api'
import BaseModal from './shared/BaseModal.vue'

const EXTENSION_ID = 'koodfochknchgnegkcmcfcidkfgdfgkc'

const DEFAULT_PROMPT_TEXT = `Analyze this content and extract structured information.`

const DEFAULT_PROMPT_SCHEMA = `{
  "summary": "string",
  "key_points": ["string"]
}`

export default {
  name: 'ChannelSettings',
  components: {
    BaseModal
  },
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
      importPromptText: '',
      importPromptSchema: '',
      schemaError: '',
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
      deletingTemplate: null,
      // Sync functionality
      syncing: null,
      syncVideoLimit: {},
      syncProgress: {
        active: false,
        channelName: '',
        current: 0,
        total: 0,
        videoTitle: ''
      }
    }
  },
  computed: {
    savedTemplates() {
      // Return all saved channel settings as an array (those with promptText or promptSchema)
      return Object.values(this.channelSettings).filter(s => s && (s.promptText || s.promptSchema))
    },
    channelsWithCustomPrompts() {
      // Get channels that have notes and custom prompts
      const channelsWithNotes = this.channels.filter(ch => {
        const settings = this.channelSettings[ch.name]
        return settings && (settings.promptText || settings.promptSchema)
      })

      // Get channel names that have notes
      const channelNamesWithNotes = new Set(this.channels.map(ch => ch.name))

      // Get saved templates that don't have notes (channel notes were deleted)
      const orphanedTemplates = Object.values(this.channelSettings)
        .filter(s => s && (s.promptText || s.promptSchema) && !channelNamesWithNotes.has(s.channelName))
        .map(s => ({ name: s.channelName, platform: s.platform || 'youtube' }))

      return [...channelsWithNotes, ...orphanedTemplates]
    },
    importProgressPercentage() {
      if (this.importProgress.total === 0) return 0
      return Math.round((this.importProgress.current / this.importProgress.total) * 100)
    },
    importPromptTextDisplay() {
      if (this.importPromptTemplate === 'default') {
        return DEFAULT_PROMPT_TEXT
      } else if (this.importPromptTemplate !== 'custom') {
        const sourceSettings = this.channelSettings[this.importPromptTemplate]
        if (sourceSettings && sourceSettings.promptText) {
          return sourceSettings.promptText
        }
      }
      return DEFAULT_PROMPT_TEXT
    },
    importPromptSchemaDisplay() {
      if (this.importPromptTemplate === 'default') {
        return DEFAULT_PROMPT_SCHEMA
      } else if (this.importPromptTemplate !== 'custom') {
        const sourceSettings = this.channelSettings[this.importPromptTemplate]
        if (sourceSettings && sourceSettings.promptSchema) {
          return sourceSettings.promptSchema
        }
      }
      return DEFAULT_PROMPT_SCHEMA
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
          const hasCustomPrompt = existing?.promptText || existing?.promptSchema
          this.editingSettings[channel.name] = {
            // If channel has custom prompt, show as "custom", otherwise "default"
            templateSource: hasCustomPrompt ? 'custom' : 'default',
            promptText: existing?.promptText || '',
            promptSchema: existing?.promptSchema || ''
          }
          // Initialize sync video limit
          this.syncVideoLimit[channel.name] = '20'
        }

        // Initialize editing state for templates
        this.editingTemplates = {}
        for (const s of settings) {
          if (s.promptText || s.promptSchema) {
            this.editingTemplates[s.channelName] = {
              promptText: s.promptText || '',
              promptSchema: s.promptSchema || ''
            }
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
        const template = this.editingTemplates[channelName]

        // Validate schema if provided
        if (template.promptSchema && template.promptSchema.trim()) {
          const schemaError = this.validateSchema(template.promptSchema)
          if (schemaError) {
            alert('Invalid JSON schema: ' + schemaError)
            this.savingTemplate = null
            return
          }
        }

        await axios.put(`${API_URL}/channel-settings/${encodeURIComponent(channelName)}`, {
          platform: this.channelSettings[channelName]?.platform || 'youtube',
          promptText: template.promptText,
          promptSchema: template.promptSchema
        })

        // Update local cache
        this.channelSettings[channelName] = {
          ...this.channelSettings[channelName],
          channelName: channelName,
          promptText: template.promptText,
          promptSchema: template.promptSchema
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
        return settings && (settings.promptText || settings.promptSchema)
      })
    },

    getChannelPromptTextDisplay(channelName) {
      const templateSource = this.editingSettings[channelName]?.templateSource
      if (templateSource === 'default') {
        return DEFAULT_PROMPT_TEXT
      } else if (templateSource && templateSource !== 'custom') {
        const sourceSettings = this.channelSettings[templateSource]
        if (sourceSettings && sourceSettings.promptText) {
          return sourceSettings.promptText
        }
      }
      return DEFAULT_PROMPT_TEXT
    },

    getChannelPromptSchemaDisplay(channelName) {
      const templateSource = this.editingSettings[channelName]?.templateSource
      if (templateSource === 'default') {
        return DEFAULT_PROMPT_SCHEMA
      } else if (templateSource && templateSource !== 'custom') {
        const sourceSettings = this.channelSettings[templateSource]
        if (sourceSettings && sourceSettings.promptSchema) {
          return sourceSettings.promptSchema
        }
      }
      return DEFAULT_PROMPT_SCHEMA
    },

    validateSchema(schemaString) {
      if (!schemaString || !schemaString.trim()) {
        return null // Empty is valid (optional)
      }
      try {
        JSON.parse(schemaString)
        return null // Valid JSON
      } catch (e) {
        return e.message
      }
    },

    onImportTemplateChange() {
      // When switching to custom, initialize with empty or keep existing
      if (this.importPromptTemplate === 'custom') {
        if (!this.importPromptText) this.importPromptText = ''
        if (!this.importPromptSchema) this.importPromptSchema = ''
      }
      this.schemaError = ''
    },

    onChannelTemplateChange(channelName) {
      // When switching to custom, initialize with empty if not already set
      if (this.editingSettings[channelName].templateSource === 'custom') {
        if (!this.editingSettings[channelName].promptText) {
          this.editingSettings[channelName].promptText = ''
        }
        if (!this.editingSettings[channelName].promptSchema) {
          this.editingSettings[channelName].promptSchema = ''
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
        // Determine which prompt/schema to use based on template selection
        const settings = this.editingSettings[channel.name]
        let promptText = ''
        let promptSchema = ''

        if (settings.templateSource === 'custom') {
          promptText = settings.promptText
          promptSchema = settings.promptSchema
        } else if (settings.templateSource !== 'default') {
          const sourceSettings = this.channelSettings[settings.templateSource]
          if (sourceSettings) {
            promptText = sourceSettings.promptText || ''
            promptSchema = sourceSettings.promptSchema || ''
          }
        }
        // If default, both stay empty and backend uses defaults

        await axios.post(`${API_URL}/summarize/${noteId}`, {
          promptText: promptText,
          promptSchema: promptSchema
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

        // Determine which prompt/schema to save based on template selection
        let promptTextToSave = ''
        let promptSchemaToSave = ''

        if (settings.templateSource === 'custom') {
          promptTextToSave = settings.promptText
          promptSchemaToSave = settings.promptSchema

          // Validate schema if provided
          if (promptSchemaToSave && promptSchemaToSave.trim()) {
            const schemaError = this.validateSchema(promptSchemaToSave)
            if (schemaError) {
              alert('Invalid JSON schema: ' + schemaError)
              this.saving = null
              return
            }
          }
        } else if (settings.templateSource !== 'default') {
          // Copying from another channel - save that prompt/schema
          const sourceSettings = this.channelSettings[settings.templateSource]
          if (sourceSettings) {
            promptTextToSave = sourceSettings.promptText || ''
            promptSchemaToSave = sourceSettings.promptSchema || ''
          }
        }

        await axios.put(`${API_URL}/channel-settings/${encodeURIComponent(channel.name)}`, {
          platform: channel.platform,
          channelUrl: this.channelSettings[channel.name]?.channelUrl || '',
          promptText: promptTextToSave,
          promptSchema: promptSchemaToSave
        })

        // Update local cache (preserve existing channelUrl)
        this.channelSettings[channel.name] = {
          channelName: channel.name,
          platform: channel.platform,
          channelUrl: this.channelSettings[channel.name]?.channelUrl || '',
          promptText: promptTextToSave,
          promptSchema: promptSchemaToSave
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

      // Determine which prompt/schema to use based on template selection
      let promptTextToUse = ''
      let promptSchemaToUse = ''

      if (this.importPromptTemplate === 'custom') {
        promptTextToUse = this.importPromptText
        promptSchemaToUse = this.importPromptSchema

        // Validate schema if provided
        if (promptSchemaToUse && promptSchemaToUse.trim()) {
          const schemaError = this.validateSchema(promptSchemaToUse)
          if (schemaError) {
            this.importMessage = 'Invalid JSON schema: ' + schemaError
            this.importMessageType = 'error'
            return
          }
        }
      } else if (this.importPromptTemplate !== 'default') {
        // Using another channel's prompt/schema
        const sourceSettings = this.channelSettings[this.importPromptTemplate]
        if (sourceSettings) {
          promptTextToUse = sourceSettings.promptText || ''
          promptSchemaToUse = sourceSettings.promptSchema || ''
        }
      }
      // If default or empty, both stay empty (backend uses defaults)

      // Store the prompt/schema to be applied after first video is imported
      this.pendingImportPrompt = {
        promptText: promptTextToUse,
        promptSchema: promptSchemaToUse
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

    async startSync(channel) {
      const url = this.channelSettings[channel.name]?.channelUrl

      if (!url) {
        alert('No channel URL saved. Please re-import this channel.')
        return
      }

      this.syncing = channel.name
      this.syncProgress = {
        active: true,
        channelName: channel.name,
        current: 0,
        total: 0,
        videoTitle: ''
      }

      try {
        chrome.runtime.sendMessage(EXTENSION_ID, {
          action: 'importChannel',
          channelUrl: url,
          limit: parseInt(this.syncVideoLimit[channel.name] || '20')
        }, (response) => {
          if (chrome.runtime.lastError) {
            alert('Failed to communicate with extension: ' + chrome.runtime.lastError.message)
            this.syncing = null
            this.syncProgress.active = false
          }
        })
      } catch (error) {
        alert('Error starting sync: ' + error.message)
        this.syncing = null
        this.syncProgress.active = false
      }
    },

    getSyncProgressPercentage(channelName) {
      if (this.syncProgress.channelName !== channelName || this.syncProgress.total === 0) {
        return 0
      }
      return Math.round((this.syncProgress.current / this.syncProgress.total) * 100)
    },

    async handleImportProgress(message) {
      const { current, total, status, videoTitle, completed, error, succeeded, skipped, failed, channelName } = message

      // Check if this is a sync operation (syncing is set) or an import operation
      const isSyncOperation = this.syncing !== null

      // When we get the channel name and have pending prompt settings, save them (import only)
      if (!isSyncOperation && channelName && this.pendingImportPrompt && current === 1) {
        try {
          await axios.put(`${API_URL}/channel-settings/${encodeURIComponent(channelName)}`, {
            platform: 'youtube',
            channelUrl: this.importChannelUrl.trim(),
            promptText: this.pendingImportPrompt.promptText,
            promptSchema: this.pendingImportPrompt.promptSchema
          })
          console.log('Saved channel settings for:', channelName)
        } catch (err) {
          console.error('Failed to save channel settings:', err)
        }
        this.pendingImportPrompt = null
      }

      if (completed) {
        if (isSyncOperation) {
          // Handle sync completion
          this.syncing = null
          this.syncProgress.active = false

          if (error) {
            alert(`Sync failed: ${error}`)
          } else {
            const parts = []
            if (succeeded > 0) parts.push(`${succeeded} imported`)
            if (skipped > 0) parts.push(`${skipped} skipped`)
            if (failed > 0) parts.push(`${failed} failed`)
            alert(`Sync complete! ${parts.join(', ')}`)

            // Reload to update note counts
            await this.loadData()
          }
        } else {
          // Handle import completion
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
        }
        return
      }

      // Update progress
      if (isSyncOperation) {
        this.syncProgress = {
          active: true,
          channelName: this.syncing,
          current: current || 0,
          total: total || 0,
          videoTitle: videoTitle || ''
        }
      } else {
        this.importProgress = {
          active: true,
          current: current || 0,
          total: total || 0,
          videoTitle: videoTitle || ''
        }
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

/* Sync Section */
.sync-section {
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px solid #e0e0e0;
}

.sync-section h4 {
  color: #333;
  margin: 0 0 8px 0;
  font-size: 14px;
}

.sync-section > p {
  color: #666;
  font-size: 13px;
  margin: 0 0 12px 0;
}

.extension-warning-inline {
  color: #856404;
  background: #fff3cd;
  padding: 8px 12px;
  border-radius: 4px;
  font-size: 13px;
}

.no-url-message {
  color: #666;
  font-size: 13px;
  font-style: italic;
}

.sync-controls {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.sync-row {
  display: flex;
  gap: 8px;
  align-items: center;
}

.sync-limit-select {
  width: 70px;
  padding: 10px 8px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
  background: white;
}

.sync-btn {
  background: #ff0000;
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

.sync-btn:hover:not(:disabled) {
  background: #cc0000;
}

.sync-btn:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.sync-progress {
  background: #fff3e0;
  border: 1px solid #ffcc80;
  border-radius: 6px;
  padding: 12px;
}

.sync-fill {
  background: linear-gradient(90deg, #ff9800, #ffb74d) !important;
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

/* Modal Styles - Base styles moved to BaseModal.vue */

.warning {
  color: #dc3545;
  font-weight: 500;
}

.cancel-btn {
  background: #e0e0e0;
  color: #333;
  border: none;
  padding: 10px 20px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
}

.cancel-btn:hover {
  background: #d0d0d0;
}

.delete-btn {
  background: #dc3545;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
}

.delete-btn:hover:not(:disabled) {
  background: #c82333;
}

.delete-btn:disabled {
  background: #999;
  cursor: not-allowed;
}
</style>

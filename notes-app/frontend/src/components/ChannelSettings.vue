<template>
  <div class="channel-settings">
    <h1>Channel Settings</h1>
    <p class="subtitle">Import YouTube channels and configure custom summary prompts</p>

    <ChannelImporter
      ref="importer"
      :extensionAvailable="extensionAvailable"
      :channelsWithCustomPrompts="channelsWithCustomPrompts"
      :channelSettings="channelSettings"
      :defaultPromptText="DEFAULT_PROMPT_TEXT"
      :defaultPromptSchema="DEFAULT_PROMPT_SCHEMA"
      @import-start="handleImportStart"
    />

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

    <PromptTemplates
      :savedTemplates="savedTemplates"
      :channelSettings="channelSettings"
      @save-template="handleSaveTemplate"
      @delete-template="handleDeleteTemplate"
    />

    <div class="channels-section">
      <h2>Channels</h2>
      <p class="section-desc">Channels with imported notes.</p>

      <div v-if="loading" class="loading">Loading channels...</div>

      <div v-else-if="channels.length === 0" class="no-channels">
        <p>No channels with notes yet. Import some YouTube videos to get started.</p>
      </div>

      <div v-else class="channels-list">
        <ChannelCard
          v-for="channel in channels"
          :key="channel.name"
          :channel="channel"
          :isExpanded="expandedChannel === channel.name"
          :channelSettings="channelSettings"
          :otherChannelsWithPrompts="getOtherChannelsWithPrompts(channel.name)"
          :defaultPromptText="DEFAULT_PROMPT_TEXT"
          :defaultPromptSchema="DEFAULT_PROMPT_SCHEMA"
          :extensionAvailable="extensionAvailable"
          :notes="channelNotes[channel.name] || []"
          :loadingNotes="loadingNotes === channel.name"
          :syncProgress="syncProgress"
          @toggle-expand="handleToggleExpand"
          @save-settings="handleSaveChannelSettings"
          @sync-start="handleSyncStart"
          @refresh-summary="handleRefreshSummary"
          @delete-channel="promptDelete"
        />
      </div>
    </div>
  </div>
</template>

<script>
import axios from 'axios'
import { API_URL } from '../utils/api'
import BaseModal from './shared/BaseModal.vue'
import ChannelImporter from './ChannelImporter.vue'
import PromptTemplates from './PromptTemplates.vue'
import ChannelCard from './ChannelCard.vue'
import { useApi } from '../composables/useApi'

const EXTENSION_ID = 'koodfochknchgnegkcmcfcidkfgdfgkc'

const DEFAULT_PROMPT_TEXT = `Analyze this content and extract structured information.`

const DEFAULT_PROMPT_SCHEMA = `{
  "summary": "string",
  "key_points": ["string"]
}`

export default {
  name: 'ChannelSettings',
  components: {
    BaseModal,
    ChannelImporter,
    PromptTemplates,
    ChannelCard
  },
  setup() {
    const api = useApi()
    return { api }
  },
  data() {
    return {
      DEFAULT_PROMPT_TEXT,
      DEFAULT_PROMPT_SCHEMA,
      channels: [],
      channelSettings: {},
      loading: true,
      expandedChannel: null,
      showDeleteModal: false,
      channelToDelete: null,
      deleting: false,
      channelNotes: {},
      loadingNotes: null,
      extensionAvailable: false,
      importing: false,
      pendingImportPrompt: null,
      syncing: null,
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
      return Object.values(this.channelSettings).filter(s => s && (s.promptText || s.promptSchema))
    },
    channelsWithCustomPrompts() {
      const channelsWithNotes = this.channels.filter(ch => {
        const settings = this.channelSettings[ch.name]
        return settings && (settings.promptText || settings.promptSchema)
      })

      const channelNamesWithNotes = new Set(this.channels.map(ch => ch.name))

      const orphanedTemplates = Object.values(this.channelSettings)
        .filter(s => s && (s.promptText || s.promptSchema) && !channelNamesWithNotes.has(s.channelName))
        .map(s => ({ name: s.channelName, platform: s.platform || 'youtube' }))

      return [...channelsWithNotes, ...orphanedTemplates]
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
        await this.api.request(async () => {
          const [channelsRes, settingsRes] = await Promise.all([
            axios.get(`${API_URL}/channels`),
            axios.get(`${API_URL}/channel-settings`)
          ])

          this.channels = channelsRes.data || []

          const settings = settingsRes.data || []
          this.channelSettings = {}
          for (const s of settings) {
            this.channelSettings[s.channelName] = s
          }
        })
      } finally {
        this.loading = false
      }
    },

    getOtherChannelsWithPrompts(currentChannel) {
      return this.channels.filter(ch => {
        if (ch.name === currentChannel) return false
        const settings = this.channelSettings[ch.name]
        return settings && (settings.promptText || settings.promptSchema)
      })
    },

    handleToggleExpand(channelName) {
      if (this.expandedChannel === channelName) {
        this.expandedChannel = null
      } else {
        this.expandedChannel = channelName
        if (!this.channelNotes[channelName]) {
          this.loadChannelNotes(channelName)
        }
      }
    },

    async loadChannelNotes(channelName) {
      this.loadingNotes = channelName
      try {
        await this.api.request(async () => {
          const response = await axios.get(`${API_URL}/notes`, {
            params: { channel: channelName }
          })
          this.channelNotes[channelName] = response.data || []
        })
      } catch (error) {
        this.channelNotes[channelName] = []
      } finally {
        this.loadingNotes = null
      }
    },

    async handleSaveChannelSettings({ channel, promptText, promptSchema }) {
      try {
        await this.api.request(async () => {
          await axios.put(`${API_URL}/channel-settings/${encodeURIComponent(channel.name)}`, {
            platform: channel.platform,
            channelUrl: this.channelSettings[channel.name]?.channelUrl || '',
            promptText: promptText,
            promptSchema: promptSchema
          })

          this.channelSettings[channel.name] = {
            channelName: channel.name,
            platform: channel.platform,
            channelUrl: this.channelSettings[channel.name]?.channelUrl || '',
            promptText: promptText,
            promptSchema: promptSchema
          }
        })
      } catch (error) {
        alert('Failed to save settings. Please try again.')
        throw error
      }
    },

    async handleRefreshSummary({ channel, noteId, promptText, promptSchema }) {
      try {
        await this.api.request(async () => {
          await axios.post(`${API_URL}/summarize/${noteId}`, {
            promptText: promptText,
            promptSchema: promptSchema
          })

          await this.loadChannelNotes(channel.name)
          alert('Summary refreshed successfully!')
        })
      } catch (error) {
        alert('Failed to refresh summary. Please try again.')
      }
    },

    async handleSaveTemplate({ channelName, promptText, promptSchema }) {
      await this.api.request(async () => {
        await axios.put(`${API_URL}/channel-settings/${encodeURIComponent(channelName)}`, {
          platform: this.channelSettings[channelName]?.platform || 'youtube',
          promptText: promptText,
          promptSchema: promptSchema
        })

        this.channelSettings[channelName] = {
          ...this.channelSettings[channelName],
          channelName: channelName,
          promptText: promptText,
          promptSchema: promptSchema
        }
      })
    },

    async handleDeleteTemplate(channelName) {
      await this.api.request(async () => {
        await axios.delete(`${API_URL}/channel-settings/${encodeURIComponent(channelName)}`)
        delete this.channelSettings[channelName]
      })
    },

    promptDelete(channel) {
      this.channelToDelete = channel
      this.showDeleteModal = true
    },

    async confirmDelete() {
      if (!this.channelToDelete) return

      this.deleting = true
      try {
        await this.api.request(async () => {
          await axios.delete(`${API_URL}/channels/${encodeURIComponent(this.channelToDelete.name)}/notes`)

          this.channels = this.channels.filter(c => c.name !== this.channelToDelete.name)

          this.showDeleteModal = false
          this.channelToDelete = null
          this.expandedChannel = null
        })
      } catch (error) {
        alert('Failed to delete notes. Please try again.')
      } finally {
        this.deleting = false
      }
    },

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

    async handleImportStart({ channelUrl, videoLimit, promptText, promptSchema }) {
      this.$refs.importer.clearMessage()

      this.pendingImportPrompt = {
        promptText: promptText,
        promptSchema: promptSchema
      }

      this.importing = true
      this.$refs.importer.setImportingState(true)
      this.$refs.importer.updateProgress({
        active: true,
        current: 0,
        total: 0,
        videoTitle: ''
      })

      try {
        chrome.runtime.sendMessage(EXTENSION_ID, {
          action: 'importChannel',
          channelUrl: channelUrl,
          limit: videoLimit
        }, (response) => {
          if (chrome.runtime.lastError) {
            this.$refs.importer.setMessage('Failed to communicate with extension: ' + chrome.runtime.lastError.message, 'error')
            this.importing = false
            this.$refs.importer.setImportingState(false)
            this.$refs.importer.updateProgress({ active: false, current: 0, total: 0, videoTitle: '' })
          }
        })
      } catch (error) {
        this.$refs.importer.setMessage('Error starting import: ' + error.message, 'error')
        this.importing = false
        this.$refs.importer.setImportingState(false)
        this.$refs.importer.updateProgress({ active: false, current: 0, total: 0, videoTitle: '' })
      }
    },

    async handleSyncStart({ channel, videoLimit }) {
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
          limit: videoLimit
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

    async handleImportProgress(message) {
      const { current, total, status, videoTitle, completed, error, succeeded, skipped, failed, channelName } = message

      const isSyncOperation = this.syncing !== null

      if (!isSyncOperation && channelName && this.pendingImportPrompt && current === 1) {
        try {
          await this.api.request(async () => {
            await axios.put(`${API_URL}/channel-settings/${encodeURIComponent(channelName)}`, {
              platform: 'youtube',
              channelUrl: this.$refs.importer.channelUrl.trim(),
              promptText: this.pendingImportPrompt.promptText,
              promptSchema: this.pendingImportPrompt.promptSchema
            })
            console.log('Saved channel settings for:', channelName)
          })
        } catch (err) {
          // Silent fail
        }
        this.pendingImportPrompt = null
      }

      if (completed) {
        if (isSyncOperation) {
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

            await this.loadData()
          }
        } else {
          this.importing = false
          this.$refs.importer.setImportingState(false)
          this.$refs.importer.updateProgress({ active: false, current: 0, total: 0, videoTitle: '' })

          if (error) {
            this.$refs.importer.setMessage(`Import failed: ${error}`, 'error')
          } else {
            const parts = []
            if (succeeded > 0) parts.push(`${succeeded} imported`)
            if (skipped > 0) parts.push(`${skipped} skipped`)
            if (failed > 0) parts.push(`${failed} failed`)

            this.$refs.importer.setMessage(`Import complete! ${parts.join(', ')}`, succeeded > 0 ? 'success' : 'warning')

            await this.loadData()
          }
        }
        return
      }

      if (isSyncOperation) {
        this.syncProgress = {
          active: true,
          channelName: this.syncing,
          current: current || 0,
          total: total || 0,
          videoTitle: videoTitle || ''
        }
      } else {
        this.$refs.importer.updateProgress({
          active: true,
          current: current || 0,
          total: total || 0,
          videoTitle: videoTitle || ''
        })
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

.channels-section {
  margin-bottom: 30px;
}

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

.no-channels p {
  margin: 8px 0;
  color: #666;
}

.channels-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

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

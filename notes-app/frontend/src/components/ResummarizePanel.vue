<template>
  <div class="resummary-section">
    <h4>Refresh Note Summary</h4>
    <p>Select a note and regenerate its summary using the current prompt settings.</p>

    <div v-if="loadingNotes" class="loading-notes">
      Loading notes...
    </div>

    <div v-else-if="notes && notes.length > 0" class="resummary-controls">
      <select v-model="selectedNoteId" class="note-select">
        <option value="">Select a note...</option>
        <option
          v-for="note in notes"
          :key="note.id"
          :value="note.id"
        >
          {{ note.title || 'Untitled' }}
        </option>
      </select>
      <button
        @click="refreshSummary"
        :disabled="!selectedNoteId || refreshing"
        class="refresh-btn"
      >
        {{ refreshing ? 'Refreshing...' : 'Refresh Summary' }}
      </button>
    </div>

    <div v-else-if="notes" class="no-notes">
      No notes found for this channel.
    </div>
  </div>
</template>

<script>
export default {
  name: 'ResummarizePanel',
  props: {
    channel: {
      type: Object,
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
    templateSource: {
      type: String,
      default: 'default'
    },
    promptText: {
      type: String,
      default: ''
    },
    promptSchema: {
      type: String,
      default: ''
    },
    channelSettings: {
      type: Object,
      default: () => ({})
    }
  },
  data() {
    return {
      selectedNoteId: '',
      refreshing: false
    }
  },
  methods: {
    async refreshSummary() {
      if (!this.selectedNoteId) {
        alert('Please select a note first')
        return
      }

      this.refreshing = true

      try {
        let promptTextToUse = ''
        let promptSchemaToUse = ''

        if (this.templateSource === 'custom') {
          promptTextToUse = this.promptText
          promptSchemaToUse = this.promptSchema
        } else if (this.templateSource !== 'default') {
          const sourceSettings = this.channelSettings[this.templateSource]
          if (sourceSettings) {
            promptTextToUse = sourceSettings.promptText || ''
            promptSchemaToUse = sourceSettings.promptSchema || ''
          }
        }

        await this.$emit('refresh-summary', {
          channel: this.channel,
          noteId: this.selectedNoteId,
          promptText: promptTextToUse,
          promptSchema: promptSchemaToUse
        })

        this.selectedNoteId = ''
      } finally {
        this.refreshing = false
      }
    },
    setRefreshingState(state) {
      this.refreshing = state
    }
  }
}
</script>

<style scoped>
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
</style>

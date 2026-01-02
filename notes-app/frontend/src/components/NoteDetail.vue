<template>
  <div class="note-detail">
    <div class="note-detail-header">
      <div class="note-title-section">
        <h1 class="note-detail-title">{{ note.title }}</h1>
        <div v-if="note.metadata && (note.metadata.platform || note.metadata.url)" class="note-source">
          <span class="source-label">Source:</span>
          <span class="source-platform">
            {{ note.metadata.platform === 'youtube' ? 'YouTube' :
               note.metadata.platform === 'twitter' ? 'Twitter' :
               note.metadata.platform === 'linkedin' ? 'LinkedIn' :
               (note.metadata.platform || 'Custom') }}{{ note.metadata.author ? ' - ' + note.metadata.author : '' }}
          </span>
          <a v-if="note.metadata.url" :href="note.metadata.url" target="_blank" class="source-link">
            View Original
          </a>
        </div>
        <div class="note-detail-meta">
          <CategoryBadge :category="note.category" size="large" />
        </div>
        <div class="note-dates">
          <div class="date-item">
            <span class="date-label">Date Imported:</span>
            <span class="date-value">{{ formatDate(note.created) }}</span>
          </div>
          <div v-if="note.sourcePublishedAt" class="date-item">
            <span class="date-label">Source Published:</span>
            <span class="date-value">{{ formatDate(note.sourcePublishedAt) }}</span>
          </div>
          <div v-if="note.lastSummarizedAt" class="date-item">
            <span class="date-label">Last Summarized:</span>
            <span class="date-value">{{ formatDate(note.lastSummarizedAt) }}</span>
          </div>
        </div>
      </div>

      <div class="note-actions">
        <button @click="$emit('open-ai-modal')" class="action-btn ai-btn" title="Ask AI about this note">
          <span class="action-icon">🤖</span>
          AI Questions
        </button>
        <button @click="$emit('delete')" class="action-btn delete-btn" title="Delete note">
          <span class="action-icon">🗑️</span>
          Delete
        </button>
      </div>
    </div>

    <!-- Tab Navigation -->
    <div class="note-tabs">
      <button
        @click="$emit('update:currentView', 'full')"
        class="tab-btn"
        :class="{ 'active': currentView === 'full' }"
      >
        Full Note
      </button>
      <button
        @click="handleSummaryTabClick"
        class="tab-btn"
        :class="{
          'active': currentView === 'summary',
          'no-summary': !note.summary && !summarizing,
          'loading': summarizing
        }"
        :disabled="summarizing"
      >
        <span v-if="summarizing" class="tab-spinner"></span>
        <span v-else-if="!note.summary" class="summary-indicator">+</span>
        Summary
      </button>
    </div>

    <!-- Content based on current view -->
    <div class="note-detail-content">
      <div v-if="currentView === 'full'" class="full-content">
        <div class="content-header">
          <button @click="copyToClipboard(note.content, 'full')" class="copy-btn" :class="{ 'copied': copiedState === 'full' }">
            <span v-if="copiedState === 'full'">Copied!</span>
            <span v-else>📋 Copy</span>
          </button>
        </div>
        <div class="content-text">{{ note.content }}</div>
      </div>
      <div v-else-if="currentView === 'summary'" class="summary-content">
        <div v-if="summarizing" class="summary-loading">
          <div class="summary-spinner"></div>
          <p>Generating summary...</p>
        </div>
        <div v-else-if="summarizeError" class="summary-error">
          <p class="error-title">Failed to generate summary</p>
          <p class="error-message">{{ summarizeError }}</p>
          <button @click="$emit('clear-error'); $emit('summarize')" class="retry-btn">Try Again</button>
        </div>
        <div v-else-if="note.summary" class="summary-text">
          <div class="content-header">
            <button @click="copyToClipboard(note.summary, 'summary')" class="copy-btn" :class="{ 'copied': copiedState === 'summary' }">
              <span v-if="copiedState === 'summary'">Copied!</span>
              <span v-else>📋 Copy</span>
            </button>
          </div>
          <div class="content-text">{{ note.summary }}</div>
        </div>
        <div v-else class="no-summary-message">
          <p>No summary available</p>
          <button @click="$emit('summarize')" class="generate-btn">Generate Summary</button>
        </div>

        <!-- Structured Data Fields -->
        <div v-if="getFilteredStructuredData()" class="structured-fields">
          <div
            v-for="(value, key) in getFilteredStructuredData()"
            :key="key"
            class="structured-field"
          >
            <h4 class="field-label">{{ formatFieldLabel(key) }}</h4>

            <!-- String array: render as bullet list -->
            <ul v-if="isArrayOfStrings(value)" class="field-list">
              <li v-for="(item, idx) in value" :key="idx">{{ item }}</li>
            </ul>

            <!-- Object array: render as structured cards -->
            <div v-else-if="isArrayOfObjects(value)" class="field-objects">
              <div v-for="(obj, idx) in value" :key="idx" class="field-object-card">
                <div v-for="(val, objKey) in obj" :key="objKey" class="field-object-row">
                  <span class="field-object-key">{{ formatFieldLabel(objKey) }}:</span>
                  <span class="field-object-value">{{ val }}</span>
                </div>
              </div>
            </div>

            <!-- Simple string: render as paragraph -->
            <p v-else class="field-value">{{ value }}</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { formatDate } from '../utils/formatters'
import CategoryBadge from './shared/CategoryBadge.vue'

export default {
  name: 'NoteDetail',
  components: {
    CategoryBadge
  },
  props: {
    note: {
      type: Object,
      required: true
    },
    currentView: {
      type: String,
      default: 'full'
    },
    summarizing: {
      type: Boolean,
      default: false
    },
    summarizeError: {
      type: String,
      default: null
    },
    copiedState: {
      type: String,
      default: null
    }
  },
  methods: {
    formatDate,
    handleSummaryTabClick() {
      this.$emit('update:currentView', 'summary')
    },
    async copyToClipboard(text, type) {
      if (!text) return

      try {
        await navigator.clipboard.writeText(text)
        this.$emit('update:copiedState', type)

        setTimeout(() => {
          this.$emit('update:copiedState', null)
        }, 2000)
      } catch (error) {
        console.error('Failed to copy:', error)
        // Fallback for older browsers
        const textarea = document.createElement('textarea')
        textarea.value = text
        document.body.appendChild(textarea)
        textarea.select()
        document.execCommand('copy')
        document.body.removeChild(textarea)

        this.$emit('update:copiedState', type)
        setTimeout(() => {
          this.$emit('update:copiedState', null)
        }, 2000)
      }
    },
    formatFieldLabel(key) {
      if (!key) return ''
      return key
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ')
    },
    getFilteredStructuredData() {
      if (!this.note || !this.note.structuredData) return null
      const data = { ...this.note.structuredData }
      delete data.summary
      return Object.keys(data).length > 0 ? data : null
    },
    isArrayOfStrings(value) {
      return Array.isArray(value) && value.length > 0 && typeof value[0] === 'string'
    },
    isArrayOfObjects(value) {
      return Array.isArray(value) && value.length > 0 && typeof value[0] === 'object' && value[0] !== null
    }
  }
}
</script>

<style scoped>
.note-detail {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.note-detail-header {
  padding: 32px 40px 20px 40px;
  border-bottom: 1px solid #f0f0f0;
  background: white;
  flex-shrink: 0;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.note-title-section {
  flex: 1;
  margin-right: 20px;
}

.note-detail-title {
  margin: 0 0 16px 0;
  font-size: 28px;
  font-weight: 700;
  color: #1c1c1e;
  line-height: 1.2;
}

.note-source {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  padding: 8px 12px;
  background: #f8f9fa;
  border-radius: 6px;
  border-left: 3px solid #007AFF;
}

.source-label {
  font-size: 12px;
  font-weight: 600;
  color: #6c757d;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.source-platform {
  font-size: 13px;
  font-weight: 500;
  color: #1c1c1e;
  padding: 2px 8px;
  background: #e9ecef;
  border-radius: 4px;
}

.source-link {
  font-size: 12px;
  color: #007AFF;
  text-decoration: none;
  font-weight: 500;
  margin-left: auto;
  padding: 2px 8px;
  border-radius: 4px;
  transition: background-color 0.2s;
}

.source-link:hover {
  background-color: #f0f8ff;
  text-decoration: underline;
}

.note-detail-meta {
  display: flex;
  align-items: center;
  gap: 12px;
}

.note-dates {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  margin-top: 8px;
  padding: 8px 0;
  border-top: 1px solid #e5e5ea;
}

.date-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
}

.date-label {
  color: #8e8e93;
  font-weight: 500;
}

.date-value {
  color: #1c1c1e;
}

.note-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border: 1px solid #d1d1d6;
  border-radius: 6px;
  background: white;
  color: #1c1c1e;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.action-btn:hover {
  border-color: #007AFF;
  background-color: #f0f8ff;
}

.action-btn.ai-btn {
  background-color: #007AFF;
  color: white;
  border-color: #007AFF;
}

.action-btn.ai-btn:hover {
  background-color: #0056b3;
  border-color: #0056b3;
}

.action-btn.delete-btn:hover {
  border-color: #ff3b30;
  background-color: #fff0f0;
  color: #ff3b30;
}

.action-icon {
  font-size: 14px;
}

/* Tab Navigation */
.note-tabs {
  display: flex;
  border-bottom: 1px solid #e5e5e5;
  background: #f8f9fa;
  padding: 0 40px;
}

.tab-btn {
  background: none;
  border: none;
  padding: 12px 20px;
  font-size: 14px;
  font-weight: 500;
  color: #6c757d;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: all 0.2s;
}

.tab-btn:hover {
  color: #007AFF;
  background-color: rgba(0, 122, 255, 0.05);
}

.tab-btn.active {
  color: #007AFF;
  border-bottom-color: #007AFF;
  background-color: rgba(0, 122, 255, 0.08);
}

.tab-btn.no-summary {
  color: #6c757d;
  position: relative;
}

.tab-btn.no-summary:hover {
  color: #28a745;
  background-color: rgba(40, 167, 69, 0.05);
}

.tab-btn.loading {
  color: #007AFF;
  cursor: not-allowed;
}

.tab-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.summary-indicator {
  display: inline-block;
  margin-right: 4px;
  font-weight: bold;
  color: #28a745;
}

.tab-spinner {
  display: inline-block;
  width: 12px;
  height: 12px;
  border: 2px solid #e9ecef;
  border-top: 2px solid #007AFF;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-right: 6px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* Content */
.note-detail-content {
  flex: 1;
  padding: 32px 40px;
  overflow-y: auto;
  font-size: 16px;
  line-height: 1.6;
  color: #1c1c1e;
  white-space: pre-wrap;
  word-wrap: break-word;
}

.content-header {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 12px;
}

.copy-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  background: #f8f9fa;
  border: 1px solid #d1d1d6;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  color: #495057;
  cursor: pointer;
  transition: all 0.2s;
}

.copy-btn:hover {
  background: #e9ecef;
  border-color: #007AFF;
  color: #007AFF;
}

.copy-btn.copied {
  background: #d4edda;
  border-color: #28a745;
  color: #28a745;
}

.content-text {
  white-space: pre-wrap;
  word-wrap: break-word;
}

.summary-content {
  padding: 20px 0;
}

.summary-text {
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 8px;
  padding: 20px;
  margin: 20px 0;
  font-style: italic;
  color: #495057;
  line-height: 1.6;
}

.summary-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: #6c757d;
}

.summary-loading p {
  margin: 16px 0 0 0;
  font-size: 16px;
  font-style: italic;
}

.summary-spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #e9ecef;
  border-top: 4px solid #007AFF;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.no-summary-message {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: #6c757d;
  text-align: center;
  gap: 16px;
}

.no-summary-message p {
  margin: 0;
  font-size: 16px;
}

.no-summary-message .generate-btn {
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

.no-summary-message .generate-btn:hover {
  background: #0056b3;
}

.summary-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  background: #fff5f5;
  border: 1px solid #fed7d7;
  border-radius: 8px;
  text-align: center;
}

.summary-error .error-title {
  margin: 0 0 8px 0;
  font-size: 16px;
  font-weight: 600;
  color: #c53030;
}

.summary-error .error-message {
  margin: 0 0 16px 0;
  font-size: 14px;
  color: #742a2a;
  max-width: 400px;
}

.summary-error .retry-btn {
  background: #c53030;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
}

.summary-error .retry-btn:hover {
  background: #9b2c2c;
}

/* Structured Data */
.structured-fields {
  margin-top: 24px;
  padding-top: 24px;
  border-top: 1px solid #e9ecef;
}

.structured-field {
  margin-bottom: 20px;
}

.structured-field:last-child {
  margin-bottom: 0;
}

.field-label {
  margin: 0 0 8px 0;
  font-size: 14px;
  font-weight: 600;
  color: #1c1c1e;
  text-transform: capitalize;
}

.field-value {
  margin: 0;
  font-size: 14px;
  line-height: 1.6;
  color: #495057;
}

.field-list {
  margin: 0;
  padding-left: 20px;
  list-style-type: disc;
}

.field-list li {
  font-size: 14px;
  line-height: 1.6;
  color: #495057;
  margin-bottom: 4px;
}

.field-list li:last-child {
  margin-bottom: 0;
}

.field-objects {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.field-object-card {
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 6px;
  padding: 12px;
}

.field-object-row {
  display: flex;
  gap: 8px;
  margin-bottom: 4px;
  font-size: 13px;
}

.field-object-row:last-child {
  margin-bottom: 0;
}

.field-object-key {
  font-weight: 500;
  color: #6c757d;
  flex-shrink: 0;
}

.field-object-value {
  color: #1c1c1e;
  word-break: break-word;
}

/* Scrollbar styling */
.note-detail-content::-webkit-scrollbar {
  width: 6px;
}

.note-detail-content::-webkit-scrollbar-track {
  background: transparent;
}

.note-detail-content::-webkit-scrollbar-thumb {
  background: #d1d1d6;
  border-radius: 3px;
}

.note-detail-content::-webkit-scrollbar-thumb:hover {
  background: #aeaeb2;
}

/* Responsive design */
@media (max-width: 768px) {
  .note-detail-header {
    padding: 24px 20px 16px 20px;
    flex-direction: column;
    align-items: stretch;
  }

  .note-title-section {
    margin-right: 0;
    margin-bottom: 16px;
  }

  .note-detail-title {
    font-size: 24px;
  }

  .note-detail-content {
    padding: 20px;
    font-size: 15px;
  }
}
</style>

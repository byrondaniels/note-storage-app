<template>
  <div class="note-edit">
    <div class="note-edit-header">
      <div class="edit-title-section">
        <h2 v-if="isCreatingNote">Create New Note</h2>
        <h2 v-else>Edit Note</h2>
        <div class="keyboard-hints">
          <span class="hint">⌘+Enter to save</span>
          <span class="hint">Esc to cancel</span>
        </div>
      </div>

      <div class="edit-actions">
        <button @click="$emit('cancel')" class="action-btn cancel-btn" title="Cancel (Esc)">
          <span class="action-icon">✕</span>
          Cancel
        </button>
        <button
          @click="$emit('save')"
          class="action-btn save-btn"
          title="Save note (⌘+Enter)"
          :disabled="saving || !content.trim() || !hasContentChanged"
        >
          <span class="action-icon">💾</span>
          {{ saving ? 'Saving...' : 'Save' }}
        </button>
      </div>
    </div>

    <div class="note-edit-content">
      <div class="edit-form-group">
        <textarea
          id="edit-content-inline"
          :value="content"
          @input="$emit('update:content', $event.target.value)"
          class="edit-content-textarea full-height"
          :class="{ 'saving': saving }"
          :placeholder="isCreatingNote ? 'Start writing your note here...' : 'Edit your note content...'"
          :disabled="saving"
          @keydown="handleKeydown"
        ></textarea>

        <!-- Loading overlay -->
        <div v-if="saving" class="saving-overlay">
          <div class="saving-spinner"></div>
          <span class="saving-text">{{ isCreatingNote ? 'Creating note...' : 'Saving changes...' }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'NoteEditor',
  props: {
    content: {
      type: String,
      default: ''
    },
    originalContent: {
      type: String,
      default: ''
    },
    isCreatingNote: {
      type: Boolean,
      default: false
    },
    saving: {
      type: Boolean,
      default: false
    }
  },
  computed: {
    hasContentChanged() {
      if (this.isCreatingNote) {
        return this.content.trim().length > 0
      } else {
        return this.content.trim() !== this.originalContent.trim()
      }
    }
  },
  mounted() {
    this.$nextTick(() => {
      const textarea = document.getElementById('edit-content-inline')
      if (textarea) {
        textarea.focus()
        if (!this.isCreatingNote) {
          textarea.setSelectionRange(textarea.value.length, textarea.value.length)
        }
      }
    })
  },
  methods: {
    handleKeydown(event) {
      // Cmd+Enter (Mac) or Ctrl+Enter (Windows/Linux) to save
      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
        event.preventDefault()
        if (!this.saving && this.content.trim() && this.hasContentChanged) {
          this.$emit('save')
        }
      }
      // Escape to cancel
      else if (event.key === 'Escape') {
        event.preventDefault()
        if (!this.saving) {
          this.$emit('cancel')
        }
      }
    }
  }
}
</script>

<style scoped>
.note-edit {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.note-edit-header {
  padding: 32px 40px 20px 40px;
  border-bottom: 1px solid #f0f0f0;
  background: white;
  flex-shrink: 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.edit-title-section h2 {
  margin: 0 0 8px 0;
  font-size: 24px;
  font-weight: 600;
  color: #1c1c1e;
}

.keyboard-hints {
  display: flex;
  gap: 16px;
}

.hint {
  font-size: 12px;
  color: #8e8e93;
  background: #f2f2f7;
  padding: 4px 8px;
  border-radius: 4px;
  font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
}

.edit-actions {
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

.action-icon {
  font-size: 14px;
}

.action-btn.cancel-btn:hover {
  border-color: #6c757d;
  background-color: #f5f5f5;
}

.action-btn.save-btn {
  background-color: #007AFF;
  color: white;
  border-color: #007AFF;
}

.action-btn.save-btn:hover:not(:disabled) {
  background-color: #0056b3;
  border-color: #0056b3;
}

.action-btn.save-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.note-edit-content {
  flex: 1;
  padding: 32px 40px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.edit-form-group {
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: hidden;
  position: relative;
}

.edit-content-textarea {
  flex: 1;
  padding: 20px;
  border: 2px solid #e5e5e5;
  border-radius: 12px;
  font-size: 16px;
  line-height: 1.6;
  font-family: inherit;
  background: white;
  resize: none;
  transition: all 0.2s;
  min-height: 100%;
}

.edit-content-textarea.full-height {
  height: 100%;
  min-height: 400px;
}

.edit-content-textarea:focus {
  outline: none;
  border-color: #007AFF;
}

.edit-content-textarea:disabled {
  background-color: #f8f9fa;
  cursor: not-allowed;
  opacity: 0.7;
}

.edit-content-textarea.saving {
  border-color: #007AFF;
  background-color: #f8fbff;
}

/* Loading Overlay */
.saving-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.9);
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  z-index: 10;
}

.saving-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid #e5e5e5;
  border-top: 3px solid #007AFF;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.saving-text {
  font-size: 16px;
  font-weight: 500;
  color: #007AFF;
}
</style>

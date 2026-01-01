<template>
  <BaseModal
    :show="show"
    title="AI Questions"
    size="large"
    :close-on-overlay-click="!loading"
    @close="$emit('close')"
  >
    <p class="ai-modal-description">Below is the prompt that will be passed along with this content:</p>

    <div class="form-group">
      <textarea
        v-model="localPrompt"
        class="form-textarea ai-prompt-textarea"
        placeholder="Enter your question or request about this note..."
        :disabled="loading"
        @keydown="handleKeydown"
      ></textarea>
    </div>

    <!-- AI Response Section -->
    <div v-if="response || loading" class="ai-response-section">
      <h4>AI Response:</h4>
      <div v-if="loading" class="ai-loading">
        <div class="ai-spinner"></div>
        <span>Getting AI response...</span>
      </div>
      <div v-else class="ai-response">
        {{ response }}
      </div>
    </div>

    <template #footer>
      <button @click="$emit('close')" class="btn btn-secondary" :disabled="loading">Close</button>
      <button @click="sendToAI" class="btn btn-primary ai-send-btn" :disabled="loading || !localPrompt.trim()">
        {{ loading ? 'Sending...' : 'Send to AI' }}
      </button>
    </template>
  </BaseModal>
</template>

<script>
import BaseModal from './shared/BaseModal.vue'

export default {
  name: 'AIQuestionModal',
  components: {
    BaseModal
  },
  props: {
    show: {
      type: Boolean,
      default: false
    },
    prompt: {
      type: String,
      default: 'Please summarize this content.'
    },
    response: {
      type: String,
      default: ''
    },
    loading: {
      type: Boolean,
      default: false
    }
  },
  data() {
    return {
      localPrompt: this.prompt
    }
  },
  watch: {
    prompt(newVal) {
      this.localPrompt = newVal
    },
    show(newVal) {
      if (newVal) {
        this.localPrompt = this.prompt
      }
    }
  },
  methods: {
    sendToAI() {
      this.$emit('send', this.localPrompt)
    },
    handleKeydown(event) {
      // Ctrl+Enter or Cmd+Enter to send to AI
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        event.preventDefault()
        if (!this.loading && this.localPrompt.trim()) {
          this.sendToAI()
        }
      }
      // Escape to close modal
      else if (event.key === 'Escape') {
        event.preventDefault()
        if (!this.loading) {
          this.$emit('close')
        }
      }
    }
  }
}
</script>

<style scoped>
/* AI Modal Specific Styles */
.ai-modal-description {
  color: #6c757d;
  font-size: 14px;
  margin-bottom: 16px;
  font-style: italic;
}

.form-group {
  margin-bottom: 20px;
}

.form-textarea {
  width: 100%;
  padding: 12px;
  border: 1px solid #d1d1d6;
  border-radius: 8px;
  font-size: 14px;
  font-family: inherit;
  transition: border-color 0.2s;
  box-sizing: border-box;
  resize: vertical;
  min-height: 200px;
  line-height: 1.5;
}

.form-textarea:focus {
  outline: none;
  border-color: #007AFF;
}

.ai-prompt-textarea {
  min-height: 120px;
  resize: vertical;
}

.ai-response-section {
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid #e9ecef;
}

.ai-response-section h4 {
  margin: 0 0 12px 0;
  font-size: 16px;
  font-weight: 600;
  color: #1c1c1e;
}

.ai-loading {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 20px;
  color: #6c757d;
  font-style: italic;
}

.ai-spinner {
  width: 20px;
  height: 20px;
  border: 2px solid #e9ecef;
  border-top: 2px solid #007AFF;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.ai-response {
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 8px;
  padding: 16px;
  font-size: 14px;
  line-height: 1.6;
  color: #1c1c1e;
  white-space: pre-wrap;
  word-wrap: break-word;
  max-height: 300px;
  overflow-y: auto;
}

/* Button Styles */
.btn {
  padding: 10px 20px;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  min-width: 80px;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-primary {
  background-color: #007AFF;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background-color: #0056b3;
}

.btn-secondary {
  background-color: #f8f9fa;
  color: #6c757d;
  border: 1px solid #d1d1d6;
}

.btn-secondary:hover:not(:disabled) {
  background-color: #e9ecef;
  border-color: #adb5bd;
}

.ai-send-btn {
  background-color: #007AFF !important;
  border-color: #007AFF !important;
}

.ai-send-btn:hover:not(:disabled) {
  background-color: #0056b3 !important;
  border-color: #0056b3 !important;
}
</style>

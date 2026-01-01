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
  color: var(--color-secondary);
  font-size: var(--font-size-sm);
  margin-bottom: var(--spacing-lg);
  font-style: italic;
}

.form-group {
  margin-bottom: var(--spacing-xl);
}

.form-textarea {
  width: 100%;
  padding: var(--spacing-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  font-size: var(--font-size-sm);
  font-family: inherit;
  transition: border-color var(--transition-fast);
  box-sizing: border-box;
  resize: vertical;
  min-height: 200px;
  line-height: 1.5;
}

.form-textarea:focus {
  outline: none;
  border-color: var(--color-primary);
}

.ai-prompt-textarea {
  min-height: 120px;
  resize: vertical;
}

.ai-response-section {
  margin-top: var(--spacing-xl);
  padding-top: var(--spacing-xl);
  border-top: 1px solid var(--color-bg-hover);
}

.ai-response-section h4 {
  margin: 0 0 var(--spacing-md) 0;
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}

.ai-loading {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-xl);
  color: var(--color-secondary);
  font-style: italic;
}

.ai-spinner {
  width: 20px;
  height: 20px;
  border: 2px solid var(--color-bg-hover);
  border-top: 2px solid var(--color-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.ai-response {
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-bg-hover);
  border-radius: var(--radius-lg);
  padding: var(--spacing-lg);
  font-size: var(--font-size-sm);
  line-height: 1.6;
  color: var(--color-text-primary);
  white-space: pre-wrap;
  word-wrap: break-word;
  max-height: 300px;
  overflow-y: auto;
}

/* Button styles now use global .btn classes from buttons.css */
/* Only component-specific overrides here */
.ai-send-btn {
  background-color: var(--color-primary) !important;
  border-color: var(--color-primary) !important;
}

.ai-send-btn:hover:not(:disabled) {
  background-color: var(--color-primary-hover) !important;
  border-color: var(--color-primary-hover) !important;
}
</style>

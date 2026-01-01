<template>
  <div class="upload-notes">
    <h1>Create a Note</h1>
    <p class="subtitle">Write your content below - we'll automatically generate a title for you!</p>
    <form @submit.prevent="submitNote" class="note-form">
      <div class="form-group">
        <label for="content">Note Content:</label>
        <textarea 
          id="content" 
          v-model="note.content" 
          required 
          rows="12" 
          placeholder="Start typing your thoughts, ideas, recipes, plans, or anything else..."
        ></textarea>
      </div>
      
      <button type="submit" :disabled="loading">
        {{ loading ? 'Saving...' : 'Save Note' }}
      </button>
    </form>
    
    <div v-if="message" :class="['message', messageType]">
      {{ message }}
    </div>
  </div>
</template>

<script>
import axios from 'axios'
import { API_URL } from '../utils/api'
import { useApi } from '../composables/useApi'

export default {
  name: 'UploadNotes',
  setup() {
    const api = useApi()
    return { api }
  },
  data() {
    return {
      note: {
        content: ''
      },
      loading: false,
      message: '',
      messageType: ''
    }
  },
  methods: {
    async submitNote() {
      this.loading = true
      this.message = ''

      try {
        await this.api.request(async () => {
          const response = await axios.post(`${API_URL}/notes`, {
            content: this.note.content
          })

          this.message = `Note saved successfully with title: "${response.data.title}"`
          this.messageType = 'success'
          this.note.content = ''
        })
      } catch (error) {
        this.message = 'Error saving note. Please try again.'
        this.messageType = 'error'
      } finally {
        this.loading = false
      }
    }
  }
}
</script>

<style scoped>
.upload-notes {
  max-width: 600px;
  margin: 0 auto;
  padding: var(--spacing-xl);
}

.note-form {
  background: var(--color-bg-light);
  padding: var(--spacing-xxxl);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
}

.form-group {
  margin-bottom: var(--spacing-xl);
}

label {
  display: block;
  margin-bottom: 5px;
  font-weight: var(--font-weight-bold);
  color: var(--color-text-secondary);
}

input[type="text"],
textarea {
  width: 100%;
  padding: 10px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-md);
  box-sizing: border-box;
}

textarea {
  resize: vertical;
  min-height: 150px;
}

button {
  background-color: var(--color-success);
  color: white;
  padding: var(--spacing-md) var(--spacing-xxl);
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: var(--font-size-md);
  transition: background-color var(--transition-normal);
}

button:hover:not(:disabled) {
  background-color: var(--color-success-hover);
}

button:disabled {
  background-color: #ccc;
  cursor: not-allowed;
}

.message {
  margin-top: var(--spacing-xl);
  padding: 10px;
  border-radius: var(--radius-sm);
  text-align: center;
}

.message.success {
  background-color: var(--color-success-light);
  color: #155724;
  border: 1px solid var(--color-success-border);
}

.message.error {
  background-color: var(--color-danger-light);
  color: var(--color-danger-text);
  border: 1px solid var(--color-danger-border);
}

h1 {
  text-align: center;
  color: var(--color-text-heading);
  margin-bottom: 10px;
}

.subtitle {
  text-align: center;
  color: var(--color-text-muted);
  margin-bottom: var(--spacing-xxxl);
  font-style: italic;
}
</style>
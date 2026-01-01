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
  padding: 20px;
}

.note-form {
  background: #f9f9f9;
  padding: 30px;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
}

.form-group {
  margin-bottom: 20px;
}

label {
  display: block;
  margin-bottom: 5px;
  font-weight: bold;
  color: #333;
}

input[type="text"],
textarea {
  width: 100%;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 16px;
  box-sizing: border-box;
}

textarea {
  resize: vertical;
  min-height: 150px;
}

button {
  background-color: #42b983;
  color: white;
  padding: 12px 24px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 16px;
  transition: background-color 0.3s;
}

button:hover:not(:disabled) {
  background-color: #369870;
}

button:disabled {
  background-color: #ccc;
  cursor: not-allowed;
}

.message {
  margin-top: 20px;
  padding: 10px;
  border-radius: 4px;
  text-align: center;
}

.message.success {
  background-color: #d4edda;
  color: #155724;
  border: 1px solid #c3e6cb;
}

.message.error {
  background-color: #f8d7da;
  color: #721c24;
  border: 1px solid #f5c6cb;
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
  font-style: italic;
}
</style>
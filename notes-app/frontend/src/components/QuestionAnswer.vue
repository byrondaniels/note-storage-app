<template>
  <div class="question-answer">
    <h1>Ask Your Notes</h1>
    <p class="subtitle">Ask questions about your notes and get AI-powered answers</p>
    
    <!-- Question Input -->
    <div class="question-form">
      <div class="input-group">
        <input 
          type="text" 
          v-model="currentQuestion" 
          @keyup.enter="askQuestion"
          placeholder="What recipes use tomatoes? How many workout sessions this month? What are my goals?"
          class="question-input"
          :disabled="loading"
        />
        <button 
          @click="askQuestion" 
          :disabled="loading || !currentQuestion.trim()"
          class="ask-button"
        >
          {{ loading ? 'Thinking...' : 'Ask' }}
        </button>
      </div>
    </div>

    <!-- Error Message -->
    <div v-if="error" class="error-message">
      {{ error }}
    </div>

    <!-- Conversation History -->
    <div v-if="conversations.length > 0" class="conversation-history">
      <div v-for="(qa, index) in conversations" :key="index" class="conversation-item">
        <!-- Question -->
        <div class="question-bubble">
          <div class="question-header">
            <span class="question-icon">❓</span>
            <span class="question-label">You asked:</span>
          </div>
          <p>{{ qa.question }}</p>
        </div>
        
        <!-- Answer -->
        <div class="answer-bubble">
          <div class="answer-header">
            <span class="answer-icon">🤖</span>
            <span class="answer-label">AI Answer:</span>
          </div>
          <p class="answer-text">{{ qa.answer }}</p>
          
          <!-- Sources -->
          <div v-if="qa.sources && qa.sources.length > 0" class="sources-section">
            <h4>Sources from your notes:</h4>
            <div class="sources-grid">
              <div 
                v-for="source in qa.sources" 
                :key="source.note.id" 
                class="source-card"
              >
                <div class="source-header">
                  <h5>{{ source.note.title }}</h5>
                  <span class="relevance-score">{{ Math.round(source.score * 100) }}% relevant</span>
                </div>
                <p class="source-content">{{ getPreview(source.note.content, 120) }}</p>
                <div class="source-meta">
                  <CategoryBadge :category="source.note.category" />
                  <span class="source-date">{{ formatDate(source.note.created) }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-if="conversations.length === 0 && !loading" class="empty-state">
      <div class="empty-icon">🧠</div>
      <h3>Your Personal AI Assistant</h3>
      <p>Ask questions about your notes and get intelligent answers based on your own content.</p>
      <div class="example-questions">
        <h4>Try asking:</h4>
        <ul>
          <li>"What are my favorite recipes?"</li>
          <li>"How often do I work out?"</li>
          <li>"What did I learn about machine learning?"</li>
          <li>"What are my thoughts on productivity?"</li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script>
import { formatCategoryName, formatDate, getPreview } from '../utils/formatters'
import { API_URL } from '../utils/api'
import CategoryBadge from './shared/CategoryBadge.vue'

export default {
  name: 'QuestionAnswer',
  components: {
    CategoryBadge
  },
  data() {
    return {
      currentQuestion: '',
      conversations: [],
      loading: false,
      error: null
    }
  },
  methods: {
    formatCategoryName,
    formatDate,
    getPreview,
    async askQuestion() {
      if (!this.currentQuestion.trim() || this.loading) return

      this.loading = true
      this.error = null
      const question = this.currentQuestion.trim()

      try {
        const response = await fetch(`${API_URL}/ask`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ question })
        })

        if (!response.ok) {
          throw new Error('Failed to get answer')
        }

        const data = await response.json()
        
        // Add to conversation history
        this.conversations.unshift({
          question: data.question,
          answer: data.answer,
          sources: data.sources
        })

        // Clear input
        this.currentQuestion = ''

      } catch (error) {
        console.error('Error asking question:', error)
        this.error = 'Failed to get an answer. Please try again.'
      } finally {
        this.loading = false
      }
    }
  }
}
</script>

<style scoped>
.question-answer {
  max-width: 1000px;
  margin: 0 auto;
  padding: 2rem;
}

.question-answer h1 {
  text-align: center;
  color: #333;
  margin-bottom: 0.5rem;
}

.subtitle {
  text-align: center;
  color: #666;
  margin-bottom: 2rem;
  font-size: 1.1rem;
}

.question-form {
  margin-bottom: 2rem;
  background: #f8f9fa;
  padding: 1.5rem;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.input-group {
  display: flex;
  gap: 1rem;
}

.question-input {
  flex: 1;
  padding: 1rem 1.5rem;
  border: 2px solid #e1e5e9;
  border-radius: 8px;
  font-size: 1rem;
  transition: border-color 0.3s;
}

.question-input:focus {
  outline: none;
  border-color: #007bff;
}

.question-input:disabled {
  background-color: #f5f5f5;
  cursor: not-allowed;
}

.ask-button {
  background: #007bff;
  color: white;
  border: none;
  padding: 1rem 2rem;
  border-radius: 8px;
  font-size: 1rem;
  cursor: pointer;
  transition: background-color 0.3s;
  min-width: 120px;
}

.ask-button:hover:not(:disabled) {
  background: #0056b3;
}

.ask-button:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.error-message {
  background-color: #f8d7da;
  color: #721c24;
  padding: 1rem;
  border-radius: 8px;
  border: 1px solid #f5c6cb;
  margin-bottom: 1rem;
  text-align: center;
}

.conversation-history {
  margin-top: 2rem;
}

.conversation-item {
  margin-bottom: 2rem;
}

.question-bubble {
  background: #e3f2fd;
  border: 1px solid #bbdefb;
  border-radius: 12px;
  padding: 1.5rem;
  margin-bottom: 1rem;
  margin-left: 2rem;
}

.question-header {
  display: flex;
  align-items: center;
  margin-bottom: 0.5rem;
  font-weight: 600;
  color: #1976d2;
}

.question-icon {
  margin-right: 0.5rem;
  font-size: 1.2rem;
}

.question-bubble p {
  margin: 0;
  font-size: 1.1rem;
  color: #333;
}

.answer-bubble {
  background: #f1f8e9;
  border: 1px solid #c8e6c9;
  border-radius: 12px;
  padding: 1.5rem;
  margin-right: 2rem;
}

.answer-header {
  display: flex;
  align-items: center;
  margin-bottom: 1rem;
  font-weight: 600;
  color: #388e3c;
}

.answer-icon {
  margin-right: 0.5rem;
  font-size: 1.2rem;
}

.answer-text {
  margin: 0 0 1.5rem 0;
  line-height: 1.6;
  color: #333;
  font-size: 1.05rem;
}

.sources-section {
  border-top: 1px solid #ddd;
  padding-top: 1rem;
  margin-top: 1rem;
}

.sources-section h4 {
  margin: 0 0 1rem 0;
  color: #555;
  font-size: 0.95rem;
}

.sources-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1rem;
}

.source-card {
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 1rem;
  font-size: 0.9rem;
}

.source-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 0.5rem;
}

.source-header h5 {
  margin: 0;
  color: #333;
  font-size: 0.95rem;
  flex: 1;
}

.relevance-score {
  background: #e3f2fd;
  color: #1976d2;
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
  font-size: 0.8rem;
  margin-left: 0.5rem;
}

.source-content {
  color: #666;
  margin: 0.5rem 0;
  line-height: 1.4;
}

.source-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 0.5rem;
  font-size: 0.8rem;
}

.source-date {
  color: #999;
}

.empty-state {
  text-align: center;
  padding: 3rem;
  color: #666;
}

.empty-icon {
  font-size: 4rem;
  margin-bottom: 1rem;
}

.empty-state h3 {
  color: #333;
  margin-bottom: 1rem;
}

.example-questions {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 1.5rem;
  margin-top: 2rem;
  text-align: left;
  max-width: 500px;
  margin-left: auto;
  margin-right: auto;
}

.example-questions h4 {
  margin: 0 0 1rem 0;
  color: #333;
  text-align: center;
}

.example-questions ul {
  margin: 0;
  padding-left: 1.5rem;
}

.example-questions li {
  margin-bottom: 0.5rem;
  color: #555;
  font-style: italic;
}
</style>
<template>
  <div class="search-notes">
    <h1>Search Notes</h1>
    
    <div class="search-form">
      <div class="search-input-group">
        <input 
          type="text" 
          v-model="searchQuery" 
          @keyup.enter="performSearch"
          placeholder="Search your notes using natural language..."
          class="search-input"
          :disabled="loading"
        />
        <button 
          @click="performSearch" 
          :disabled="loading || !searchQuery.trim()"
          class="search-button"
        >
          {{ loading ? 'Searching...' : 'Search' }}
        </button>
      </div>
      
      <div class="search-options">
        <label>
          Results:
          <select v-model="searchLimit" class="limit-select">
            <option value="5">5</option>
            <option value="10">10</option>
            <option value="20">20</option>
            <option value="50">50</option>
          </select>
        </label>
      </div>
    </div>

    <div v-if="error" class="error-message">
      {{ error }}
    </div>

    <div v-if="hasSearched && searchResults.length === 0 && !loading" class="no-results">
      No notes found matching your search. Try different keywords or phrases.
    </div>

    <div v-if="searchResults.length > 0" class="search-results">
      <div class="results-header">
        <h2>Search Results ({{ searchResults.length }})</h2>
        <p class="search-info">Showing results for: "<strong>{{ lastSearchQuery }}</strong>"</p>
      </div>
      
      <div class="results-grid">
        <div 
          v-for="result in searchResults" 
          :key="result.note.id" 
          class="result-card"
          :class="{ 'high-score': result.score > 0.8, 'medium-score': result.score > 0.6 }"
        >
          <div class="result-header">
            <div class="result-title-section">
              <h3>{{ result.note.title }}</h3>
              <span v-if="result.note.category" class="category-badge">{{ formatCategoryName(result.note.category) }}</span>
            </div>
            <div class="result-score">
              <span class="score-label">Relevance:</span>
              <span class="score-value">{{ Math.round(result.score * 100) }}%</span>
            </div>
          </div>
          
          <div class="result-content">
            <p>{{ getPreview(result.note.content, 200) }}</p>
          </div>
          
          <div class="result-footer">
            <span class="result-date">
              Created: {{ formatDate(result.note.created, { includeTime: true }) }}
            </span>
            <button @click="expandNote(result.note)" class="expand-button">
              View Full Note
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal for expanded note view -->
    <BaseModal
      :show="!!expandedNote"
      size="xlarge"
      @close="closeModal"
    >
      <template #header>
        <div class="modal-title-section">
          <h2>{{ expandedNote?.title }}</h2>
          <span v-if="expandedNote?.category" class="category-badge">{{ formatCategoryName(expandedNote.category) }}</span>
        </div>
      </template>

      <div class="note-meta">
        Created: {{ formatDate(expandedNote.created, { includeTime: true }) }}
      </div>
      <div class="note-content">
        {{ expandedNote.content }}
      </div>
    </BaseModal>
  </div>
</template>

<script>
import axios from 'axios'
import { formatCategoryName, formatDate, getPreview } from '../utils/formatters'
import { API_URL } from '../utils/api'
import BaseModal from './shared/BaseModal.vue'

export default {
  name: 'SearchNotes',
  components: {
    BaseModal
  },
  data() {
    return {
      searchQuery: '',
      searchLimit: 10,
      loading: false,
      error: '',
      searchResults: [],
      hasSearched: false,
      lastSearchQuery: '',
      expandedNote: null
    }
  },
  methods: {
    formatCategoryName,
    formatDate,
    getPreview,
    async performSearch() {
      if (!this.searchQuery.trim()) return

      this.loading = true
      this.error = ''
      this.lastSearchQuery = this.searchQuery

      try {
        const response = await axios.post(`${API_URL}/search`, {
          query: this.searchQuery,
          limit: parseInt(this.searchLimit)
        })

        this.searchResults = response.data || []
        this.hasSearched = true
      } catch (error) {
        this.error = 'Search failed. Please try again.'
        console.error('Search error:', error)
        this.searchResults = []
      } finally {
        this.loading = false
      }
    },

    expandNote(note) {
      this.expandedNote = note
    },

    closeModal() {
      this.expandedNote = null
    }
  }
}
</script>

<style scoped>
.search-notes {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

h1 {
  text-align: center;
  color: #2c3e50;
  margin-bottom: 30px;
}

.search-form {
  background: #f9f9f9;
  padding: 25px;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
  margin-bottom: 30px;
}

.search-input-group {
  display: flex;
  gap: 10px;
  margin-bottom: 15px;
}

.search-input {
  flex: 1;
  padding: 12px 15px;
  border: 2px solid #ddd;
  border-radius: 6px;
  font-size: 16px;
  transition: border-color 0.3s;
}

.search-input:focus {
  outline: none;
  border-color: #42b983;
}

.search-input:disabled {
  background-color: #f5f5f5;
  cursor: not-allowed;
}

.search-button {
  background-color: #42b983;
  color: white;
  padding: 12px 24px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 16px;
  font-weight: 500;
  transition: background-color 0.3s;
  min-width: 120px;
}

.search-button:hover:not(:disabled) {
  background-color: #369870;
}

.search-button:disabled {
  background-color: #ccc;
  cursor: not-allowed;
}

.search-options {
  display: flex;
  align-items: center;
  gap: 20px;
}

.search-options label {
  font-weight: 500;
  color: #555;
}

.limit-select {
  margin-left: 8px;
  padding: 5px 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.error-message {
  background-color: #f8d7da;
  color: #721c24;
  padding: 12px;
  border-radius: 4px;
  border: 1px solid #f5c6cb;
  margin-bottom: 20px;
  text-align: center;
}

.no-results {
  text-align: center;
  padding: 40px;
  color: #7f8c8d;
  font-size: 18px;
}

.search-results {
  margin-top: 30px;
}

.results-header {
  margin-bottom: 25px;
}

.results-header h2 {
  color: #2c3e50;
  margin-bottom: 8px;
}

.search-info {
  color: #7f8c8d;
  font-style: italic;
}

.results-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 20px;
}

.result-card {
  background: white;
  border: 1px solid #e1e8ed;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  transition: transform 0.2s, box-shadow 0.2s;
}

.result-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0,0,0,0.15);
}

.result-card.high-score {
  border-left: 4px solid #27ae60;
}

.result-card.medium-score {
  border-left: 4px solid #f39c12;
}

.result-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 15px;
}

.result-title-section {
  flex: 1;
  margin-right: 15px;
}

.result-header h3 {
  margin: 0 0 8px 0;
  color: #2c3e50;
  font-size: 18px;
}

.category-badge {
  background: #e9ecef;
  color: #495057;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
}

.result-score {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  font-size: 12px;
}

.score-label {
  color: #7f8c8d;
  margin-bottom: 2px;
}

.score-value {
  font-weight: bold;
  color: #27ae60;
  font-size: 14px;
}

.result-content p {
  color: #555;
  line-height: 1.6;
  margin-bottom: 15px;
  white-space: pre-wrap;
}

.result-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-top: 1px solid #eee;
  padding-top: 15px;
}

.result-date {
  color: #7f8c8d;
  font-size: 12px;
}

.expand-button {
  background-color: #3498db;
  color: white;
  padding: 6px 12px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  transition: background-color 0.3s;
}

.expand-button:hover {
  background-color: #2980b9;
}

/* Modal styles - Base styles moved to BaseModal.vue */

.modal-title-section {
  flex: 1;
}

.modal-title-section h2 {
  margin: 0 0 8px 0;
  color: #2c3e50;
}

.note-meta {
  color: #7f8c8d;
  font-size: 14px;
  margin-bottom: 20px;
  padding-bottom: 10px;
  border-bottom: 1px solid #eee;
}

.note-content {
  color: #333;
  line-height: 1.6;
  white-space: pre-wrap;
  word-wrap: break-word;
}
</style>
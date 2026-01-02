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
            <option value="1">1</option>
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
              <CategoryBadge :category="result.note.category" />
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
          <CategoryBadge :category="expandedNote?.category" />
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
import CategoryBadge from './shared/CategoryBadge.vue'
import { useApi } from '../composables/useApi'

export default {
  name: 'SearchNotes',
  components: {
    BaseModal,
    CategoryBadge
  },
  setup() {
    const api = useApi()
    return { api }
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

      this.lastSearchQuery = this.searchQuery

      await this.api.request(async () => {
        const response = await axios.post(`${API_URL}/search`, {
          query: this.searchQuery,
          limit: parseInt(this.searchLimit)
        })

        this.searchResults = response.data || []
        this.hasSearched = true
      })
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
  padding: var(--spacing-xl);
}

h1 {
  text-align: center;
  color: var(--color-text-heading);
  margin-bottom: var(--spacing-xxxl);
}

.search-form {
  background: var(--color-bg-light);
  padding: 25px;
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
  margin-bottom: var(--spacing-xxxl);
}

.search-input-group {
  display: flex;
  gap: 10px;
  margin-bottom: var(--spacing-lg);
}

.search-input {
  flex: 1;
  padding: var(--spacing-md) var(--spacing-lg);
  border: 2px solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: var(--font-size-md);
  transition: border-color var(--transition-normal);
}

.search-input:focus {
  outline: none;
  border-color: var(--color-success);
}

.search-input:disabled {
  background-color: #f5f5f5;
  cursor: not-allowed;
}

.search-button {
  background-color: var(--color-success);
  color: white;
  padding: var(--spacing-md) var(--spacing-xxl);
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-medium);
  transition: background-color var(--transition-normal);
  min-width: 120px;
}

.search-button:hover:not(:disabled) {
  background-color: var(--color-success-hover);
}

.search-button:disabled {
  background-color: #ccc;
  cursor: not-allowed;
}

.search-options {
  display: flex;
  align-items: center;
  gap: var(--spacing-xl);
}

.search-options label {
  font-weight: var(--font-weight-medium);
  color: var(--color-text-tertiary);
}

.limit-select {
  margin-left: var(--spacing-sm);
  padding: 5px 10px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
}

.error-message {
  background-color: var(--color-danger-light);
  color: var(--color-danger-text);
  padding: var(--spacing-md);
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-danger-border);
  margin-bottom: var(--spacing-xl);
  text-align: center;
}

.no-results {
  text-align: center;
  padding: 40px;
  color: #7f8c8d;
  font-size: var(--font-size-lg);
}

.search-results {
  margin-top: var(--spacing-xxxl);
}

.results-header {
  margin-bottom: 25px;
}

.results-header h2 {
  color: var(--color-text-heading);
  margin-bottom: var(--spacing-sm);
}

.search-info {
  color: #7f8c8d;
  font-style: italic;
}

.results-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: var(--spacing-xl);
}

.result-card {
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-lg);
  padding: var(--spacing-xl);
  box-shadow: var(--shadow-sm);
  transition: transform var(--transition-fast), box-shadow var(--transition-fast);
}

.result-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0,0,0,0.15);
}

.result-card.high-score {
  border-left: 4px solid var(--color-success-dark);
}

.result-card.medium-score {
  border-left: 4px solid var(--color-warning);
}

.result-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: var(--spacing-lg);
}

.result-title-section {
  flex: 1;
  margin-right: var(--spacing-lg);
}

.result-header h3 {
  margin: 0 0 var(--spacing-sm) 0;
  color: var(--color-text-heading);
  font-size: var(--font-size-lg);
}

.result-score {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  font-size: var(--font-size-xs);
}

.score-label {
  color: #7f8c8d;
  margin-bottom: 2px;
}

.score-value {
  font-weight: var(--font-weight-bold);
  color: var(--color-success-dark);
  font-size: var(--font-size-sm);
}

.result-content p {
  color: var(--color-text-tertiary);
  line-height: 1.6;
  margin-bottom: var(--spacing-lg);
  white-space: pre-wrap;
}

.result-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-top: 1px solid var(--color-border-lighter);
  padding-top: var(--spacing-lg);
}

.result-date {
  color: #7f8c8d;
  font-size: var(--font-size-xs);
}

.expand-button {
  background-color: var(--color-info);
  color: white;
  padding: 6px 12px;
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: var(--font-size-xs);
  transition: background-color var(--transition-normal);
}

.expand-button:hover {
  background-color: var(--color-info-hover);
}

/* Modal styles - Base styles moved to BaseModal.vue */

.modal-title-section {
  flex: 1;
}

.modal-title-section h2 {
  margin: 0 0 var(--spacing-sm) 0;
  color: var(--color-text-heading);
}

.note-meta {
  color: #7f8c8d;
  font-size: var(--font-size-sm);
  margin-bottom: var(--spacing-xl);
  padding-bottom: 10px;
  border-bottom: 1px solid var(--color-border-lighter);
}

.note-content {
  color: var(--color-text-secondary);
  line-height: 1.6;
  white-space: pre-wrap;
  word-wrap: break-word;
}
</style>
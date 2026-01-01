<template>
  <div class="category-browser">
    <h1>Browse by Category</h1>
    
    <!-- Loading state -->
    <div v-if="loading" class="loading">
      Loading categories...
    </div>
    
    <!-- Category Grid -->
    <div v-else-if="!selectedCategory" class="category-grid">
      <div v-for="category in categories" 
           :key="category.name"
           @click="selectCategory(category.name)"
           class="category-card"
           :class="{ 'has-notes': category.count > 0 }">
        <h3>{{ formatCategoryName(category.name) }}</h3>
        <span class="note-count">{{ category.count }} notes</span>
      </div>
    </div>
    
    <!-- Selected Category Notes -->
    <div v-else class="category-notes">
      <div class="category-header">
        <button @click="goBack" class="back-button">← Back to Categories</button>
        <h2>{{ formatCategoryName(selectedCategory) }}</h2>
        <p class="category-description">{{ categoryNotes.length }} notes in this category</p>
      </div>
      
      <!-- Notes loading -->
      <div v-if="notesLoading" class="loading">
        Loading notes...
      </div>
      
      <!-- Notes grid -->
      <div v-else-if="categoryNotes.length > 0" class="notes-grid">
        <div v-for="note in categoryNotes" 
             :key="note.id" 
             class="note-card">
          <h4>{{ note.title }}</h4>
          <p class="note-preview">{{ getPreview(note.content, 150) }}</p>
          <div class="note-meta">
            <span class="note-date">{{ formatDate(note.created, { includeTime: true }) }}</span>
            <CategoryBadge :category="note.category" />
          </div>
        </div>
      </div>
      
      <!-- No notes message -->
      <div v-else class="no-notes">
        <p>No notes found in this category.</p>
        <p>Notes will automatically appear here when you create them with relevant content.</p>
      </div>
    </div>
  </div>
</template>

<script>
import { formatCategoryName, formatDate, getPreview } from '../utils/formatters'
import { API_URL } from '../utils/api'
import CategoryBadge from './shared/CategoryBadge.vue'

export default {
  name: 'CategoryBrowser',
  components: {
    CategoryBadge
  },
  data() {
    return {
      categories: [],
      selectedCategory: null,
      categoryNotes: [],
      loading: true,
      notesLoading: false,
      error: null
    }
  },
  async mounted() {
    await this.loadCategories()
  },
  methods: {
    formatCategoryName,
    formatDate,
    getPreview,
    async loadCategories() {
      try {
        this.loading = true
        const response = await fetch(`${API_URL}/categories`)
        if (!response.ok) throw new Error('Failed to fetch categories')
        
        this.categories = await response.json()
        // Sort categories: ones with notes first, then alphabetically
        this.categories.sort((a, b) => {
          if (a.count !== b.count) {
            return b.count - a.count // Higher count first
          }
          return a.name.localeCompare(b.name) // Alphabetical for same count
        })
      } catch (error) {
        console.error('Error loading categories:', error)
        this.error = 'Failed to load categories'
      } finally {
        this.loading = false
      }
    },
    
    async selectCategory(categoryName) {
      try {
        this.selectedCategory = categoryName
        this.notesLoading = true

        const response = await fetch(`${API_URL}/notes/category/${categoryName}`)
        if (!response.ok) throw new Error('Failed to fetch notes')
        
        this.categoryNotes = await response.json()
      } catch (error) {
        console.error('Error loading category notes:', error)
        this.error = 'Failed to load notes for this category'
      } finally {
        this.notesLoading = false
      }
    },
    
    goBack() {
      this.selectedCategory = null
      this.categoryNotes = []
    }
  }
}
</script>

<style scoped>
.category-browser {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}

.category-browser h1 {
  color: #333;
  margin-bottom: 2rem;
  text-align: center;
}

.loading {
  text-align: center;
  padding: 2rem;
  color: #666;
}

.category-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.category-card {
  background: white;
  border: 2px solid #e1e5e9;
  border-radius: 12px;
  padding: 1.5rem;
  cursor: pointer;
  transition: all 0.3s ease;
  text-align: center;
}

.category-card:hover {
  border-color: #007bff;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 123, 255, 0.15);
}

.category-card.has-notes {
  border-color: #28a745;
}

.category-card.has-notes:hover {
  border-color: #007bff;
  background-color: #f8f9fa;
}

.category-card h3 {
  margin: 0 0 0.5rem 0;
  color: #333;
  font-size: 1.1rem;
}

.note-count {
  color: #666;
  font-size: 0.9rem;
}

.category-card.has-notes .note-count {
  color: #28a745;
  font-weight: bold;
}

.category-header {
  margin-bottom: 2rem;
}

.back-button {
  background: #6c757d;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  cursor: pointer;
  margin-bottom: 1rem;
  font-size: 0.9rem;
}

.back-button:hover {
  background: #545b62;
}

.category-header h2 {
  margin: 0.5rem 0;
  color: #333;
}

.category-description {
  color: #666;
  margin: 0;
}

.notes-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1.5rem;
}

.note-card {
  background: white;
  border: 1px solid #dee2e6;
  border-radius: 8px;
  padding: 1.5rem;
  transition: all 0.2s ease;
}

.note-card:hover {
  border-color: #007bff;
  box-shadow: 0 2px 8px rgba(0, 123, 255, 0.1);
}

.note-card h4 {
  margin: 0 0 0.5rem 0;
  color: #333;
  font-size: 1.1rem;
}

.note-preview {
  color: #666;
  line-height: 1.4;
  margin: 0.5rem 0 1rem 0;
}

.note-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.85rem;
}

.note-date {
  color: #999;
}

.no-notes {
  text-align: center;
  padding: 3rem;
  color: #666;
}

.no-notes p {
  margin: 0.5rem 0;
}

.error {
  color: #dc3545;
  text-align: center;
  padding: 1rem;
  background: #f8d7da;
  border: 1px solid #f5c6cb;
  border-radius: 4px;
  margin: 1rem 0;
}
</style>
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
import { useApi } from '../composables/useApi'

export default {
  name: 'CategoryBrowser',
  components: {
    CategoryBadge
  },
  setup() {
    const api = useApi()
    return { api }
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
      this.loading = true
      try {
        await this.api.request(async () => {
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
        })
      } finally {
        this.loading = false
      }
    },
    
    async selectCategory(categoryName) {
      this.selectedCategory = categoryName
      this.notesLoading = true

      try {
        await this.api.request(async () => {
          const response = await fetch(`${API_URL}/notes/category/${categoryName}`)
          if (!response.ok) throw new Error('Failed to fetch notes')

          this.categoryNotes = await response.json()
        })
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
  color: var(--color-text-secondary);
  margin-bottom: 2rem;
  text-align: center;
}

.loading {
  text-align: center;
  padding: 2rem;
  color: var(--color-text-muted);
}

.category-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.category-card {
  background: var(--color-bg-primary);
  border: 2px solid var(--color-border-light);
  border-radius: var(--radius-xl);
  padding: 1.5rem;
  cursor: pointer;
  transition: all var(--transition-normal) ease;
  text-align: center;
}

.category-card:hover {
  border-color: var(--color-primary);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 123, 255, 0.15);
}

.category-card.has-notes {
  border-color: var(--color-success-dark);
}

.category-card.has-notes:hover {
  border-color: var(--color-primary);
  background-color: var(--color-bg-secondary);
}

.category-card h3 {
  margin: 0 0 0.5rem 0;
  color: var(--color-text-secondary);
  font-size: 1.1rem;
}

.note-count {
  color: var(--color-text-muted);
  font-size: 0.9rem;
}

.category-card.has-notes .note-count {
  color: var(--color-success-dark);
  font-weight: var(--font-weight-bold);
}

.category-header {
  margin-bottom: 2rem;
}

.back-button {
  background: var(--color-secondary);
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: var(--radius-md);
  cursor: pointer;
  margin-bottom: 1rem;
  font-size: 0.9rem;
}

.back-button:hover {
  background: var(--color-secondary-hover);
}

.category-header h2 {
  margin: 0.5rem 0;
  color: var(--color-text-secondary);
}

.category-description {
  color: var(--color-text-muted);
  margin: 0;
}

.notes-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1.5rem;
}

.note-card {
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border-dark);
  border-radius: var(--radius-lg);
  padding: 1.5rem;
  transition: all var(--transition-fast) ease;
}

.note-card:hover {
  border-color: var(--color-primary);
  box-shadow: 0 2px 8px rgba(0, 123, 255, 0.1);
}

.note-card h4 {
  margin: 0 0 0.5rem 0;
  color: var(--color-text-secondary);
  font-size: 1.1rem;
}

.note-preview {
  color: var(--color-text-muted);
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
  color: var(--color-text-lighter);
}

.no-notes {
  text-align: center;
  padding: 3rem;
  color: var(--color-text-muted);
}

.no-notes p {
  margin: 0.5rem 0;
}

.error {
  color: var(--color-danger-dark);
  text-align: center;
  padding: 1rem;
  background: var(--color-danger-light);
  border: 1px solid var(--color-danger-border);
  border-radius: var(--radius-sm);
  margin: 1rem 0;
}
</style>
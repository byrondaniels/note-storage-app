<template>
  <div class="view-notes">
    <div v-if="loading" class="loading">
      Loading notes...
    </div>
    
    <div v-else-if="error" class="error">
      {{ error }}
    </div>
    
    <div v-else-if="notes.length === 0" class="no-notes">
      No notes found. <router-link to="/">Create your first note!</router-link>
    </div>
    
    <!-- Categories Section - spans full width above both panels -->
    <div v-else class="notes-interface">
      <div class="categories-section">
        <div class="categories-header" @click="toggleCategories">
          <span class="categories-title">Browse Categories</span>
          <span class="expand-arrow" :class="{ 'expanded': showCategories }">▼</span>
        </div>
        
        <div v-if="showCategories" class="categories-content">
          <div v-if="categoriesLoading" class="categories-loading">
            Loading categories...
          </div>
          
          <div v-else class="categories-grid">
            <div 
              v-for="category in categories" 
              :key="category.name"
              @click="selectCategory(category.name)"
              class="category-pill"
              :class="{ 
                'active': selectedCategory === category.name,
                'has-notes': category.count > 0 
              }"
            >
              <span class="category-name">{{ formatCategoryName(category.name) }}</span>
              <span class="category-count">{{ category.count }}</span>
            </div>
            
            <!-- Clear category filter -->
            <div 
              v-if="selectedCategory"
              @click="clearCategoryFilter"
              class="category-pill clear-filter"
            >
              <span class="category-name">Show All</span>
              <span class="clear-icon">×</span>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Two-panel layout below categories -->
      <div class="notes-container">
        <!-- Left Sidebar: Note List -->
        <div class="notes-sidebar">
          <div class="sidebar-header">
            <h2>Your Notes</h2>
            <div class="header-actions">
              <button @click="createNewNote" class="new-note-btn" title="Create new note">
                <span class="action-icon">+</span>
                New Note
              </button>
              <button @click="refreshNotes" class="refresh-btn" :disabled="loading">
                {{ loading ? '⟳' : '⟳' }}
              </button>
            </div>
          </div>

        <!-- Search Bar -->
        <div class="search-section">
          <div class="search-input-group">
            <input 
              type="text" 
              v-model="searchQuery" 
              @input="handleSearch"
              @keyup.enter="performSearch"
              placeholder="Search your notes..."
              class="search-input"
              :disabled="loading"
            />
            <button 
              v-if="searchQuery" 
              @click="clearSearch" 
              class="clear-search-btn"
              title="Clear search"
            >
              ×
            </button>
          </div>
          
          <!-- Active Filter Indicator -->
          <div v-if="selectedCategory && !searchQuery" class="active-filter">
            <span class="filter-label">Filtering by:</span>
            <span class="filter-value">{{ formatCategoryName(selectedCategory) }}</span>
            <button @click="clearCategoryFilter" class="filter-clear">×</button>
          </div>
        </div>
        
        <div class="notes-list">
          <!-- Search Status -->
          <div v-if="isSearching" class="search-status">
            <div class="search-info">
              <span v-if="searchQuery">Searching for "{{ searchQuery }}"...</span>
              <span v-else>Loading notes...</span>
            </div>
          </div>
          
          <!-- No Results -->
          <div v-if="searchQuery && displayedNotes.length === 0 && !isSearching" class="no-search-results">
            <div class="no-results-icon">🔍</div>
            <p>No notes found for "{{ searchQuery }}"</p>
            <button @click="clearSearch" class="clear-search-link">Show all notes</button>
          </div>

          <!-- Grouped Notes View -->
          <template v-if="groupByChannel && groupedNotes">
            <div v-for="group in groupedNotes" :key="group.name" class="channel-group">
              <div
                class="channel-header"
                @click="toggleChannel(group.name)"
                :class="{ 'collapsed': !isChannelExpanded(group.name) }"
              >
                <span class="channel-expand-icon">{{ isChannelExpanded(group.name) ? '▼' : '▶' }}</span>
                <span v-if="group.platform" class="channel-platform-icon">
                  {{ group.platform === 'youtube' ? '📺' : group.platform === 'twitter' ? '🐦' : group.platform === 'linkedin' ? '💼' : '📝' }}
                </span>
                <span class="channel-name">{{ group.name }}</span>
                <span class="channel-count">{{ group.notes.length }}</span>
              </div>
              <transition name="collapse">
                <div v-show="isChannelExpanded(group.name)" class="channel-notes">
                  <div
                    v-for="note in group.notes"
                    :key="note.id"
                    class="note-item grouped"
                    :class="{ 'active': selectedNote && selectedNote.id === note.id }"
                    @click="selectNote(note)"
                    tabindex="0"
                  >
                    <div class="note-item-header">
                      <h3 class="note-title">{{ note.title }}</h3>
                      <div class="note-badges">
                        <span v-if="note.category" class="category-badge">{{ formatCategoryName(note.category) }}</span>
                      </div>
                    </div>
                    <p class="note-preview">{{ getPreview(note.content) }}</p>
                    <div class="note-meta">
                      <span class="note-date">{{ formatDate(note.created) }}</span>
                      <span v-if="note.score" class="relevance-score">{{ Math.round(note.score * 100) }}% match</span>
                    </div>
                  </div>
                </div>
              </transition>
            </div>
          </template>

          <!-- Flat Notes List -->
          <template v-else>
            <div
              v-for="note in displayedNotes"
              :key="note.id"
              class="note-item"
              :class="{ 'active': selectedNote && selectedNote.id === note.id }"
              @click="selectNote(note)"
              tabindex="0"
            >
              <div class="note-item-header">
                <h3 class="note-title">{{ note.title }}</h3>
                <div class="note-badges">
                  <span v-if="note.category" class="category-badge">{{ formatCategoryName(note.category) }}</span>
                  <span v-if="note.metadata && note.metadata.platform" class="source-badge">{{ getSourceLabel(note.metadata.platform) }}</span>
                </div>
              </div>
              <p class="note-preview">{{ getPreview(note.content) }}</p>
              <div class="note-meta">
                <span class="note-date">{{ formatDate(note.created) }}</span>
                <span v-if="note.score" class="relevance-score">{{ Math.round(note.score * 100) }}% match</span>
              </div>
            </div>
          </template>
        </div>
      </div>
      
      <!-- Right Panel: Note Content -->
      <div class="note-content-panel">
        <div v-if="!selectedNote && !isCreatingNote" class="empty-selection">
          <div class="empty-icon">📝</div>
          <h3>Select a note to view</h3>
          <p>Choose a note from the list to see its full content here, or click "New Note" to create one.</p>
        </div>
        
        <!-- View Mode -->
        <div v-else-if="selectedNote && !isEditMode && !isCreatingNote" class="note-detail">
          <div class="note-detail-header">
            <div class="note-title-section">
              <h1 class="note-detail-title">{{ selectedNote.title }}</h1>
              <div v-if="selectedNote.metadata && (selectedNote.metadata.platform || selectedNote.metadata.url)" class="note-source">
                <span class="source-label">Source:</span>
                <span class="source-platform">
                  {{ selectedNote.metadata.platform === 'youtube' ? 'YouTube' : 
                     selectedNote.metadata.platform === 'twitter' ? 'Twitter' : 
                     selectedNote.metadata.platform === 'linkedin' ? 'LinkedIn' : 
                     (selectedNote.metadata.platform || 'Custom') }}{{ selectedNote.metadata.author ? ' - ' + selectedNote.metadata.author : '' }}
                </span>
                <a v-if="selectedNote.metadata.url" :href="selectedNote.metadata.url" target="_blank" class="source-link">
                  View Original
                </a>
              </div>
              <div class="note-detail-meta">
                <span v-if="selectedNote.category" class="category-badge large">{{ formatCategoryName(selectedNote.category) }}</span>
              </div>
              <div class="note-dates">
                <div class="date-item">
                  <span class="date-label">Date Imported:</span>
                  <span class="date-value">{{ formatDate(selectedNote.created) }}</span>
                </div>
                <div v-if="selectedNote.sourcePublishedAt" class="date-item">
                  <span class="date-label">Source Published:</span>
                  <span class="date-value">{{ formatDate(selectedNote.sourcePublishedAt) }}</span>
                </div>
                <div v-if="selectedNote.lastSummarizedAt" class="date-item">
                  <span class="date-label">Last Summarized:</span>
                  <span class="date-value">{{ formatDate(selectedNote.lastSummarizedAt) }}</span>
                </div>
              </div>
            </div>

            <div class="note-actions">
              <button @click="openAIModal" class="action-btn ai-btn" title="Ask AI about this note">
                <span class="action-icon">🤖</span>
                AI Questions
              </button>
              <button @click="confirmDeleteNote(selectedNote)" class="action-btn delete-btn" title="Delete note">
                <span class="action-icon">🗑️</span>
                Delete
              </button>
            </div>
          </div>
          
          <!-- Tab Navigation - Always show -->
          <div class="note-tabs">
            <button 
              @click="currentView = 'full'" 
              class="tab-btn" 
              :class="{ 'active': currentView === 'full' }"
            >
              Full Note
            </button>
            <button 
              @click="handleSummaryTabClick" 
              class="tab-btn" 
              :class="{ 
                'active': currentView === 'summary',
                'no-summary': !selectedNote.summary && !summarizing,
                'loading': summarizing
              }"
              :disabled="summarizing"
            >
              <span v-if="summarizing" class="tab-spinner"></span>
              <span v-else-if="!selectedNote.summary" class="summary-indicator">+</span>
              Summary
            </button>
          </div>
          
          <!-- Content based on current view -->
          <div class="note-detail-content">
            <div v-if="currentView === 'full'" class="full-content">
              <div class="content-header">
                <button @click="copyToClipboard(selectedNote.content, 'full')" class="copy-btn" :class="{ 'copied': copiedState === 'full' }">
                  <span v-if="copiedState === 'full'">Copied!</span>
                  <span v-else>📋 Copy</span>
                </button>
              </div>
              <div class="content-text">{{ selectedNote.content }}</div>
            </div>
            <div v-else-if="currentView === 'summary'" class="summary-content">
              <div v-if="summarizing" class="summary-loading">
                <div class="summary-spinner"></div>
                <p>Generating summary...</p>
              </div>
              <div v-else-if="selectedNote.summary" class="summary-text">
                <div class="content-header">
                  <button @click="copyToClipboard(selectedNote.summary, 'summary')" class="copy-btn" :class="{ 'copied': copiedState === 'summary' }">
                    <span v-if="copiedState === 'summary'">Copied!</span>
                    <span v-else>📋 Copy</span>
                  </button>
                </div>
                <div class="content-text">{{ selectedNote.summary }}</div>
              </div>
              <div v-else class="no-summary-message">
                <p>No summary available yet. Click the Summary tab to generate one.</p>
              </div>

              <!-- Structured Data Fields -->
              <div v-if="getFilteredStructuredData()" class="structured-fields">
                <div
                  v-for="(value, key) in getFilteredStructuredData()"
                  :key="key"
                  class="structured-field"
                >
                  <h4 class="field-label">{{ formatFieldLabel(key) }}</h4>

                  <!-- String array: render as bullet list -->
                  <ul v-if="isArrayOfStrings(value)" class="field-list">
                    <li v-for="(item, idx) in value" :key="idx">{{ item }}</li>
                  </ul>

                  <!-- Object array: render as structured cards -->
                  <div v-else-if="isArrayOfObjects(value)" class="field-objects">
                    <div v-for="(obj, idx) in value" :key="idx" class="field-object-card">
                      <div v-for="(val, objKey) in obj" :key="objKey" class="field-object-row">
                        <span class="field-object-key">{{ formatFieldLabel(objKey) }}:</span>
                        <span class="field-object-value">{{ val }}</span>
                      </div>
                    </div>
                  </div>

                  <!-- Simple string: render as paragraph -->
                  <p v-else class="field-value">{{ value }}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Edit Mode or New Note Mode -->
        <div v-else class="note-edit">
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
              <button @click="cancelEdit" class="action-btn cancel-btn" title="Cancel (Esc)">
                <span class="action-icon">✕</span>
                Cancel
              </button>
              <button @click="saveNote" class="action-btn save-btn" title="Save note (⌘+Enter)" 
                      :disabled="saving || !editForm.content.trim() || !hasContentChanged">
                <span class="action-icon">💾</span>
                {{ saving ? 'Saving...' : 'Save' }}
              </button>
            </div>
          </div>
          
          <div class="note-edit-content">
            <div class="edit-form-group">
              <textarea 
                id="edit-content-inline"
                v-model="editForm.content" 
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
      </div>
    </div>
    </div>
    
    <!-- Delete Confirmation Modal -->
    <BaseModal
      :show="showDeleteModal"
      title="Delete Note"
      size="small"
      @close="cancelDelete"
    >
      <p>Are you sure you want to delete this note?</p>
      <p class="note-title-preview">"{{ noteToDelete?.title }}"</p>
      <p class="warning">This action cannot be undone.</p>

      <template #footer>
        <button @click="cancelDelete" class="btn btn-secondary">Cancel</button>
        <button @click="deleteNote" class="btn btn-danger" :disabled="deleting">
          {{ deleting ? 'Deleting...' : 'Delete' }}
        </button>
      </template>
    </BaseModal>

    <!-- AI Questions Modal -->
    <BaseModal
      :show="showAIModal"
      title="AI Questions"
      size="large"
      :close-on-overlay-click="!aiLoading"
      @close="closeAIModal"
    >
      <p class="ai-modal-description">Below is the prompt that will be passed along with this content:</p>

      <div class="form-group">
        <textarea
          v-model="aiPrompt"
          class="form-textarea ai-prompt-textarea"
          placeholder="Enter your question or request about this note..."
          :disabled="aiLoading"
          @keydown="handleAIModalKeydown"
        ></textarea>
      </div>

      <!-- AI Response Section -->
      <div v-if="aiResponse || aiLoading" class="ai-response-section">
        <h4>AI Response:</h4>
        <div v-if="aiLoading" class="ai-loading">
          <div class="ai-spinner"></div>
          <span>Getting AI response...</span>
        </div>
        <div v-else class="ai-response">
          {{ aiResponse }}
        </div>
      </div>

      <template #footer>
        <button @click="closeAIModal" class="btn btn-secondary" :disabled="aiLoading">Close</button>
        <button @click="sendToAI" class="btn btn-primary ai-send-btn" :disabled="aiLoading || !aiPrompt.trim()">
          {{ aiLoading ? 'Sending...' : 'Send to AI' }}
        </button>
      </template>
    </BaseModal>
    
  </div>
</template>

<script>
import axios from 'axios'
import { formatCategoryName, formatDate, getPreview } from '../utils/formatters'
import { API_URL } from '../utils/api'
import BaseModal from './shared/BaseModal.vue'

export default {
  name: 'ViewNotes',
  components: {
    BaseModal
  },
  data() {
    return {
      notes: [],
      searchResults: [],
      categories: [],
      selectedNote: null,
      selectedCategory: null,
      filteredNotes: [],
      loading: true,
      categoriesLoading: false,
      error: '',
      searchQuery: '',
      isSearching: false,
      searchTimeout: null,
      showCategories: false,
      // Edit/Delete functionality
      isEditMode: false,
      isCreatingNote: false,
      showDeleteModal: false,
      noteToDelete: null,
      editForm: {
        id: null,
        title: '',
        content: ''
      },
      originalContent: '', // Track original content for change detection
      saving: false,
      deleting: false,
      // AI Questions functionality
      showAIModal: false,
      aiPrompt: 'Please summarize this content.',
      aiResponse: '',
      aiLoading: false,
      // Summarization functionality
      summarizing: false,
      currentView: 'summary', // 'full' or 'summary' - default to summary
      // Grouping functionality
      groupByChannel: true, // Always group by channel
      expandedChannels: {}, // Track which channels are expanded
      // Copy functionality
      copiedState: null // Track which content was just copied ('full' or 'summary')
    }
  },
  computed: {
    groupedNotes() {
      const notes = this.displayedNotes
      if (!this.groupByChannel || notes.length === 0) {
        return null
      }

      const groups = {}
      for (const note of notes) {
        const channel = note.metadata?.author || 'Other Notes'
        if (!groups[channel]) {
          groups[channel] = {
            name: channel,
            platform: note.metadata?.platform || null,
            notes: []
          }
        }
        groups[channel].notes.push(note)
      }

      // Sort groups: channels with most notes first, "Other Notes" last
      return Object.values(groups).sort((a, b) => {
        if (a.name === 'Other Notes') return 1
        if (b.name === 'Other Notes') return -1
        return b.notes.length - a.notes.length
      })
    },
    displayedNotes() {
      if (this.searchQuery && this.searchResults.length > 0) {
        // Return search results with score information
        return this.searchResults.map(result => ({
          ...result.note,
          score: result.score
        }))
      } else if (this.searchQuery) {
        // If searching but no results, return empty array
        return []
      } else if (this.selectedCategory) {
        // Return filtered notes for selected category
        return this.filteredNotes
      } else {
        // Return all notes when not searching or filtering
        return this.notes
      }
    },
    
    currentNoteIndex() {
      if (!this.selectedNote || this.displayedNotes.length === 0) return -1
      return this.displayedNotes.findIndex(note => note.id === this.selectedNote.id)
    },
    
    hasContentChanged() {
      if (this.isCreatingNote) {
        // For new notes, check if there's any content
        return this.editForm.content.trim().length > 0
      } else {
        // For existing notes, check if content differs from original
        return this.editForm.content.trim() !== this.originalContent.trim()
      }
    }
  },
  async mounted() {
    await this.fetchNotes()
    await this.loadCategories()
    
    // Add global keydown listener for arrow navigation
    document.addEventListener('keydown', this.handleGlobalKeydown)
  },
  beforeUnmount() {
    // Clean up global event listener
    document.removeEventListener('keydown', this.handleGlobalKeydown)
  },
  methods: {
    formatCategoryName,
    formatDate,
    getPreview,
    async fetchNotes() {
      this.loading = true
      this.error = ''

      try {
        const response = await axios.get(`${API_URL}/notes`)
        this.notes = response.data.sort((a, b) => new Date(b.created) - new Date(a.created))
        
        // Auto-select the first note if available
        if (this.notes.length > 0 && !this.selectedNote) {
          this.selectedNote = this.notes[0]
        }
      } catch (error) {
        this.error = 'Error loading notes. Please try again.'
        console.error('Error:', error)
      } finally {
        this.loading = false
      }
    },
    async refreshNotes() {
      await this.fetchNotes()
    },
    selectNote(note) {
      this.selectedNote = note
      // Reset to full view when selecting a note
      this.currentView = 'full'
    },
    handleSearch() {
      // Clear existing timeout
      if (this.searchTimeout) {
        clearTimeout(this.searchTimeout)
      }
      
      // Debounce search - wait 300ms after user stops typing
      this.searchTimeout = setTimeout(() => {
        if (this.searchQuery.trim()) {
          this.performSearch()
        } else {
          this.clearSearch()
        }
      }, 300)
    },
    async performSearch() {
      if (!this.searchQuery.trim()) return

      this.isSearching = true

      try {
        const response = await axios.post(`${API_URL}/search`, {
          query: this.searchQuery.trim(),
          limit: 50 // Get more results for search
        })
        
        this.searchResults = response.data || []
        
        // Auto-select first search result if available
        if (this.searchResults.length > 0) {
          this.selectedNote = this.searchResults[0].note
        } else {
          this.selectedNote = null
        }
      } catch (error) {
        console.error('Search error:', error)
        this.searchResults = []
        this.selectedNote = null
      } finally {
        this.isSearching = false
      }
    },
    clearSearch() {
      this.searchQuery = ''
      this.searchResults = []
      this.isSearching = false
      
      // Clear timeout if exists
      if (this.searchTimeout) {
        clearTimeout(this.searchTimeout)
        this.searchTimeout = null
      }
      
      // Reset to first note if available
      if (this.notes.length > 0) {
        this.selectedNote = this.notes[0]
      }
    },
    async loadCategories() {
      this.categoriesLoading = true

      try {
        const response = await axios.get(`${API_URL}/categories`)
        this.categories = response.data || []
        
        // Sort categories: ones with notes first, then alphabetically
        this.categories.sort((a, b) => {
          if (a.count !== b.count) {
            return b.count - a.count // Higher count first
          }
          return a.name.localeCompare(b.name) // Alphabetical for same count
        })
      } catch (error) {
        console.error('Error loading categories:', error)
      } finally {
        this.categoriesLoading = false
      }
    },
    toggleCategories() {
      this.showCategories = !this.showCategories
    },
    async selectCategory(categoryName) {
      // Clear search when selecting a category
      this.clearSearch()

      this.selectedCategory = categoryName

      try {
        const response = await axios.get(`${API_URL}/notes/category/${categoryName}`)
        this.filteredNotes = response.data || []
        
        // Auto-select first filtered note if available
        if (this.filteredNotes.length > 0) {
          this.selectedNote = this.filteredNotes[0]
        } else {
          this.selectedNote = null
        }
      } catch (error) {
        console.error('Error loading category notes:', error)
        this.filteredNotes = []
        this.selectedNote = null
      }
    },
    clearCategoryFilter() {
      this.selectedCategory = null
      this.filteredNotes = []
      
      // Reset to first note if available
      if (this.notes.length > 0) {
        this.selectedNote = this.notes[0]
      }
    },
    // Create new note
    createNewNote() {
      this.isCreatingNote = true
      this.isEditMode = false
      this.selectedNote = null
      this.editForm = {
        id: null,
        title: '',
        content: ''
      }
      this.originalContent = '' // Empty for new notes
      
      // Focus the textarea when creating new note
      this.$nextTick(() => {
        const textarea = document.getElementById('edit-content-inline')
        if (textarea) {
          textarea.focus()
        }
      })
    },
    // Edit functionality
    enterEditMode() {
      if (!this.selectedNote) return
      this.isEditMode = true
      this.isCreatingNote = false
      this.editForm = {
        id: this.selectedNote.id,
        title: this.selectedNote.title,
        content: this.selectedNote.content
      }
      this.originalContent = this.selectedNote.content // Store original content for change detection
      
      // Focus the textarea when entering edit mode
      this.$nextTick(() => {
        const textarea = document.getElementById('edit-content-inline')
        if (textarea) {
          textarea.focus()
          // Move cursor to end of content
          textarea.setSelectionRange(textarea.value.length, textarea.value.length)
        }
      })
    },
    cancelEdit() {
      this.isEditMode = false
      this.isCreatingNote = false
      this.editForm = { id: null, title: '', content: '' }
      this.originalContent = ''
      this.saving = false
      
      // Focus the selected note in the list for arrow key navigation
      this.$nextTick(() => {
        this.focusSelectedNoteInList()
      })
    },
    
    focusSelectedNoteInList() {
      if (!this.selectedNote) return
      
      // Find the note item element and focus it
      const noteElements = document.querySelectorAll('.note-item')
      const selectedIndex = this.displayedNotes.findIndex(note => note.id === this.selectedNote.id)
      
      if (selectedIndex >= 0 && selectedIndex < noteElements.length) {
        const noteElement = noteElements[selectedIndex]
        noteElement.focus()
        noteElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      }
    },
    
    navigateNotes(direction) {
      if (this.displayedNotes.length === 0) return
      
      const currentIndex = this.currentNoteIndex
      let newIndex
      
      if (direction === 'up') {
        newIndex = currentIndex <= 0 ? this.displayedNotes.length - 1 : currentIndex - 1
      } else if (direction === 'down') {
        newIndex = currentIndex >= this.displayedNotes.length - 1 ? 0 : currentIndex + 1
      }
      
      if (newIndex >= 0 && newIndex < this.displayedNotes.length) {
        this.selectedNote = this.displayedNotes[newIndex]
        this.$nextTick(() => {
          this.focusSelectedNoteInList()
        })
      }
    },
    
    handleGlobalKeydown(event) {
      const activeElement = document.activeElement
      const isInputFocused = activeElement && (
        activeElement.tagName === 'INPUT' || 
        activeElement.tagName === 'TEXTAREA' ||
        activeElement.isContentEditable
      )
      
      // Handle Escape key globally - cancel edit mode if active
      if (event.key === 'Escape') {
        if (this.isEditMode || this.isCreatingNote) {
          event.preventDefault()
          if (!this.saving) {
            this.cancelEdit()
          }
        }
        return
      }
      
      // Only handle other keys when not in edit mode and not focused on input elements
      if (this.isEditMode || this.isCreatingNote) return
      if (isInputFocused) return
      
      if (event.key === 'ArrowUp') {
        event.preventDefault()
        this.navigateNotes('up')
      } else if (event.key === 'ArrowDown') {
        event.preventDefault()
        this.navigateNotes('down')
      } else if (event.key === 'Enter') {
        // Enter key on focused note - start editing
        if (this.selectedNote && !this.isEditMode && !this.isCreatingNote) {
          event.preventDefault()
          this.enterEditMode()
        }
      }
    },
    handleKeydown(event) {
      // Cmd+Enter (Mac) or Ctrl+Enter (Windows/Linux) to save
      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
        event.preventDefault()
        if (!this.saving && this.editForm.content.trim() && this.hasContentChanged) {
          this.saveNote()
        }
      }
      // Escape to cancel (same behavior as cancel button)
      else if (event.key === 'Escape') {
        event.preventDefault()
        if (!this.saving) {
          this.cancelEdit()
        }
      }
    },
    async saveNote() {
      if (!this.editForm.content.trim()) return
      
      // Check if there are any changes before saving
      if (!this.hasContentChanged) {
        // No changes, just exit edit mode without API call
        this.isEditMode = false
        this.isCreatingNote = false
        this.editForm = { id: null, title: '', content: '' }
        this.originalContent = ''
        this.$nextTick(() => {
          this.focusSelectedNoteInList()
        })
        return
      }
      
      this.saving = true

      try {
        if (this.isCreatingNote) {
          // Create new note (title will be auto-generated)
          const response = await axios.post(`${API_URL}/notes`, {
            content: this.editForm.content.trim()
          })

          const newNote = response.data

          // Add to notes array
          this.notes.unshift(newNote)

          // Select the new note
          this.selectedNote = newNote
          this.isCreatingNote = false
        } else {
          // Update existing note (content only, title will be auto-generated)
          const response = await axios.put(`${API_URL}/notes/${this.editForm.id}`, {
            content: this.editForm.content.trim()
          })
          
          const updatedNote = response.data
          
          // Update in notes array
          const noteIndex = this.notes.findIndex(n => n.id === updatedNote.id)
          if (noteIndex !== -1) {
            this.notes[noteIndex] = updatedNote
          }
          
          // Update in filtered notes if applicable
          if (this.selectedCategory && this.filteredNotes.length > 0) {
            const filteredIndex = this.filteredNotes.findIndex(n => n.id === updatedNote.id)
            if (filteredIndex !== -1) {
              this.filteredNotes[filteredIndex] = updatedNote
            }
          }
          
          // Update selected note
          this.selectedNote = updatedNote
          this.isEditMode = false
        }
        
        // Reload categories to update counts
        await this.loadCategories()
        
        this.editForm = { id: null, title: '', content: '' }
        this.originalContent = ''
      } catch (error) {
        console.error('Error saving note:', error)
        alert('Failed to save note. Please try again.')
      } finally {
        this.saving = false
      }
    },
    // Delete functionality
    confirmDeleteNote(note) {
      this.noteToDelete = note
      this.showDeleteModal = true
    },
    cancelDelete() {
      this.showDeleteModal = false
      this.noteToDelete = null
      this.deleting = false
    },
    async deleteNote() {
      if (!this.noteToDelete) return

      this.deleting = true

      try {
        await axios.delete(`${API_URL}/notes/${this.noteToDelete.id}`)
        
        // Remove from notes array
        this.notes = this.notes.filter(n => n.id !== this.noteToDelete.id)
        
        // Remove from filtered notes if applicable
        if (this.filteredNotes.length > 0) {
          this.filteredNotes = this.filteredNotes.filter(n => n.id !== this.noteToDelete.id)
        }
        
        // Remove from search results if applicable
        if (this.searchResults.length > 0) {
          this.searchResults = this.searchResults.filter(r => r.note.id !== this.noteToDelete.id)
        }
        
        // Select a new note if the deleted note was selected
        if (this.selectedNote && this.selectedNote.id === this.noteToDelete.id) {
          const remainingNotes = this.displayedNotes
          this.selectedNote = remainingNotes.length > 0 ? remainingNotes[0] : null
        }
        
        // Reload categories to update counts
        await this.loadCategories()
        
        this.cancelDelete()
      } catch (error) {
        console.error('Error deleting note:', error)
        alert('Failed to delete note. Please try again.')
      } finally {
        this.deleting = false
      }
    },
    getSourceInfo(note) {
      if (!note || !note.metadata) return null
      
      try {
        // Parse metadata if it's a string
        const metadata = typeof note.metadata === 'string' ? JSON.parse(note.metadata) : note.metadata
        
        // Extract platform, URL, and author from metadata
        const platform = metadata.platform
        const url = metadata.url
        const author = metadata.author
        
        if (!platform && !url) return null
        
        // Format platform name for display
        const formatPlatform = (platform) => {
          switch(platform) {
            case 'twitter': return 'Twitter'
            case 'linkedin': return 'LinkedIn'
            case 'youtube': return 'YouTube'
            default: return platform ? platform.charAt(0).toUpperCase() + platform.slice(1) : 'Custom'
          }
        }
        
        // Create display text with channel/author name for supported platforms
        let displayText = formatPlatform(platform)
        if (author && (platform === 'youtube' || platform === 'twitter' || platform === 'linkedin')) {
          displayText += ` - ${author}`
        }
        
        return {
          platform: displayText,
          url: url,
          author: author,
          rawPlatform: platform
        }
      } catch (error) {
        console.error('Error parsing note metadata:', error)
        return null
      }
    },
    getSourceLabel(platform) {
      switch(platform) {
        case 'youtube': return 'YouTube'
        case 'twitter': return 'Twitter'
        case 'linkedin': return 'LinkedIn'
        default: return 'Custom'
      }
    },
    // Channel grouping methods
    toggleChannel(channelName) {
      this.expandedChannels = {
        ...this.expandedChannels,
        [channelName]: !this.isChannelExpanded(channelName)
      }
    },
    isChannelExpanded(channelName) {
      // Default to expanded if not explicitly set
      return this.expandedChannels[channelName] !== false
    },
    // AI Questions functionality
    openAIModal() {
      this.showAIModal = true
      this.aiPrompt = 'Please summarize this content.'
      this.aiResponse = ''
      this.aiLoading = false
    },
    closeAIModal() {
      this.showAIModal = false
      this.aiPrompt = 'Please summarize this content.'
      this.aiResponse = ''
      this.aiLoading = false
    },
    async sendToAI() {
      if (!this.selectedNote || !this.aiPrompt.trim()) return

      this.aiLoading = true
      this.aiResponse = ''

      try {
        const response = await axios.post(`${API_URL}/ai-question`, {
          content: this.selectedNote.content,
          prompt: this.aiPrompt.trim()
        })
        
        this.aiResponse = response.data.response || 'No response received from AI.'
      } catch (error) {
        console.error('AI question error:', error)
        this.aiResponse = 'Sorry, there was an error getting a response from AI. Please try again.'
      } finally {
        this.aiLoading = false
      }
    },
    handleAIModalKeydown(event) {
      // Ctrl+Enter or Cmd+Enter to send to AI
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        event.preventDefault()
        if (!this.aiLoading && this.aiPrompt.trim()) {
          this.sendToAI()
        }
      }
      // Escape to close modal
      else if (event.key === 'Escape') {
        event.preventDefault()
        if (!this.aiLoading) {
          this.closeAIModal()
        }
      }
    },
    // Handle Summary tab click
    handleSummaryTabClick() {
      if (this.selectedNote.summary) {
        // Summary already exists, just switch to view
        this.currentView = 'summary'
      } else {
        // No summary exists, generate it
        this.currentView = 'summary'
        this.summarizeNote()
      }
    },
    // Summarization functionality
    async summarizeNote() {
      if (!this.selectedNote || this.summarizing) return

      this.summarizing = true

      try {
        const response = await axios.post(`${API_URL}/summarize`, {
          noteId: this.selectedNote.id,
          content: this.selectedNote.content
        })

        // Update the selected note with the new summary, structured data, and timestamp
        const now = new Date().toISOString()
        this.selectedNote.summary = response.data.summary
        this.selectedNote.structuredData = response.data.structuredData
        this.selectedNote.lastSummarizedAt = now

        // Update the note in the notes array
        const noteIndex = this.notes.findIndex(n => n.id === this.selectedNote.id)
        if (noteIndex !== -1) {
          this.notes[noteIndex].summary = response.data.summary
          this.notes[noteIndex].structuredData = response.data.structuredData
          this.notes[noteIndex].lastSummarizedAt = now
        }

        // Update in filtered notes if applicable
        if (this.selectedCategory && this.filteredNotes.length > 0) {
          const filteredIndex = this.filteredNotes.findIndex(n => n.id === this.selectedNote.id)
          if (filteredIndex !== -1) {
            this.filteredNotes[filteredIndex].summary = response.data.summary
            this.filteredNotes[filteredIndex].structuredData = response.data.structuredData
            this.filteredNotes[filteredIndex].lastSummarizedAt = now
          }
        }

        // Don't need to switch view since we're already on summary tab

      } catch (error) {
        console.error('Summarization error:', error)
        alert('Sorry, there was an error summarizing the note. Please try again.')
      } finally {
        this.summarizing = false
      }
    },
    // Structured data rendering helpers
    formatFieldLabel(key) {
      if (!key) return ''
      return key
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ')
    },
    getFilteredStructuredData() {
      if (!this.selectedNote || !this.selectedNote.structuredData) return null
      const data = { ...this.selectedNote.structuredData }
      delete data.summary // Summary is displayed separately
      return Object.keys(data).length > 0 ? data : null
    },
    isArrayOfStrings(value) {
      return Array.isArray(value) && value.length > 0 && typeof value[0] === 'string'
    },
    isArrayOfObjects(value) {
      return Array.isArray(value) && value.length > 0 && typeof value[0] === 'object' && value[0] !== null
    },
    // Copy to clipboard functionality
    async copyToClipboard(text, type) {
      if (!text) return

      try {
        await navigator.clipboard.writeText(text)
        this.copiedState = type

        // Reset copied state after 2 seconds
        setTimeout(() => {
          this.copiedState = null
        }, 2000)
      } catch (error) {
        console.error('Failed to copy:', error)
        // Fallback for older browsers
        const textarea = document.createElement('textarea')
        textarea.value = text
        document.body.appendChild(textarea)
        textarea.select()
        document.execCommand('copy')
        document.body.removeChild(textarea)

        this.copiedState = type
        setTimeout(() => {
          this.copiedState = null
        }, 2000)
      }
    }
  }
}
</script>

<style scoped>
.view-notes {
  height: calc(100vh - 120px); /* Account for navigation */
  display: flex;
  flex-direction: column;
  background: #f5f5f7;
}

.loading, .error, .no-notes {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  font-size: 18px;
  color: #666;
}

.error {
  color: #e74c3c;
}

.no-notes a {
  color: #007AFF;
  text-decoration: none;
  margin-left: 5px;
}

.no-notes a:hover {
  text-decoration: underline;
}

/* Main interface container */
.notes-interface {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: white;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  margin: 20px;
}

.notes-container {
  display: flex;
  flex: 1;
  overflow: hidden;
}

/* Left Sidebar */
.notes-sidebar {
  width: 350px;
  min-width: 300px;
  background: #fafafa;
  border-right: 1px solid #e5e5e5;
  display: flex;
  flex-direction: column;
}

.sidebar-header {
  padding: 20px;
  border-bottom: 1px solid #e5e5e5;
  background: white;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.sidebar-header h2 {
  margin: 0;
  font-size: 22px;
  color: #1c1c1e;
  font-weight: 600;
}

.header-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.group-btn {
  background: none;
  border: 1px solid #d1d1d6;
  font-size: 16px;
  cursor: pointer;
  padding: 6px 10px;
  border-radius: 6px;
  transition: all 0.2s;
}

.group-btn:hover {
  background-color: #f0f0f0;
  border-color: #007AFF;
}

.group-btn.active {
  background-color: #007AFF;
  border-color: #007AFF;
}

.new-note-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  background: #007AFF;
  color: white;
  border: none;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s;
}

.new-note-btn:hover {
  background-color: #0056b3;
}

.new-note-btn .action-icon {
  font-size: 16px;
  font-weight: bold;
}

.refresh-btn {
  background: none;
  border: none;
  font-size: 18px;
  cursor: pointer;
  padding: 8px;
  border-radius: 6px;
  color: #007AFF;
  transition: background-color 0.2s;
}

.refresh-btn:hover {
  background-color: #f0f0f0;
}

/* Categories Section - spans full width above both panels */
.categories-section {
  border-bottom: 1px solid #e5e5e5;
  background: white;
  flex-shrink: 0; /* Don't shrink when content grows */
}

.categories-header {
  padding: 20px 32px 16px 32px;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
  transition: background-color 0.2s;
  user-select: none;
  border-bottom: 1px solid #f0f0f0;
}

.categories-header:hover {
  background-color: #f8f8f8;
}

.categories-title {
  font-size: 18px;
  font-weight: 600;
  color: #1c1c1e;
}

.expand-arrow {
  font-size: 14px;
  color: #8e8e93;
  transition: transform 0.2s;
}

.expand-arrow.expanded {
  transform: rotate(180deg);
}

.categories-content {
  padding: 20px 32px 24px 32px;
  background: #fafafa;
}

.categories-loading {
  text-align: center;
  padding: 16px;
  color: #8e8e93;
  font-size: 14px;
  font-style: italic;
}

.categories-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  max-width: 100%;
}

.category-pill {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: white;
  border: 1px solid #d1d1d6;
  border-radius: 16px;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 13px;
}

.category-pill:hover {
  border-color: #007AFF;
  background-color: #f0f8ff;
}

.category-pill.active {
  background-color: #007AFF;
  border-color: #007AFF;
  color: white;
}

.category-pill.has-notes {
  border-color: #34c759;
}

.category-pill.has-notes:hover {
  border-color: #007AFF;
}

.category-pill.active .category-count {
  color: rgba(255, 255, 255, 0.8);
}

.category-pill.clear-filter {
  background-color: #ff3b30;
  border-color: #ff3b30;
  color: white;
}

.category-pill.clear-filter:hover {
  background-color: #d70015;
  border-color: #d70015;
}

.category-name {
  font-weight: 500;
}

.category-count {
  background: #e5e5e7;
  color: #1c1c1e;
  padding: 2px 6px;
  border-radius: 8px;
  font-size: 11px;
  font-weight: 600;
  min-width: 16px;
  text-align: center;
}

.category-pill.has-notes .category-count {
  background: #34c759;
  color: white;
}

.category-pill.active .category-count {
  background: rgba(255, 255, 255, 0.2);
  color: white;
}

.clear-icon {
  font-size: 14px;
  font-weight: bold;
}

/* Search Section */
.search-section {
  padding: 16px 20px;
  border-bottom: 1px solid #e5e5e5;
  background: white;
}

.search-input-group {
  position: relative;
  display: flex;
  align-items: center;
}

.search-input {
  width: 100%;
  padding: 10px 12px;
  padding-right: 35px;
  border: 1px solid #d1d1d6;
  border-radius: 8px;
  font-size: 14px;
  background: #f8f8f8;
  transition: all 0.2s;
}

.search-input:focus {
  outline: none;
  border-color: #007AFF;
  background: white;
}

.search-input:disabled {
  background-color: #f5f5f5;
  cursor: not-allowed;
}

.clear-search-btn {
  position: absolute;
  right: 10px;
  background: none;
  border: none;
  font-size: 20px;
  cursor: pointer;
  color: #8e8e93;
  padding: 0;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: background-color 0.2s;
}

.clear-search-btn:hover {
  background-color: #e5e5e5;
  color: #333;
}

/* Active Filter Indicator */
.active-filter {
  margin-top: 8px;
  padding: 6px 12px;
  background: #e3f2fd;
  border: 1px solid #bbdefb;
  border-radius: 6px;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
}

.filter-label {
  color: #1976d2;
  font-weight: 500;
}

.filter-value {
  color: #1976d2;
  font-weight: 600;
}

.filter-clear {
  background: none;
  border: none;
  color: #1976d2;
  cursor: pointer;
  font-size: 14px;
  padding: 0;
  margin-left: auto;
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: background-color 0.2s;
}

.filter-clear:hover {
  background-color: rgba(25, 118, 210, 0.1);
}

/* Search Status */
.search-status {
  padding: 16px 20px;
  text-align: center;
  color: #8e8e93;
  font-size: 14px;
  background: #f8f8f8;
}

.search-info {
  font-style: italic;
}

/* No Search Results */
.no-search-results {
  padding: 40px 20px;
  text-align: center;
  color: #8e8e93;
}

.no-results-icon {
  font-size: 48px;
  margin-bottom: 16px;
  opacity: 0.5;
}

.no-search-results p {
  margin: 0 0 16px 0;
  font-size: 16px;
  color: #1c1c1e;
}

.clear-search-link {
  background: #007AFF;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  transition: background-color 0.2s;
}

.clear-search-link:hover {
  background: #0056b3;
}

/* Relevance Score */
.relevance-score {
  font-size: 11px;
  color: #007AFF;
  font-weight: 500;
  margin-left: 8px;
}

.notes-list {
  flex: 1;
  overflow-y: auto;
  padding: 0;
}

/* Channel grouping styles */
.channel-group {
  margin-bottom: 0;
}

.channel-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 20px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  font-weight: 600;
  font-size: 14px;
  position: sticky;
  top: 0;
  z-index: 10;
  cursor: pointer;
  transition: all 0.2s;
}

.channel-header:hover {
  background: linear-gradient(135deg, #5a6fd6 0%, #6a4190 100%);
}

.channel-header.collapsed {
  opacity: 0.85;
}

.channel-expand-icon {
  font-size: 10px;
  transition: transform 0.2s;
  width: 14px;
}

.channel-platform-icon {
  font-size: 16px;
}

.channel-name {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.channel-count {
  background: rgba(255, 255, 255, 0.2);
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 12px;
  font-weight: 500;
}

.note-item.grouped {
  padding-left: 32px;
  border-left: 3px solid #e5e5e5;
  margin-left: 10px;
}

.note-item.grouped:hover {
  border-left-color: #007AFF;
}

.note-item.grouped.active {
  border-left-color: white;
}

/* Collapse animation */
.channel-notes {
  overflow: hidden;
}

.collapse-enter-active,
.collapse-leave-active {
  transition: all 0.3s ease;
  max-height: 2000px;
}

.collapse-enter-from,
.collapse-leave-to {
  max-height: 0;
  opacity: 0;
}

.note-item {
  padding: 16px 20px;
  border-bottom: 1px solid #f0f0f0;
  cursor: pointer;
  transition: background-color 0.2s;
  position: relative;
  outline: none;
}

.note-item:hover {
  background-color: #f8f8f8;
}

.note-item:focus {
  background-color: #f0f8ff;
  box-shadow: inset 3px 0 0 #007AFF;
}

.note-item.active {
  background-color: #007AFF;
  color: white;
}

.note-item.active:focus {
  box-shadow: inset 3px 0 0 rgba(255, 255, 255, 0.5);
}

.note-item.active .note-title {
  color: white;
}

.note-item.active .note-preview {
  color: rgba(255, 255, 255, 0.8);
}

.note-item.active .note-date {
  color: rgba(255, 255, 255, 0.7);
}

.note-item.active .category-badge {
  background: rgba(255, 255, 255, 0.2);
  color: white;
}

.note-item-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 8px;
}

.note-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #1c1c1e;
  line-height: 1.3;
  flex: 1;
  margin-right: 8px;
}

.note-preview {
  margin: 0 0 8px 0;
  font-size: 14px;
  color: #8e8e93;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.note-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.note-date {
  font-size: 12px;
  color: #8e8e93;
}

.category-badge {
  background: #e9ecef;
  color: #495057;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
  flex-shrink: 0;
}

.category-badge.large {
  padding: 4px 8px;
  font-size: 12px;
}

.note-badges {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.source-badge {
  background: #007AFF;
  color: white;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
  flex-shrink: 0;
}

.note-item.active .source-badge {
  background: rgba(255, 255, 255, 0.2);
  color: white;
}

/* Right Panel */
.note-content-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: white;
}

.empty-selection {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #8e8e93;
  padding: 40px;
}

.empty-icon {
  font-size: 64px;
  margin-bottom: 16px;
  opacity: 0.5;
}

.empty-selection h3 {
  margin: 0 0 8px 0;
  font-size: 24px;
  color: #1c1c1e;
  font-weight: 600;
}

.empty-selection p {
  margin: 0;
  font-size: 16px;
  text-align: center;
  max-width: 300px;
}

.note-detail {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.note-detail-header {
  padding: 32px 40px 20px 40px;
  border-bottom: 1px solid #f0f0f0;
  background: white;
  flex-shrink: 0;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.note-title-section {
  flex: 1;
  margin-right: 20px;
}

.note-detail-title {
  margin: 0 0 16px 0;
  font-size: 28px;
  font-weight: 700;
  color: #1c1c1e;
  line-height: 1.2;
}

.note-source {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  padding: 8px 12px;
  background: #f8f9fa;
  border-radius: 6px;
  border-left: 3px solid #007AFF;
}

.source-label {
  font-size: 12px;
  font-weight: 600;
  color: #6c757d;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.source-platform {
  font-size: 13px;
  font-weight: 500;
  color: #1c1c1e;
  padding: 2px 8px;
  background: #e9ecef;
  border-radius: 4px;
}

.source-link {
  font-size: 12px;
  color: #007AFF;
  text-decoration: none;
  font-weight: 500;
  margin-left: auto;
  padding: 2px 8px;
  border-radius: 4px;
  transition: background-color 0.2s;
}

.source-link:hover {
  background-color: #f0f8ff;
  text-decoration: underline;
}

.note-detail-meta {
  display: flex;
  align-items: center;
  gap: 12px;
}

.note-dates {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  margin-top: 8px;
  padding: 8px 0;
  border-top: 1px solid #e5e5ea;
}

.date-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
}

.date-label {
  color: #8e8e93;
  font-weight: 500;
}

.date-value {
  color: #1c1c1e;
}

/* Action Buttons */
.note-actions {
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

.action-btn.edit-btn:hover {
  border-color: #007AFF;
  background-color: #f0f8ff;
}

.action-btn.ai-btn {
  background-color: #007AFF;
  color: white;
  border-color: #007AFF;
}

.action-btn.ai-btn:hover {
  background-color: #0056b3;
  border-color: #0056b3;
}

.action-btn.delete-btn:hover {
  border-color: #ff3b30;
  background-color: #fff0f0;
  color: #ff3b30;
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

/* Inline Edit Mode */
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

.note-detail-date {
  font-size: 14px;
  color: #8e8e93;
}

.note-detail-content {
  flex: 1;
  padding: 32px 40px;
  overflow-y: auto;
  font-size: 16px;
  line-height: 1.6;
  color: #1c1c1e;
  white-space: pre-wrap;
  word-wrap: break-word;
}

/* Scrollbar styling */
.notes-list::-webkit-scrollbar,
.note-detail-content::-webkit-scrollbar {
  width: 6px;
}

.notes-list::-webkit-scrollbar-track,
.note-detail-content::-webkit-scrollbar-track {
  background: transparent;
}

.notes-list::-webkit-scrollbar-thumb,
.note-detail-content::-webkit-scrollbar-thumb {
  background: #d1d1d6;
  border-radius: 3px;
}

.notes-list::-webkit-scrollbar-thumb:hover,
.note-detail-content::-webkit-scrollbar-thumb:hover {
  background: #aeaeb2;
}

/* Modal Styles - Base styles moved to BaseModal.vue */

/* Delete Modal Specific */
.note-title-preview {
  font-weight: 600;
  color: #1c1c1e;
  margin: 8px 0;
}

.warning {
  color: #ff3b30;
  font-size: 14px;
  margin: 12px 0 0 0;
}

/* Edit Modal Specific */
.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  margin-bottom: 6px;
  font-weight: 600;
  color: #1c1c1e;
  font-size: 14px;
}

.form-input,
.form-textarea {
  width: 100%;
  padding: 12px;
  border: 1px solid #d1d1d6;
  border-radius: 8px;
  font-size: 14px;
  font-family: inherit;
  transition: border-color 0.2s;
  box-sizing: border-box;
}

.form-input:focus,
.form-textarea:focus {
  outline: none;
  border-color: #007AFF;
}

.form-textarea {
  resize: vertical;
  min-height: 200px;
  font-family: inherit;
  line-height: 1.5;
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

.btn-danger {
  background-color: #ff3b30;
  color: white;
}

.btn-danger:hover:not(:disabled) {
  background-color: #d70015;
}

/* Responsive design */
@media (max-width: 768px) {
  .notes-container {
    margin: 10px;
  }
  
  .notes-sidebar {
    width: 280px;
    min-width: 250px;
  }
  
  .note-detail-header {
    padding: 24px 20px 16px 20px;
    flex-direction: column;
    align-items: stretch;
  }
  
  .note-title-section {
    margin-right: 0;
    margin-bottom: 16px;
  }
  
  .note-detail-title {
    font-size: 24px;
  }
  
  .note-detail-content {
    padding: 20px;
    font-size: 15px;
  }
}

/* AI Modal Specific Styles */
.ai-modal-description {
  color: #6c757d;
  font-size: 14px;
  margin-bottom: 16px;
  font-style: italic;
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

.ai-send-btn {
  background-color: #007AFF !important;
  border-color: #007AFF !important;
}

.ai-send-btn:hover:not(:disabled) {
  background-color: #0056b3 !important;
  border-color: #0056b3 !important;
}

/* Tab Navigation Styles */
.note-tabs {
  display: flex;
  border-bottom: 1px solid #e5e5e5;
  background: #f8f9fa;
  padding: 0 40px;
}

.tab-btn {
  background: none;
  border: none;
  padding: 12px 20px;
  font-size: 14px;
  font-weight: 500;
  color: #6c757d;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: all 0.2s;
}

.tab-btn:hover {
  color: #007AFF;
  background-color: rgba(0, 122, 255, 0.05);
}

.tab-btn.active {
  color: #007AFF;
  border-bottom-color: #007AFF;
  background-color: rgba(0, 122, 255, 0.08);
}

.tab-btn.no-summary {
  color: #6c757d;
  position: relative;
}

.tab-btn.no-summary:hover {
  color: #28a745;
  background-color: rgba(40, 167, 69, 0.05);
}

.tab-btn.loading {
  color: #007AFF;
  cursor: not-allowed;
}

.tab-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.summary-indicator {
  display: inline-block;
  margin-right: 4px;
  font-weight: bold;
  color: #28a745;
}

.tab-spinner {
  display: inline-block;
  width: 12px;
  height: 12px;
  border: 2px solid #e9ecef;
  border-top: 2px solid #007AFF;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-right: 6px;
}

/* Content Styles */
.content-header {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 12px;
}

.copy-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  background: #f8f9fa;
  border: 1px solid #d1d1d6;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  color: #495057;
  cursor: pointer;
  transition: all 0.2s;
}

.copy-btn:hover {
  background: #e9ecef;
  border-color: #007AFF;
  color: #007AFF;
}

.copy-btn.copied {
  background: #d4edda;
  border-color: #28a745;
  color: #28a745;
}

.content-text {
  white-space: pre-wrap;
  word-wrap: break-word;
}

.full-content,
.summary-text {
  white-space: pre-wrap;
  word-wrap: break-word;
}

.summary-content {
  padding: 20px 0;
}

.summary-text {
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 8px;
  padding: 20px;
  margin: 20px 0;
  font-style: italic;
  color: #495057;
  line-height: 1.6;
}

.summary-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: #6c757d;
}

.summary-loading p {
  margin: 16px 0 0 0;
  font-size: 16px;
  font-style: italic;
}

.summary-spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #e9ecef;
  border-top: 4px solid #007AFF;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.no-summary-message {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: #6c757d;
  text-align: center;
}

.no-summary-message p {
  margin: 0;
  font-size: 16px;
  font-style: italic;
}

/* Structured Data Styles */
.structured-fields {
  margin-top: 24px;
  padding-top: 24px;
  border-top: 1px solid #e9ecef;
}

.structured-field {
  margin-bottom: 20px;
}

.structured-field:last-child {
  margin-bottom: 0;
}

.field-label {
  margin: 0 0 8px 0;
  font-size: 14px;
  font-weight: 600;
  color: #1c1c1e;
  text-transform: capitalize;
}

.field-value {
  margin: 0;
  font-size: 14px;
  line-height: 1.6;
  color: #495057;
}

.field-list {
  margin: 0;
  padding-left: 20px;
  list-style-type: disc;
}

.field-list li {
  font-size: 14px;
  line-height: 1.6;
  color: #495057;
  margin-bottom: 4px;
}

.field-list li:last-child {
  margin-bottom: 0;
}

.field-objects {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.field-object-card {
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 6px;
  padding: 12px;
}

.field-object-row {
  display: flex;
  gap: 8px;
  margin-bottom: 4px;
  font-size: 13px;
}

.field-object-row:last-child {
  margin-bottom: 0;
}

.field-object-key {
  font-weight: 500;
  color: #6c757d;
  flex-shrink: 0;
}

.field-object-value {
  color: #1c1c1e;
  word-break: break-word;
}
</style>
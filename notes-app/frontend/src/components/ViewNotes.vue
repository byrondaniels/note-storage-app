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

    <!-- Main interface with sub-components -->
    <div v-else class="notes-interface">
      <!-- Categories Section -->
      <CategoryFilter
        :categories="categories"
        :selected-category="selectedCategory"
        :loading="categoriesLoading"
        @select-category="selectCategory"
        @clear-category="clearCategoryFilter"
      />

      <!-- Two-panel layout below categories -->
      <div class="notes-container">
        <!-- Left Sidebar: Note List -->
        <NotesList
          :displayed-notes="displayedNotes"
          :selected-note="selectedNote"
          :selected-category="selectedCategory"
          :search-query.sync="searchQuery"
          :is-searching="isSearching"
          :loading="loading"
          :group-by-channel="groupByChannel"
          @create-note="createNewNote"
          @refresh="refreshNotes"
          @select-note="selectNote"
          @search="performSearch"
          @clear-search="clearSearch"
          @clear-category="clearCategoryFilter"
          @update:searchQuery="handleSearchInput"
        />

        <!-- Right Panel: Note Content -->
        <div class="note-content-panel">
          <div v-if="!selectedNote && !isCreatingNote" class="empty-selection">
            <div class="empty-icon">📝</div>
            <h3>Select a note to view</h3>
            <p>Choose a note from the list to see its full content here, or click "New Note" to create one.</p>
          </div>

          <!-- View Mode -->
          <NoteDetail
            v-else-if="selectedNote && !isEditMode && !isCreatingNote"
            :note="selectedNote"
            :current-view.sync="currentView"
            :summarizing="summarizing"
            :copied-state.sync="copiedState"
            @open-ai-modal="openAIModal"
            @delete="confirmDeleteNote(selectedNote)"
            @summarize="summarizeNote"
            @update:currentView="currentView = $event"
            @update:copiedState="copiedState = $event"
          />

          <!-- Edit Mode or New Note Mode -->
          <NoteEditor
            v-else
            :content.sync="editForm.content"
            :original-content="originalContent"
            :is-creating-note="isCreatingNote"
            :saving="saving"
            @save="saveNote"
            @cancel="cancelEdit"
            @update:content="editForm.content = $event"
          />
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
    <AIQuestionModal
      :show="showAIModal"
      :prompt="aiPrompt"
      :response="aiResponse"
      :loading="aiLoading"
      @close="closeAIModal"
      @send="sendToAI"
    />
  </div>
</template>

<script>
import axios from 'axios'
import { API_URL } from '../utils/api'
import BaseModal from './shared/BaseModal.vue'
import CategoryFilter from './CategoryFilter.vue'
import NotesList from './NotesList.vue'
import NoteDetail from './NoteDetail.vue'
import NoteEditor from './NoteEditor.vue'
import AIQuestionModal from './AIQuestionModal.vue'
import { useApi } from '../composables/useApi'

export default {
  name: 'ViewNotes',
  components: {
    BaseModal,
    CategoryFilter,
    NotesList,
    NoteDetail,
    NoteEditor,
    AIQuestionModal
  },
  setup() {
    const api = useApi()
    return { api }
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
      originalContent: '',
      saving: false,
      deleting: false,
      // AI Questions functionality
      showAIModal: false,
      aiPrompt: 'Please summarize this content.',
      aiResponse: '',
      aiLoading: false,
      // Summarization functionality
      summarizing: false,
      currentView: 'summary',
      // Grouping functionality
      groupByChannel: true,
      // Copy functionality
      copiedState: null
    }
  },
  computed: {
    displayedNotes() {
      if (this.searchQuery && this.searchResults.length > 0) {
        return this.searchResults.map(result => ({
          ...result.note,
          score: result.score
        }))
      } else if (this.searchQuery) {
        return []
      } else if (this.selectedCategory) {
        return this.filteredNotes
      } else {
        return this.notes
      }
    },
    currentNoteIndex() {
      if (!this.selectedNote || this.displayedNotes.length === 0) return -1
      return this.displayedNotes.findIndex(note => note.id === this.selectedNote.id)
    },
    hasContentChanged() {
      if (this.isCreatingNote) {
        return this.editForm.content.trim().length > 0
      } else {
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
    document.removeEventListener('keydown', this.handleGlobalKeydown)
  },
  methods: {
    async fetchNotes() {
      await this.api.request(async () => {
        const response = await axios.get(`${API_URL}/notes`)
        this.notes = response.data.sort((a, b) => new Date(b.created) - new Date(a.created))

        if (this.notes.length > 0 && !this.selectedNote) {
          this.selectedNote = this.notes[0]
        }
      })
    },
    async refreshNotes() {
      await this.fetchNotes()
    },
    selectNote(note) {
      this.selectedNote = note
      this.currentView = 'full'
    },
    handleSearchInput(value) {
      this.searchQuery = value
      if (this.searchTimeout) {
        clearTimeout(this.searchTimeout)
      }

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
        await this.api.request(async () => {
          const response = await axios.post(`${API_URL}/search`, {
            query: this.searchQuery.trim(),
            limit: 50
          })

          this.searchResults = response.data || []

          if (this.searchResults.length > 0) {
            this.selectedNote = this.searchResults[0].note
          } else {
            this.selectedNote = null
          }
        })
      } catch (error) {
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

      if (this.searchTimeout) {
        clearTimeout(this.searchTimeout)
        this.searchTimeout = null
      }

      if (this.notes.length > 0) {
        this.selectedNote = this.notes[0]
      }
    },
    async loadCategories() {
      this.categoriesLoading = true
      try {
        await this.api.request(async () => {
          const response = await axios.get(`${API_URL}/categories`)
          this.categories = response.data || []

          this.categories.sort((a, b) => {
            if (a.count !== b.count) {
              return b.count - a.count
            }
            return a.name.localeCompare(b.name)
          })
        })
      } finally {
        this.categoriesLoading = false
      }
    },
    async selectCategory(categoryName) {
      this.clearSearch()
      this.selectedCategory = categoryName

      try {
        await this.api.request(async () => {
          const response = await axios.get(`${API_URL}/notes/category/${categoryName}`)
          this.filteredNotes = response.data || []

          if (this.filteredNotes.length > 0) {
            this.selectedNote = this.filteredNotes[0]
          } else {
            this.selectedNote = null
          }
        })
      } catch (error) {
        this.filteredNotes = []
        this.selectedNote = null
      }
    },
    clearCategoryFilter() {
      this.selectedCategory = null
      this.filteredNotes = []

      if (this.notes.length > 0) {
        this.selectedNote = this.notes[0]
      }
    },
    createNewNote() {
      this.isCreatingNote = true
      this.isEditMode = false
      this.selectedNote = null
      this.editForm = {
        id: null,
        title: '',
        content: ''
      }
      this.originalContent = ''
    },
    enterEditMode() {
      if (!this.selectedNote) return
      this.isEditMode = true
      this.isCreatingNote = false
      this.editForm = {
        id: this.selectedNote.id,
        title: this.selectedNote.title,
        content: this.selectedNote.content
      }
      this.originalContent = this.selectedNote.content
    },
    cancelEdit() {
      this.isEditMode = false
      this.isCreatingNote = false
      this.editForm = { id: null, title: '', content: '' }
      this.originalContent = ''
      this.saving = false

      this.$nextTick(() => {
        this.focusSelectedNoteInList()
      })
    },
    focusSelectedNoteInList() {
      if (!this.selectedNote) return

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

      if (event.key === 'Escape') {
        if (this.isEditMode || this.isCreatingNote) {
          event.preventDefault()
          if (!this.saving) {
            this.cancelEdit()
          }
        }
        return
      }

      if (this.isEditMode || this.isCreatingNote) return
      if (isInputFocused) return

      if (event.key === 'ArrowUp') {
        event.preventDefault()
        this.navigateNotes('up')
      } else if (event.key === 'ArrowDown') {
        event.preventDefault()
        this.navigateNotes('down')
      } else if (event.key === 'Enter') {
        if (this.selectedNote && !this.isEditMode && !this.isCreatingNote) {
          event.preventDefault()
          this.enterEditMode()
        }
      }
    },
    async saveNote() {
      if (!this.editForm.content.trim()) return

      if (!this.hasContentChanged) {
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
        await this.api.request(async () => {
          if (this.isCreatingNote) {
            const response = await axios.post(`${API_URL}/notes`, {
              content: this.editForm.content.trim()
            })

            const newNote = response.data
            this.notes.unshift(newNote)
            this.selectedNote = newNote
            this.isCreatingNote = false
          } else {
            const response = await axios.put(`${API_URL}/notes/${this.editForm.id}`, {
              content: this.editForm.content.trim()
            })

            const updatedNote = response.data

            const noteIndex = this.notes.findIndex(n => n.id === updatedNote.id)
            if (noteIndex !== -1) {
              this.notes[noteIndex] = updatedNote
            }

            if (this.selectedCategory && this.filteredNotes.length > 0) {
              const filteredIndex = this.filteredNotes.findIndex(n => n.id === updatedNote.id)
              if (filteredIndex !== -1) {
                this.filteredNotes[filteredIndex] = updatedNote
              }
            }

            this.selectedNote = updatedNote
            this.isEditMode = false
          }

          await this.loadCategories()
          this.editForm = { id: null, title: '', content: '' }
          this.originalContent = ''
        })
      } catch (error) {
        alert('Failed to save note. Please try again.')
      } finally {
        this.saving = false
      }
    },
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
        await this.api.request(async () => {
          await axios.delete(`${API_URL}/notes/${this.noteToDelete.id}`)

          this.notes = this.notes.filter(n => n.id !== this.noteToDelete.id)

          if (this.filteredNotes.length > 0) {
            this.filteredNotes = this.filteredNotes.filter(n => n.id !== this.noteToDelete.id)
          }

          if (this.searchResults.length > 0) {
            this.searchResults = this.searchResults.filter(r => r.note.id !== this.noteToDelete.id)
          }

          if (this.selectedNote && this.selectedNote.id === this.noteToDelete.id) {
            const remainingNotes = this.displayedNotes
            this.selectedNote = remainingNotes.length > 0 ? remainingNotes[0] : null
          }

          await this.loadCategories()
          this.cancelDelete()
        })
      } catch (error) {
        alert('Failed to delete note. Please try again.')
      } finally {
        this.deleting = false
      }
    },
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
    async sendToAI(prompt) {
      if (!this.selectedNote || !prompt.trim()) return

      this.aiLoading = true
      this.aiResponse = ''

      try {
        await this.api.request(async () => {
          const response = await axios.post(`${API_URL}/ai-question`, {
            content: this.selectedNote.content,
            prompt: prompt.trim()
          })

          this.aiResponse = response.data.response || 'No response received from AI.'
        })
      } catch (error) {
        this.aiResponse = 'Sorry, there was an error getting a response from AI. Please try again.'
      } finally {
        this.aiLoading = false
      }
    },
    async summarizeNote() {
      if (!this.selectedNote || this.summarizing) return

      this.summarizing = true

      try {
        await this.api.request(async () => {
          const response = await axios.post(`${API_URL}/summarize`, {
            noteId: this.selectedNote.id,
            content: this.selectedNote.content
          })

          const now = new Date().toISOString()
          this.selectedNote.summary = response.data.summary
          this.selectedNote.structuredData = response.data.structuredData
          this.selectedNote.lastSummarizedAt = now

          const noteIndex = this.notes.findIndex(n => n.id === this.selectedNote.id)
          if (noteIndex !== -1) {
            this.notes[noteIndex].summary = response.data.summary
            this.notes[noteIndex].structuredData = response.data.structuredData
            this.notes[noteIndex].lastSummarizedAt = now
          }

          if (this.selectedCategory && this.filteredNotes.length > 0) {
            const filteredIndex = this.filteredNotes.findIndex(n => n.id === this.selectedNote.id)
            if (filteredIndex !== -1) {
              this.filteredNotes[filteredIndex].summary = response.data.summary
              this.filteredNotes[filteredIndex].structuredData = response.data.structuredData
              this.filteredNotes[filteredIndex].lastSummarizedAt = now
            }
          }
        })
      } catch (error) {
        alert('Sorry, there was an error summarizing the note. Please try again.')
      } finally {
        this.summarizing = false
      }
    }
  }
}
</script>

<style scoped>
.view-notes {
  height: calc(100vh - 120px);
  display: flex;
  flex-direction: column;
  background: var(--color-bg-tertiary);
}

.loading, .error, .no-notes {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  font-size: var(--font-size-lg);
  color: var(--color-text-muted);
}

.error {
  color: #e74c3c;
}

.no-notes a {
  color: var(--color-primary);
  text-decoration: none;
  margin-left: 5px;
}

.no-notes a:hover {
  text-decoration: underline;
}

.notes-interface {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--color-bg-primary);
  border-radius: var(--radius-xl);
  overflow: hidden;
  box-shadow: var(--shadow-lg);
  margin: var(--spacing-xl);
}

.notes-container {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.note-content-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: var(--color-bg-primary);
}

.empty-selection {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--color-text-light);
  padding: 40px;
}

.empty-icon {
  font-size: 64px;
  margin-bottom: var(--spacing-lg);
  opacity: 0.5;
}

.empty-selection h3 {
  margin: 0 0 var(--spacing-sm) 0;
  font-size: var(--font-size-xxl);
  color: var(--color-text-primary);
  font-weight: var(--font-weight-semibold);
}

.empty-selection p {
  margin: 0;
  font-size: var(--font-size-md);
  text-align: center;
  max-width: 300px;
}

/* Modal Specific */
.note-title-preview {
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  margin: var(--spacing-sm) 0;
}

.warning {
  color: var(--color-danger);
  font-size: var(--font-size-sm);
  margin: var(--spacing-md) 0 0 0;
}

/* Responsive design */
@media (max-width: 768px) {
  .notes-container {
    margin: 10px;
  }
}
</style>

<template>
  <div class="notes-sidebar">
    <div class="sidebar-header">
      <h2>Your Notes</h2>
      <div class="header-actions">
        <button @click="$emit('create-note')" class="new-note-btn" title="Create new note">
          <span class="action-icon">+</span>
          New Note
        </button>
        <button @click="$emit('refresh')" class="refresh-btn" :disabled="loading">
          {{ loading ? '⟳' : '⟳' }}
        </button>
      </div>
    </div>

    <!-- Search Bar -->
    <div class="search-section">
      <div class="search-input-group">
        <input
          type="text"
          :value="searchQuery"
          @input="$emit('update:searchQuery', $event.target.value)"
          @keyup.enter="$emit('search')"
          placeholder="Search your notes..."
          class="search-input"
          :disabled="loading"
        />
        <button
          v-if="searchQuery"
          @click="$emit('clear-search')"
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
        <button @click="$emit('clear-category')" class="filter-clear">×</button>
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
        <button @click="$emit('clear-search')" class="clear-search-link">Show all notes</button>
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
                @click="$emit('select-note', note)"
                tabindex="0"
              >
                <div class="note-item-header">
                  <h3 class="note-title">{{ note.title }}</h3>
                  <div class="note-badges">
                    <CategoryBadge :category="note.category" />
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
          @click="$emit('select-note', note)"
          tabindex="0"
        >
          <div class="note-item-header">
            <h3 class="note-title">{{ note.title }}</h3>
            <div class="note-badges">
              <CategoryBadge :category="note.category" />
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
</template>

<script>
import { formatCategoryName, formatDate, getPreview } from '../utils/formatters'
import CategoryBadge from './shared/CategoryBadge.vue'

export default {
  name: 'NotesList',
  components: {
    CategoryBadge
  },
  props: {
    displayedNotes: {
      type: Array,
      default: () => []
    },
    selectedNote: {
      type: Object,
      default: null
    },
    selectedCategory: {
      type: String,
      default: null
    },
    searchQuery: {
      type: String,
      default: ''
    },
    isSearching: {
      type: Boolean,
      default: false
    },
    loading: {
      type: Boolean,
      default: false
    },
    groupByChannel: {
      type: Boolean,
      default: true
    }
  },
  data() {
    return {
      expandedChannels: {}
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
    }
  },
  methods: {
    formatCategoryName,
    formatDate,
    getPreview,
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
    getSourceLabel(platform) {
      switch(platform) {
        case 'youtube': return 'YouTube'
        case 'twitter': return 'Twitter'
        case 'linkedin': return 'LinkedIn'
        default: return 'Custom'
      }
    }
  }
}
</script>

<style scoped>
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
  background: rgba(255, 255, 255, 0.2) !important;
  color: white !important;
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

/* Scrollbar styling */
.notes-list::-webkit-scrollbar {
  width: 6px;
}

.notes-list::-webkit-scrollbar-track {
  background: transparent;
}

.notes-list::-webkit-scrollbar-thumb {
  background: #d1d1d6;
  border-radius: 3px;
}

.notes-list::-webkit-scrollbar-thumb:hover {
  background: #aeaeb2;
}

/* Responsive design */
@media (max-width: 768px) {
  .notes-sidebar {
    width: 280px;
    min-width: 250px;
  }
}
</style>

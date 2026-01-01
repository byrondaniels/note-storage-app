<template>
  <div class="categories-section">
    <div class="categories-header" @click="toggleCategories">
      <span class="categories-title">Browse Categories</span>
      <span class="expand-arrow" :class="{ 'expanded': showCategories }">▼</span>
    </div>

    <div v-if="showCategories" class="categories-content">
      <div v-if="loading" class="categories-loading">
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
</template>

<script>
import { formatCategoryName } from '../utils/formatters'

export default {
  name: 'CategoryFilter',
  props: {
    categories: {
      type: Array,
      default: () => []
    },
    selectedCategory: {
      type: String,
      default: null
    },
    loading: {
      type: Boolean,
      default: false
    }
  },
  data() {
    return {
      showCategories: false
    }
  },
  methods: {
    formatCategoryName,
    toggleCategories() {
      this.showCategories = !this.showCategories
    },
    selectCategory(categoryName) {
      this.$emit('select-category', categoryName)
    },
    clearCategoryFilter() {
      this.$emit('clear-category')
    }
  }
}
</script>

<style scoped>
.categories-section {
  border-bottom: 1px solid #e5e5e5;
  background: white;
  flex-shrink: 0;
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
</style>

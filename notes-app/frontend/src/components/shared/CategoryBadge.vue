<template>
  <span
    v-if="category"
    class="category-badge"
    :class="{ 'large': size === 'large', 'active': isActive }"
  >
    {{ formattedCategory }}
  </span>
</template>

<script>
import { formatCategoryName } from '../../utils/formatters'

export default {
  name: 'CategoryBadge',
  props: {
    category: {
      type: String,
      required: true
    },
    size: {
      type: String,
      default: 'normal',
      validator: (value) => ['normal', 'large'].includes(value)
    },
    isActive: {
      type: Boolean,
      default: false
    }
  },
  computed: {
    formattedCategory() {
      return formatCategoryName(this.category)
    }
  }
}
</script>

<style scoped>
.category-badge {
  background: #e9ecef;
  color: #495057;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
  text-transform: capitalize;
  white-space: nowrap;
  flex-shrink: 0;
}

.category-badge.large {
  padding: 4px 8px;
  font-size: 12px;
}

.category-badge.active {
  background: rgba(255, 255, 255, 0.2);
  color: white;
}
</style>

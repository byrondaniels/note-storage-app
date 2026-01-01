<template>
  <div v-if="show" class="modal-overlay" @click="handleOverlayClick">
    <div :class="['modal-content', sizeClass]" @click.stop>
      <div class="modal-header">
        <slot name="header">
          <h3>{{ title }}</h3>
        </slot>
        <button @click="close" class="close-btn">&times;</button>
      </div>
      <div class="modal-body">
        <slot></slot>
      </div>
      <div v-if="hasFooterSlot" class="modal-footer">
        <slot name="footer"></slot>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'BaseModal',
  props: {
    show: {
      type: Boolean,
      required: true
    },
    title: {
      type: String,
      default: ''
    },
    size: {
      type: String,
      default: 'medium',
      validator: (value) => ['small', 'medium', 'large', 'xlarge'].includes(value)
    },
    closeOnOverlayClick: {
      type: Boolean,
      default: true
    }
  },
  computed: {
    sizeClass() {
      return `modal-${this.size}`
    },
    hasFooterSlot() {
      return !!this.$slots.footer
    }
  },
  methods: {
    close() {
      this.$emit('close')
    },
    handleOverlayClick() {
      if (this.closeOnOverlayClick) {
        this.close()
      }
    }
  }
}
</script>

<style scoped>
/* Modal styles use global modal.css classes */
/* Only component-specific overrides here */

/* Close Button - component specific */
.close-btn {
  background: none;
  border: none;
  font-size: var(--font-size-xxl, 24px);
  cursor: pointer;
  color: var(--color-text-light, #8e8e93);
  padding: 0;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: background-color var(--transition-fast, 0.2s);
}

.close-btn:hover {
  background-color: #f0f0f0;
  color: var(--color-text-primary, #1c1c1e);
}
</style>

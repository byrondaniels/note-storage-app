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
/* Modal Overlay */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

/* Modal Content Base */
.modal-content {
  background: white;
  border-radius: 12px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  max-width: 90vw;
  max-height: 90vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* Size Variants */
.modal-small {
  width: 400px;
}

.modal-medium {
  width: 600px;
}

.modal-large {
  width: 700px;
  max-height: 85vh;
}

.modal-xlarge {
  width: 80vw;
  max-height: 80vh;
}

/* Modal Header */
.modal-header {
  padding: 24px 24px 16px 24px;
  border-bottom: 1px solid #f0f0f0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: white;
}

.modal-header h3 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: #1c1c1e;
}

/* Close Button */
.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #8e8e93;
  padding: 0;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: background-color 0.2s;
}

.close-btn:hover {
  background-color: #f0f0f0;
  color: #1c1c1e;
}

/* Modal Body */
.modal-body {
  padding: 20px 24px;
  flex: 1;
  overflow-y: auto;
}

/* Modal Footer */
.modal-footer {
  padding: 16px 24px 24px 24px;
  border-top: 1px solid #f0f0f0;
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  background: white;
}

/* Responsive Design */
@media (max-width: 768px) {
  .modal-content {
    margin: 20px;
    max-width: calc(100vw - 40px);
  }

  .modal-small,
  .modal-medium,
  .modal-large,
  .modal-xlarge {
    width: auto;
  }
}
</style>

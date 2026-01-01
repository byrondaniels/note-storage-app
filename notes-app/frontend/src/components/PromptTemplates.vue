<template>
  <div class="templates-section">
    <h2>Prompt Templates</h2>
    <p class="section-desc">Manage saved prompts. These persist even when channel notes are deleted.</p>

    <div v-if="savedTemplates.length === 0" class="no-templates">
      <p>No custom prompts saved yet. Import a channel or save settings to create one.</p>
    </div>

    <div v-else class="templates-list">
      <div
        v-for="template in savedTemplates"
        :key="template.channelName"
        class="template-card"
        :class="{ 'expanded': expandedTemplate === template.channelName }"
      >
        <div class="template-header" @click="toggleTemplate(template.channelName)">
          <span class="template-name">{{ template.channelName }}</span>
          <span class="expand-icon">{{ expandedTemplate === template.channelName ? '▼' : '▶' }}</span>
        </div>

        <div v-if="expandedTemplate === template.channelName" class="template-content">
          <div class="form-group">
            <label>Prompt Text:</label>
            <textarea
              v-model="editingTemplates[template.channelName].promptText"
              placeholder="Enter instructions for how to analyze and summarize the content..."
              rows="4"
              class="prompt-textarea"
            ></textarea>
          </div>
          <div class="form-group">
            <label>Output Schema (JSON):</label>
            <textarea
              v-model="editingTemplates[template.channelName].promptSchema"
              placeholder='{"summary": "string", "key_points": ["string"]}'
              rows="6"
              class="prompt-textarea schema-textarea"
            ></textarea>
          </div>
          <div class="template-actions">
            <button
              @click="saveTemplate(template.channelName)"
              :disabled="savingTemplate === template.channelName"
              class="save-btn"
            >
              {{ savingTemplate === template.channelName ? 'Saving...' : 'Save' }}
            </button>
            <button
              @click="deleteTemplate(template.channelName)"
              :disabled="deletingTemplate === template.channelName"
              class="delete-template-btn"
            >
              {{ deletingTemplate === template.channelName ? 'Deleting...' : 'Delete Prompt' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'PromptTemplates',
  props: {
    savedTemplates: {
      type: Array,
      required: true
    },
    channelSettings: {
      type: Object,
      required: true
    }
  },
  data() {
    return {
      expandedTemplate: null,
      editingTemplates: {},
      savingTemplate: null,
      deletingTemplate: null
    }
  },
  watch: {
    savedTemplates: {
      handler() {
        this.initializeEditingTemplates()
      },
      immediate: true
    }
  },
  methods: {
    initializeEditingTemplates() {
      this.editingTemplates = {}
      for (const template of this.savedTemplates) {
        const settings = this.channelSettings[template.channelName]
        if (settings && (settings.promptText || settings.promptSchema)) {
          this.editingTemplates[template.channelName] = {
            promptText: settings.promptText || '',
            promptSchema: settings.promptSchema || ''
          }
        }
      }
    },
    toggleTemplate(channelName) {
      if (this.expandedTemplate === channelName) {
        this.expandedTemplate = null
      } else {
        this.expandedTemplate = channelName
      }
    },
    async saveTemplate(channelName) {
      this.savingTemplate = channelName
      try {
        const template = this.editingTemplates[channelName]

        if (template.promptSchema && template.promptSchema.trim()) {
          const schemaError = this.validateSchema(template.promptSchema)
          if (schemaError) {
            alert('Invalid JSON schema: ' + schemaError)
            return
          }
        }

        await this.$emit('save-template', {
          channelName,
          promptText: template.promptText,
          promptSchema: template.promptSchema
        })
      } catch (error) {
        alert('Failed to save template. Please try again.')
      } finally {
        this.savingTemplate = null
      }
    },
    async deleteTemplate(channelName) {
      if (!confirm(`Delete the prompt template for "${channelName}"?`)) {
        return
      }

      this.deletingTemplate = channelName
      try {
        await this.$emit('delete-template', channelName)
        delete this.editingTemplates[channelName]
        this.expandedTemplate = null
      } catch (error) {
        alert('Failed to delete template. Please try again.')
      } finally {
        this.deletingTemplate = null
      }
    },
    validateSchema(schemaString) {
      if (!schemaString || !schemaString.trim()) {
        return null
      }
      try {
        JSON.parse(schemaString)
        return null
      } catch (e) {
        return e.message
      }
    }
  }
}
</script>

<style scoped>
.templates-section {
  margin-bottom: 30px;
}

.templates-section h2 {
  font-size: 18px;
  color: #333;
  margin: 0 0 8px 0;
}

.section-desc {
  color: #666;
  font-size: 14px;
  margin: 0 0 16px 0;
}

.no-templates {
  background: #f9f9f9;
  padding: 20px;
  border-radius: 8px;
  text-align: center;
  color: #666;
}

.no-templates p {
  margin: 0;
}

.templates-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.template-card {
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  overflow: hidden;
}

.template-card.expanded {
  border-color: #007AFF;
}

.template-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  cursor: pointer;
  background: #fafafa;
}

.template-card.expanded .template-header {
  background: #f0f7ff;
  border-bottom: 1px solid #e0e0e0;
}

.template-name {
  font-weight: 500;
  color: #333;
}

.expand-icon {
  font-size: 12px;
  opacity: 0.6;
}

.template-content {
  padding: 16px;
}

.form-group {
  margin-bottom: 16px;
}

.form-group:last-of-type {
  margin-bottom: 0;
}

.form-group > label {
  display: block;
  font-weight: 600;
  margin-bottom: 8px;
  color: #333;
  font-size: 14px;
}

.prompt-textarea {
  width: 100%;
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 13px;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  line-height: 1.5;
  resize: vertical;
  box-sizing: border-box;
}

.prompt-textarea:focus {
  outline: none;
  border-color: #007AFF;
}

.schema-textarea {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 12px;
}

.template-actions {
  display: flex;
  gap: 12px;
  margin-top: 12px;
}

.save-btn {
  background: #007AFF;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
  transition: background 0.2s;
  font-weight: 500;
}

.save-btn:hover:not(:disabled) {
  background: #0056b3;
}

.save-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.delete-template-btn {
  background: transparent;
  color: #dc3545;
  border: 1px solid #dc3545;
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.delete-template-btn:hover:not(:disabled) {
  background: #dc3545;
  color: white;
}

.delete-template-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>

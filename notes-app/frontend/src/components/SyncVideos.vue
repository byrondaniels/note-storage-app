<template>
  <div class="sync-section">
    <h4>Sync New Videos</h4>
    <p>Import new videos from this channel. Already-imported videos will be skipped.</p>

    <div v-if="!extensionAvailable" class="extension-warning-inline">
      Extension required for syncing.
    </div>

    <div v-else-if="!channelUrl" class="no-url-message">
      No channel URL saved. Re-import this channel to enable syncing.
    </div>

    <div v-else class="sync-controls">
      <div class="sync-row">
        <select
          v-model="videoLimit"
          :disabled="syncing"
          class="sync-limit-select"
        >
        <option value="1">1</option>
          <option value="5">5</option>
          <option value="10">10</option>
          <option value="20">20</option>
          <option value="50">50</option>
        </select>
        <button
          @click="startSync"
          :disabled="syncing"
          class="sync-btn"
        >
          {{ syncing ? 'Syncing...' : 'Sync New Videos' }}
        </button>
      </div>

      <div v-if="showProgress" class="sync-progress">
        <div class="progress-info">
          <span class="progress-text">
            Processing video {{ progress.current }} of {{ progress.total }}
          </span>
          <span v-if="progress.videoTitle" class="video-title">
            {{ progress.videoTitle }}
          </span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill sync-fill" :style="{ width: progressPercentage + '%' }"></div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'SyncVideos',
  props: {
    channel: {
      type: Object,
      required: true
    },
    extensionAvailable: {
      type: Boolean,
      required: true
    },
    channelUrl: {
      type: String,
      default: ''
    },
    progress: {
      type: Object,
      default: () => ({
        active: false,
        current: 0,
        total: 0,
        videoTitle: ''
      })
    }
  },
  data() {
    return {
      videoLimit: '20',
      syncing: false
    }
  },
  computed: {
    showProgress() {
      return this.progress.active && this.progress.channelName === this.channel.name
    },
    progressPercentage() {
      if (!this.showProgress || this.progress.total === 0) {
        return 0
      }
      return Math.round((this.progress.current / this.progress.total) * 100)
    }
  },
  methods: {
    startSync() {
      if (!this.channelUrl) {
        alert('No channel URL saved. Please re-import this channel.')
        return
      }

      this.$emit('sync-start', {
        channel: this.channel,
        videoLimit: parseInt(this.videoLimit)
      })
    },
    setSyncingState(state) {
      this.syncing = state
    }
  }
}
</script>

<style scoped>
.sync-section {
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px solid #e0e0e0;
}

.sync-section h4 {
  color: #333;
  margin: 0 0 8px 0;
  font-size: 14px;
}

.sync-section > p {
  color: #666;
  font-size: 13px;
  margin: 0 0 12px 0;
}

.extension-warning-inline {
  color: #856404;
  background: #fff3cd;
  padding: 8px 12px;
  border-radius: 4px;
  font-size: 13px;
}

.no-url-message {
  color: #666;
  font-size: 13px;
  font-style: italic;
}

.sync-controls {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.sync-row {
  display: flex;
  gap: 8px;
  align-items: center;
}

.sync-limit-select {
  width: 70px;
  padding: 10px 8px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
  background: white;
}

.sync-btn {
  background: #ff0000;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
  white-space: nowrap;
}

.sync-btn:hover:not(:disabled) {
  background: #cc0000;
}

.sync-btn:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.sync-progress {
  background: #fff3e0;
  border: 1px solid #ffcc80;
  border-radius: 6px;
  padding: 12px;
}

.progress-info {
  margin-bottom: 10px;
}

.progress-text {
  display: block;
  font-weight: 500;
  color: #333;
  font-size: 14px;
}

.video-title {
  display: block;
  color: #666;
  font-size: 13px;
  margin-top: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.progress-bar {
  height: 16px;
  background: #e0e0e0;
  border-radius: 8px;
  overflow: hidden;
}

.sync-fill {
  height: 100%;
  background: linear-gradient(90deg, #ff9800, #ffb74d);
  transition: width 0.3s ease;
  border-radius: 8px;
}
</style>

// SaveButton - UI component for saving social media posts
// Handles button creation and state management (loading, success, error)

class SaveButton {
  constructor(platform, onClick) {
    this.platform = platform;
    this.onClick = onClick;
    this.button = null;
    this.originalContent = '';
    this.originalColor = '';
    this.resetTimer = null;
  }

  createElement() {
    const button = document.createElement('button');
    button.className = 'social-save-btn';
    button.setAttribute('data-platform', this.platform);

    // Platform-specific text
    if (this.platform === 'youtube') {
      button.innerHTML = `<span>Save Transcript</span>`;
    } else {
      button.innerHTML = `<span>Save</span>`;
    }

    // Store original content
    this.originalContent = button.innerHTML;

    // Platform-specific styling
    if (this.platform === 'youtube') {
      this.originalColor = '#1976d2';
      button.style.cssText = `
        background-color: #1976d2 !important;
        color: white !important;
        border: none !important;
        border-radius: 18px !important;
        padding: 10px 16px !important;
        font-size: 14px !important;
        font-weight: 500 !important;
        cursor: pointer !important;
        margin-left: 8px !important;
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        height: 36px !important;
        min-width: 120px !important;
        transition: background-color 0.2s ease !important;
        position: relative !important;
        z-index: 1000 !important;
        isolation: isolate !important;
        pointer-events: auto !important;
        font-family: 'YouTube Sans', 'Roboto', sans-serif !important;
        box-shadow: 0 1px 2px rgba(0,0,0,0.1) !important;
      `;
    } else {
      this.originalColor = '#0a66c2';
      button.style.cssText = `
        background-color: #0a66c2 !important;
        color: white !important;
        border: none !important;
        border-radius: 16px !important;
        padding: 8px 16px !important;
        font-size: 14px !important;
        font-weight: 600 !important;
        cursor: pointer !important;
        margin-left: 8px !important;
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        height: 32px !important;
        min-width: 64px !important;
        transition: background-color 0.2s ease !important;
        position: relative !important;
        z-index: 1000 !important;
        isolation: isolate !important;
        pointer-events: auto !important;
      `;
    }

    // Hover effects - platform specific
    if (this.platform === 'youtube') {
      button.addEventListener('mouseenter', () => {
        button.style.backgroundColor = '#1565c0 !important';
      });

      button.addEventListener('mouseleave', () => {
        if (!button.disabled && !button.classList.contains('success') && !button.classList.contains('error')) {
          button.style.backgroundColor = '#1976d2 !important';
        }
      });
    } else {
      button.addEventListener('mouseenter', () => {
        if (!button.disabled && !button.classList.contains('success') && !button.classList.contains('error')) {
          button.style.backgroundColor = '#084d95 !important';
        }
      });

      button.addEventListener('mouseleave', () => {
        if (!button.disabled && !button.classList.contains('success') && !button.classList.contains('error')) {
          button.style.backgroundColor = '#0a66c2 !important';
        }
      });
    }

    button.title = 'Save post to notes';

    // Click handler
    button.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (this.onClick) {
        await this.onClick();
      }
    });

    this.button = button;
    return button;
  }

  setLoading() {
    if (!this.button) return;

    this.button.innerHTML = `<span>Saving...</span>`;
    this.button.style.backgroundColor = '#666666 !important';
    this.button.disabled = true;
  }

  setSuccess() {
    if (!this.button) return;

    // Clear any existing reset timer
    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
    }

    this.button.innerHTML = `<span>Saved!</span>`;
    this.button.style.setProperty('background-color', '#057642', 'important');
    this.button.style.setProperty('border-color', '#057642', 'important');
    this.button.classList.add('success');

    // Auto-reset after 2 seconds
    this.resetTimer = setTimeout(() => {
      this.reset();
    }, 2000);
  }

  setError(message) {
    if (!this.button) return;

    // Clear any existing reset timer
    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
    }

    this.button.innerHTML = `<span>Error</span>`;
    this.button.style.backgroundColor = '#cc1016 !important';
    this.button.classList.add('error');
    this.button.title = `Save failed: ${message}`;

    // Auto-reset after 3 seconds
    this.resetTimer = setTimeout(() => {
      this.reset();
    }, 3000);
  }

  reset() {
    if (!this.button) return;

    this.button.innerHTML = this.originalContent;
    this.button.disabled = false;
    this.button.style.setProperty('background-color', this.originalColor, 'important');
    this.button.style.setProperty('border-color', this.originalColor, 'important');
    this.button.classList.remove('success', 'error');
    this.button.title = 'Save post to notes';

    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
      this.resetTimer = null;
    }
  }

  getElement() {
    return this.button;
  }
}

// Export for ES6 modules
export { SaveButton };

// Also make available globally for content scripts (when loaded as regular script)
if (typeof window !== 'undefined') {
  window.SaveButton = SaveButton;
}

// NotesApiClient - Service for communicating with the notes API
// Handles saving notes and testing API connectivity

class NotesApiClient {
  constructor(endpoint) {
    this.endpoint = endpoint;
  }

  /**
   * Save a note to the API
   * @param {Object} payload - The note payload to save
   * @returns {Promise<Object>} Result object with success/error info
   */
  async saveNote(payload) {
    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      // Handle 409 Conflict (duplicate note) as skipped, not error
      if (response.status === 409) {
        console.log('NotesApiClient: Note already exists (duplicate)');
        return {
          success: true,
          skipped: true,
          status: 409
        };
      }

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }

      console.log('NotesApiClient: Successfully saved note');
      return {
        success: true,
        status: response.status
      };

    } catch (error) {
      console.error('NotesApiClient: Failed to save note:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Test the API connection with a test payload
   * @param {Object} testPayload - Test payload to send
   * @returns {Promise<Object>} Result object with success/error info and response preview
   */
  async testConnection(testPayload) {
    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(testPayload)
      });

      if (!response.ok) {
        throw new Error(`${response.status}: ${response.statusText}`);
      }

      const data = await response.text();
      return {
        success: true,
        status: response.status,
        response: data.substring(0, 200) // Limit response size
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Update the API endpoint
   * @param {string} newEndpoint - The new API endpoint URL
   */
  setEndpoint(newEndpoint) {
    this.endpoint = newEndpoint;
  }

  /**
   * Get the current API endpoint
   * @returns {string} The current endpoint URL
   */
  getEndpoint() {
    return this.endpoint;
  }
}

// ES module export for background.js and other module contexts
export { NotesApiClient };

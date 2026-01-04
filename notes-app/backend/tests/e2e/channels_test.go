package e2e

import (
	"net/http"
	"testing"

	"backend/internal/models"
)

func TestChannelsAPI(t *testing.T) {
	env := SetupTestEnv(t)
	defer TeardownTestEnv(t, env)

	t.Run("Channels Operations", func(t *testing.T) {
		CleanupCollections(t, env)

		// Create notes with different channels
		CreateTestNote(t, env, "Video transcript 1", map[string]interface{}{
			"author":   "TechChannel",
			"platform": "youtube",
			"url":      "https://youtube.com/watch?v=1",
		})
		CreateTestNote(t, env, "Video transcript 2", map[string]interface{}{
			"author":   "TechChannel",
			"platform": "youtube",
			"url":      "https://youtube.com/watch?v=2",
		})
		CreateTestNote(t, env, "Tweet from user", map[string]interface{}{
			"author":   "TwitterUser",
			"platform": "twitter",
			"url":      "https://twitter.com/status/123",
		})

		// Test 1: Get all channels
		t.Run("GET /channels returns channels with note counts", func(t *testing.T) {
			w := HTTPRequest(t, env, "GET", "/channels", nil)

			if w.Code != http.StatusOK {
				t.Errorf("Expected status 200, got %d: %s", w.Code, w.Body.String())
			}

			var channels []map[string]interface{}
			ParseResponse(t, w, &channels)

			if len(channels) != 2 {
				t.Errorf("Expected 2 channels, got %d", len(channels))
			}

			// TechChannel should have 2 notes
			for _, ch := range channels {
				if ch["name"] == "TechChannel" {
					if ch["noteCount"].(float64) != 2 {
						t.Errorf("Expected TechChannel to have 2 notes, got %v", ch["noteCount"])
					}
					if ch["platform"] != "youtube" {
						t.Errorf("Expected TechChannel platform to be youtube, got %v", ch["platform"])
					}
				}
			}
		})
	})

	t.Run("Channel Settings CRUD", func(t *testing.T) {
		CleanupCollections(t, env)

		// Test 1: Get settings for non-existent channel (returns defaults)
		t.Run("GET /channel-settings/:channel returns defaults for new channel", func(t *testing.T) {
			w := HTTPRequest(t, env, "GET", "/channel-settings/NewChannel", nil)

			if w.Code != http.StatusOK {
				t.Errorf("Expected status 200, got %d", w.Code)
			}

			var settings models.ChannelSettings
			ParseResponse(t, w, &settings)

			if settings.ChannelName != "NewChannel" {
				t.Errorf("Expected channel name 'NewChannel', got '%s'", settings.ChannelName)
			}
			if settings.PromptText != "" {
				t.Errorf("Expected empty prompt text for new channel")
			}
		})

		// Test 2: Create channel settings
		t.Run("PUT /channel-settings/:channel creates settings", func(t *testing.T) {
			reqBody := map[string]interface{}{
				"platform":     "youtube",
				"channelUrl":   "https://youtube.com/@techchannel",
				"promptText":   "Summarize this video focusing on key technical concepts",
				"promptSchema": `{"concepts": ["string"], "summary": "string"}`,
			}

			w := HTTPRequest(t, env, "PUT", "/channel-settings/TechChannel", reqBody)

			if w.Code != http.StatusOK {
				t.Errorf("Expected status 200, got %d: %s", w.Code, w.Body.String())
			}

			var settings models.ChannelSettings
			ParseResponse(t, w, &settings)

			if settings.ChannelName != "TechChannel" {
				t.Errorf("Expected channel name 'TechChannel', got '%s'", settings.ChannelName)
			}
			if settings.Platform != "youtube" {
				t.Errorf("Expected platform 'youtube', got '%s'", settings.Platform)
			}
		})

		// Test 3: Get created settings
		t.Run("GET /channel-settings/:channel returns saved settings", func(t *testing.T) {
			w := HTTPRequest(t, env, "GET", "/channel-settings/TechChannel", nil)

			if w.Code != http.StatusOK {
				t.Errorf("Expected status 200, got %d", w.Code)
			}

			var settings models.ChannelSettings
			ParseResponse(t, w, &settings)

			if settings.PromptText == "" {
				t.Error("Expected non-empty prompt text")
			}
		})

		// Test 4: Get all channel settings
		t.Run("GET /channel-settings returns all settings", func(t *testing.T) {
			// Create another channel settings
			reqBody := map[string]interface{}{
				"platform":   "twitter",
				"promptText": "Summarize this tweet thread",
			}
			HTTPRequest(t, env, "PUT", "/channel-settings/TwitterUser", reqBody)

			w := HTTPRequest(t, env, "GET", "/channel-settings", nil)

			if w.Code != http.StatusOK {
				t.Errorf("Expected status 200, got %d", w.Code)
			}

			var settings []models.ChannelSettings
			ParseResponse(t, w, &settings)

			if len(settings) != 2 {
				t.Errorf("Expected 2 channel settings, got %d", len(settings))
			}
		})

		// Test 5: Update channel settings
		t.Run("PUT /channel-settings/:channel updates existing settings", func(t *testing.T) {
			reqBody := map[string]interface{}{
				"platform":     "youtube",
				"channelUrl":   "https://youtube.com/@techchannel",
				"promptText":   "Updated prompt for technical videos",
				"promptSchema": `{"updated": true}`,
			}

			w := HTTPRequest(t, env, "PUT", "/channel-settings/TechChannel", reqBody)

			if w.Code != http.StatusOK {
				t.Errorf("Expected status 200, got %d", w.Code)
			}

			var settings models.ChannelSettings
			ParseResponse(t, w, &settings)

			if settings.PromptText != "Updated prompt for technical videos" {
				t.Errorf("Expected updated prompt text, got '%s'", settings.PromptText)
			}
		})

		// Test 6: Delete channel settings
		t.Run("DELETE /channel-settings/:channel deletes settings", func(t *testing.T) {
			w := HTTPRequest(t, env, "DELETE", "/channel-settings/TwitterUser", nil)

			if w.Code != http.StatusOK {
				t.Errorf("Expected status 200, got %d", w.Code)
			}

			// Verify deletion
			w = HTTPRequest(t, env, "GET", "/channel-settings", nil)
			var settings []models.ChannelSettings
			ParseResponse(t, w, &settings)

			if len(settings) != 1 {
				t.Errorf("Expected 1 channel setting after deletion, got %d", len(settings))
			}
		})

		// Test 7: Delete non-existent settings returns 404
		t.Run("DELETE /channel-settings/:channel for non-existent returns 404", func(t *testing.T) {
			w := HTTPRequest(t, env, "DELETE", "/channel-settings/NonExistent", nil)

			if w.Code != http.StatusNotFound {
				t.Errorf("Expected status 404, got %d", w.Code)
			}
		})
	})

	t.Run("Channel Settings Validation", func(t *testing.T) {
		CleanupCollections(t, env)

		// Test: Invalid JSON in promptSchema
		t.Run("PUT /channel-settings/:channel with invalid JSON schema returns 400", func(t *testing.T) {
			reqBody := map[string]interface{}{
				"platform":     "youtube",
				"promptSchema": "this is not valid json",
			}

			w := HTTPRequest(t, env, "PUT", "/channel-settings/BadChannel", reqBody)

			if w.Code != http.StatusBadRequest {
				t.Errorf("Expected status 400, got %d", w.Code)
			}
		})
	})

	t.Run("Delete Channel Notes", func(t *testing.T) {
		CleanupCollections(t, env)

		// Create notes for a channel
		CreateTestNote(t, env, "Note 1", map[string]interface{}{
			"author":   "ChannelToDelete",
			"platform": "youtube",
		})
		CreateTestNote(t, env, "Note 2", map[string]interface{}{
			"author":   "ChannelToDelete",
			"platform": "youtube",
		})
		CreateTestNote(t, env, "Note from other channel", map[string]interface{}{
			"author":   "OtherChannel",
			"platform": "youtube",
		})

		// Test: Delete all notes for a channel
		t.Run("DELETE /channels/:channel/notes deletes all channel notes", func(t *testing.T) {
			w := HTTPRequest(t, env, "DELETE", "/channels/ChannelToDelete/notes", nil)

			if w.Code != http.StatusOK {
				t.Errorf("Expected status 200, got %d: %s", w.Code, w.Body.String())
			}

			var result map[string]interface{}
			ParseResponse(t, w, &result)

			if result["deletedNotes"].(float64) != 2 {
				t.Errorf("Expected 2 deleted notes, got %v", result["deletedNotes"])
			}

			// Verify only OtherChannel notes remain
			w = HTTPRequest(t, env, "GET", "/notes", nil)
			var notes []models.Note
			ParseResponse(t, w, &notes)

			if len(notes) != 1 {
				t.Errorf("Expected 1 note remaining, got %d", len(notes))
			}
		})
	})
}

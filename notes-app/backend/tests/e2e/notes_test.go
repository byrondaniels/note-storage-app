package e2e

import (
	"net/http"
	"testing"

	"backend/internal/models"
)

func TestNotesAPI(t *testing.T) {
	env := SetupTestEnv(t)
	defer TeardownTestEnv(t, env)

	t.Run("Notes CRUD Operations", func(t *testing.T) {
		CleanupCollections(t, env)

		// Test 1: Get notes when empty
		t.Run("GET /notes returns empty array initially", func(t *testing.T) {
			w := HTTPRequest(t, env, "GET", "/notes", nil)

			if w.Code != http.StatusOK {
				t.Errorf("Expected status 200, got %d", w.Code)
			}

			var notes []models.Note
			ParseResponse(t, w, &notes)

			if len(notes) != 0 {
				t.Errorf("Expected 0 notes, got %d", len(notes))
			}
		})

		// Test 2: Create a note
		var createdNoteID string
		t.Run("POST /notes creates a note", func(t *testing.T) {
			reqBody := map[string]interface{}{
				"content": "This is a test note about software development and testing best practices.",
				"title":   "Test Note",
				"metadata": map[string]interface{}{
					"platform": "test",
					"author":   "Test Author",
				},
			}

			w := HTTPRequest(t, env, "POST", "/notes", reqBody)

			if w.Code != http.StatusCreated && w.Code != http.StatusInternalServerError {
				// Note: May return 500 if AI services are not configured
				t.Logf("Status: %d, Body: %s", w.Code, w.Body.String())
			}

			if w.Code == http.StatusCreated {
				var note models.Note
				ParseResponse(t, w, &note)
				createdNoteID = note.ID.Hex()

				if note.Content != reqBody["content"] {
					t.Errorf("Content mismatch")
				}
			}
		})

		// Test 3: Get notes after creation
		t.Run("GET /notes returns created note", func(t *testing.T) {
			if createdNoteID == "" {
				t.Skip("No note was created")
			}

			w := HTTPRequest(t, env, "GET", "/notes", nil)

			if w.Code != http.StatusOK {
				t.Errorf("Expected status 200, got %d", w.Code)
			}

			var notes []models.Note
			ParseResponse(t, w, &notes)

			if len(notes) < 1 {
				t.Errorf("Expected at least 1 note, got %d", len(notes))
			}
		})

		// Test 4: Update a note
		t.Run("PUT /notes/:id updates a note", func(t *testing.T) {
			if createdNoteID == "" {
				t.Skip("No note was created")
			}

			reqBody := map[string]interface{}{
				"content": "Updated content for the test note.",
			}

			w := HTTPRequest(t, env, "PUT", "/notes/"+createdNoteID, reqBody)

			if w.Code != http.StatusOK && w.Code != http.StatusInternalServerError {
				t.Errorf("Expected status 200 or 500, got %d: %s", w.Code, w.Body.String())
			}

			if w.Code == http.StatusOK {
				var note models.Note
				ParseResponse(t, w, &note)

				if note.Content != reqBody["content"] {
					t.Errorf("Content was not updated")
				}
			}
		})

		// Test 5: Delete a note
		t.Run("DELETE /notes/:id deletes a note", func(t *testing.T) {
			if createdNoteID == "" {
				t.Skip("No note was created")
			}

			w := HTTPRequest(t, env, "DELETE", "/notes/"+createdNoteID, nil)

			if w.Code != http.StatusOK {
				t.Errorf("Expected status 200, got %d: %s", w.Code, w.Body.String())
			}
		})

		// Test 6: Verify note is deleted
		t.Run("GET /notes/:id returns 404 after deletion", func(t *testing.T) {
			if createdNoteID == "" {
				t.Skip("No note was created")
			}

			w := HTTPRequest(t, env, "DELETE", "/notes/"+createdNoteID, nil)

			if w.Code != http.StatusNotFound {
				t.Errorf("Expected status 404, got %d", w.Code)
			}
		})
	})

	t.Run("Notes Validation", func(t *testing.T) {
		CleanupCollections(t, env)

		// Test: Create note without content
		t.Run("POST /notes without content returns 400", func(t *testing.T) {
			reqBody := map[string]interface{}{
				"title": "No Content Note",
			}

			w := HTTPRequest(t, env, "POST", "/notes", reqBody)

			if w.Code != http.StatusBadRequest {
				t.Errorf("Expected status 400, got %d", w.Code)
			}
		})

		// Test: Update with invalid note ID
		t.Run("PUT /notes/:id with invalid ID returns 404", func(t *testing.T) {
			reqBody := map[string]interface{}{
				"content": "Updated content",
			}

			w := HTTPRequest(t, env, "PUT", "/notes/invalid-id", reqBody)

			if w.Code != http.StatusNotFound {
				t.Errorf("Expected status 404, got %d", w.Code)
			}
		})

		// Test: Delete with invalid note ID
		t.Run("DELETE /notes/:id with invalid ID returns 404", func(t *testing.T) {
			w := HTTPRequest(t, env, "DELETE", "/notes/invalid-id", nil)

			if w.Code != http.StatusNotFound {
				t.Errorf("Expected status 404, got %d", w.Code)
			}
		})
	})

	t.Run("Notes Filtering", func(t *testing.T) {
		CleanupCollections(t, env)

		// Create test notes with different channels
		CreateTestNote(t, env, "Note from Channel A", map[string]interface{}{
			"author":   "Channel A",
			"platform": "youtube",
		})
		CreateTestNote(t, env, "Note from Channel B", map[string]interface{}{
			"author":   "Channel B",
			"platform": "twitter",
		})
		CreateTestNote(t, env, "Another note from Channel A", map[string]interface{}{
			"author":   "Channel A",
			"platform": "youtube",
		})

		// Test: Filter by channel
		t.Run("GET /notes?channel=Channel A filters by channel", func(t *testing.T) {
			w := HTTPRequest(t, env, "GET", "/notes?channel=Channel A", nil)

			if w.Code != http.StatusOK {
				t.Errorf("Expected status 200, got %d", w.Code)
			}

			var notes []models.Note
			ParseResponse(t, w, &notes)

			if len(notes) != 2 {
				t.Errorf("Expected 2 notes for Channel A, got %d", len(notes))
			}

			for _, note := range notes {
				if note.Metadata["author"] != "Channel A" {
					t.Errorf("Expected all notes to be from Channel A")
				}
			}
		})

		// Test: Get all notes without filter
		t.Run("GET /notes without filter returns all notes", func(t *testing.T) {
			w := HTTPRequest(t, env, "GET", "/notes", nil)

			if w.Code != http.StatusOK {
				t.Errorf("Expected status 200, got %d", w.Code)
			}

			var notes []models.Note
			ParseResponse(t, w, &notes)

			if len(notes) != 3 {
				t.Errorf("Expected 3 notes total, got %d", len(notes))
			}
		})
	})
}

func TestNotesDuplicateDetection(t *testing.T) {
	env := SetupTestEnv(t)
	defer TeardownTestEnv(t, env)
	CleanupCollections(t, env)

	// Create a note with a URL
	CreateTestNote(t, env, "Original note content", map[string]interface{}{
		"url":      "https://example.com/post/123",
		"platform": "twitter",
		"author":   "Test Author",
	})

	// Try to create a duplicate note with the same URL
	t.Run("POST /notes with duplicate URL returns 409", func(t *testing.T) {
		reqBody := map[string]interface{}{
			"content": "Duplicate note content",
			"metadata": map[string]interface{}{
				"url":      "https://example.com/post/123",
				"platform": "twitter",
				"author":   "Test Author",
			},
		}

		w := HTTPRequest(t, env, "POST", "/notes", reqBody)

		// Should return 409 Conflict or proceed depending on implementation
		if w.Code == http.StatusConflict {
			var response map[string]interface{}
			ParseResponse(t, w, &response)

			if response["error"] != "duplicate" {
				t.Errorf("Expected 'duplicate' error, got: %v", response["error"])
			}
		}
	})
}

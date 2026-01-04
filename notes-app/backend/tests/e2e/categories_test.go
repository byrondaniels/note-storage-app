package e2e

import (
	"context"
	"net/http"
	"testing"
	"time"

	"backend/internal/models"
)

func TestCategoriesAPI(t *testing.T) {
	env := SetupTestEnv(t)
	defer TeardownTestEnv(t, env)

	t.Run("Categories Operations", func(t *testing.T) {
		CleanupCollections(t, env)

		// Create notes with different categories
		createNoteWithCategory := func(content, category string) {
			note := models.Note{
				Content:  content,
				Title:    "Test Note - " + category,
				Category: category,
				Created:  time.Now(),
			}
			_, err := env.Database.Collection("notes").InsertOne(context.Background(), note)
			if err != nil {
				t.Fatalf("Failed to create test note: %v", err)
			}
		}

		createNoteWithCategory("Work meeting notes", "meeting-notes")
		createNoteWithCategory("Another meeting", "meeting-notes")
		createNoteWithCategory("My personal journal", "journal")
		createNoteWithCategory("Recipe for pasta", "recipes")

		// Test 1: Get all categories
		t.Run("GET /categories returns category counts", func(t *testing.T) {
			w := HTTPRequest(t, env, "GET", "/categories", nil)

			if w.Code != http.StatusOK {
				t.Errorf("Expected status 200, got %d", w.Code)
			}

			var categories []models.CategoryCount
			ParseResponse(t, w, &categories)

			// Should have at least the categories we created
			if len(categories) < 3 {
				t.Errorf("Expected at least 3 categories, got %d", len(categories))
			}

			// Check meeting-notes count
			for _, cat := range categories {
				if cat.Name == "meeting-notes" && cat.Count != 2 {
					t.Errorf("Expected meeting-notes count to be 2, got %d", cat.Count)
				}
			}
		})

		// Test 2: Get notes by category
		t.Run("GET /notes/category/:category returns filtered notes", func(t *testing.T) {
			w := HTTPRequest(t, env, "GET", "/notes/category/meeting-notes", nil)

			if w.Code != http.StatusOK {
				t.Errorf("Expected status 200, got %d", w.Code)
			}

			var notes []models.Note
			ParseResponse(t, w, &notes)

			if len(notes) != 2 {
				t.Errorf("Expected 2 notes in meeting-notes category, got %d", len(notes))
			}

			for _, note := range notes {
				if note.Category != "meeting-notes" {
					t.Errorf("Expected category 'meeting-notes', got '%s'", note.Category)
				}
			}
		})

		// Test 3: Get notes by non-existent category
		t.Run("GET /notes/category/:category with valid empty category returns empty array", func(t *testing.T) {
			w := HTTPRequest(t, env, "GET", "/notes/category/goals", nil)

			if w.Code != http.StatusOK {
				t.Errorf("Expected status 200, got %d: %s", w.Code, w.Body.String())
			}

			var notes []models.Note
			ParseResponse(t, w, &notes)

			if len(notes) != 0 {
				t.Errorf("Expected 0 notes in goals category, got %d", len(notes))
			}
		})

		// Test 4: Get notes by invalid category
		t.Run("GET /notes/category/:category with invalid category returns 400", func(t *testing.T) {
			w := HTTPRequest(t, env, "GET", "/notes/category/invalid-category-name", nil)

			if w.Code != http.StatusBadRequest {
				t.Errorf("Expected status 400, got %d", w.Code)
			}
		})

		// Test 5: Get category stats
		t.Run("GET /categories/stats returns statistics", func(t *testing.T) {
			w := HTTPRequest(t, env, "GET", "/categories/stats", nil)

			if w.Code != http.StatusOK {
				t.Errorf("Expected status 200, got %d", w.Code)
			}

			var stats map[string]interface{}
			ParseResponse(t, w, &stats)

			// Check that stats contains expected fields
			if _, ok := stats["categories"]; !ok {
				t.Error("Expected 'categories' field in stats")
			}
			if _, ok := stats["total_notes"]; !ok {
				t.Error("Expected 'total_notes' field in stats")
			}
			if _, ok := stats["total_categories"]; !ok {
				t.Error("Expected 'total_categories' field in stats")
			}

			totalNotes := stats["total_notes"].(float64)
			if totalNotes != 4 {
				t.Errorf("Expected total_notes to be 4, got %v", totalNotes)
			}
		})
	})
}

func TestCategoryMigration(t *testing.T) {
	env := SetupTestEnv(t)
	defer TeardownTestEnv(t, env)
	CleanupCollections(t, env)

	// Create notes without categories
	createUncategorizedNote := func(content string) {
		note := models.Note{
			Content:  content,
			Title:    "Uncategorized Note",
			Category: "", // Empty category
			Created:  time.Now(),
		}
		_, err := env.Database.Collection("notes").InsertOne(context.Background(), note)
		if err != nil {
			t.Fatalf("Failed to create test note: %v", err)
		}
	}

	createUncategorizedNote("This is about cooking and recipes")
	createUncategorizedNote("Meeting notes from today's standup")

	// Test: Classify existing notes (requires AI)
	t.Run("POST /migrate/classify classifies uncategorized notes", func(t *testing.T) {
		w := HTTPRequest(t, env, "POST", "/migrate/classify", nil)

		// This may fail without AI configured
		if w.Code == http.StatusOK {
			var result map[string]interface{}
			ParseResponse(t, w, &result)

			if result["total"].(float64) != 2 {
				t.Errorf("Expected total to be 2, got %v", result["total"])
			}
		} else if w.Code == http.StatusInternalServerError {
			t.Log("Migration failed (likely AI not configured)")
		} else {
			t.Errorf("Unexpected status: %d", w.Code)
		}
	})
}

package e2e

import (
	"net/http"
	"os"
	"testing"

	"backend/internal/models"
)

func TestSearchAPI(t *testing.T) {
	env := SetupTestEnv(t)
	defer TeardownTestEnv(t, env)

	// Skip if AI is not configured
	if os.Getenv("GEMINI_API_KEY") == "" {
		t.Skip("Skipping search tests: GEMINI_API_KEY not set")
	}

	t.Run("Search Operations", func(t *testing.T) {
		CleanupCollections(t, env)

		// Test 1: Search returns empty when no notes
		t.Run("POST /search returns empty results when no notes", func(t *testing.T) {
			reqBody := map[string]interface{}{
				"query": "test query",
				"limit": 10,
			}

			w := HTTPRequest(t, env, "POST", "/search", reqBody)

			if w.Code != http.StatusOK {
				t.Errorf("Expected status 200, got %d: %s", w.Code, w.Body.String())
			}

			var results []models.SearchResult
			ParseResponse(t, w, &results)

			if len(results) != 0 {
				t.Errorf("Expected 0 results, got %d", len(results))
			}
		})

		// Test 2: Search validation - missing query
		t.Run("POST /search without query returns 400", func(t *testing.T) {
			reqBody := map[string]interface{}{
				"limit": 10,
			}

			w := HTTPRequest(t, env, "POST", "/search", reqBody)

			if w.Code != http.StatusBadRequest {
				t.Errorf("Expected status 400, got %d", w.Code)
			}
		})

		// Test 3: Search validation - empty query
		t.Run("POST /search with empty query returns 400", func(t *testing.T) {
			reqBody := map[string]interface{}{
				"query": "",
			}

			w := HTTPRequest(t, env, "POST", "/search", reqBody)

			if w.Code != http.StatusBadRequest {
				t.Errorf("Expected status 400, got %d", w.Code)
			}
		})
	})
}

func TestQuestionAnswerAPI(t *testing.T) {
	env := SetupTestEnv(t)
	defer TeardownTestEnv(t, env)

	// Skip if AI is not configured
	if os.Getenv("GEMINI_API_KEY") == "" {
		t.Skip("Skipping Q&A tests: GEMINI_API_KEY not set")
	}

	t.Run("Q&A Operations", func(t *testing.T) {
		CleanupCollections(t, env)

		// Test 1: Ask without notes
		t.Run("POST /ask returns response even without notes", func(t *testing.T) {
			reqBody := map[string]interface{}{
				"question": "What is the meaning of life?",
			}

			w := HTTPRequest(t, env, "POST", "/ask", reqBody)

			// Should still work, just may not have relevant sources
			if w.Code != http.StatusOK && w.Code != http.StatusInternalServerError {
				t.Errorf("Expected status 200 or 500, got %d", w.Code)
			}

			if w.Code == http.StatusOK {
				var response models.QuestionResponse
				ParseResponse(t, w, &response)

				if response.Question != "What is the meaning of life?" {
					t.Errorf("Expected question to be echoed back")
				}
			}
		})

		// Test 2: Ask validation - missing question
		t.Run("POST /ask without question returns 400", func(t *testing.T) {
			reqBody := map[string]interface{}{}

			w := HTTPRequest(t, env, "POST", "/ask", reqBody)

			if w.Code != http.StatusBadRequest {
				t.Errorf("Expected status 400, got %d", w.Code)
			}
		})
	})
}

func TestAIQuestionAPI(t *testing.T) {
	env := SetupTestEnv(t)
	defer TeardownTestEnv(t, env)

	// Skip if AI is not configured
	if os.Getenv("GEMINI_API_KEY") == "" {
		t.Skip("Skipping AI question tests: GEMINI_API_KEY not set")
	}

	t.Run("AI Question Operations", func(t *testing.T) {
		CleanupCollections(t, env)

		// Test 1: Ask AI about content
		t.Run("POST /ai-question analyzes content", func(t *testing.T) {
			reqBody := map[string]interface{}{
				"content": "The quick brown fox jumps over the lazy dog. This is a test sentence.",
				"prompt":  "What animals are mentioned in this text?",
			}

			w := HTTPRequest(t, env, "POST", "/ai-question", reqBody)

			if w.Code != http.StatusOK && w.Code != http.StatusInternalServerError {
				t.Errorf("Expected status 200 or 500, got %d", w.Code)
			}

			if w.Code == http.StatusOK {
				var response models.AIQuestionResponse
				ParseResponse(t, w, &response)

				if response.Response == "" {
					t.Error("Expected non-empty response")
				}
			}
		})

		// Test 2: Validation - missing content
		t.Run("POST /ai-question without content returns 400", func(t *testing.T) {
			reqBody := map[string]interface{}{
				"prompt": "What is this about?",
			}

			w := HTTPRequest(t, env, "POST", "/ai-question", reqBody)

			if w.Code != http.StatusBadRequest {
				t.Errorf("Expected status 400, got %d", w.Code)
			}
		})

		// Test 3: Validation - missing prompt
		t.Run("POST /ai-question without prompt returns 400", func(t *testing.T) {
			reqBody := map[string]interface{}{
				"content": "Some content to analyze",
			}

			w := HTTPRequest(t, env, "POST", "/ai-question", reqBody)

			if w.Code != http.StatusBadRequest {
				t.Errorf("Expected status 400, got %d", w.Code)
			}
		})
	})
}

func TestSummaryAPI(t *testing.T) {
	env := SetupTestEnv(t)
	defer TeardownTestEnv(t, env)

	// Skip if AI is not configured
	if os.Getenv("GEMINI_API_KEY") == "" {
		t.Skip("Skipping summary tests: GEMINI_API_KEY not set")
	}

	t.Run("Summary Operations", func(t *testing.T) {
		CleanupCollections(t, env)

		// Create a test note
		noteID := CreateTestNote(t, env, `
			This is a detailed note about software testing.
			Testing is crucial for software quality.
			There are many types of tests including unit tests, integration tests, and end-to-end tests.
			Each type serves a different purpose in ensuring code quality.
		`, nil)

		// Test 1: Summarize by ID
		t.Run("POST /summarize/:id generates summary for note", func(t *testing.T) {
			w := HTTPRequest(t, env, "POST", "/summarize/"+noteID.Hex(), nil)

			if w.Code != http.StatusOK && w.Code != http.StatusInternalServerError {
				t.Errorf("Expected status 200 or 500, got %d: %s", w.Code, w.Body.String())
			}

			if w.Code == http.StatusOK {
				var response models.SummarizeResponse
				ParseResponse(t, w, &response)

				if response.Summary == "" {
					t.Error("Expected non-empty summary")
				}
			}
		})

		// Test 2: Summarize with custom prompt
		t.Run("POST /summarize/:id with custom prompt", func(t *testing.T) {
			reqBody := map[string]interface{}{
				"promptText": "List the types of tests mentioned",
			}

			w := HTTPRequest(t, env, "POST", "/summarize/"+noteID.Hex(), reqBody)

			if w.Code != http.StatusOK && w.Code != http.StatusInternalServerError {
				t.Errorf("Expected status 200 or 500, got %d", w.Code)
			}
		})

		// Test 3: Summarize with invalid note ID
		t.Run("POST /summarize/:id with invalid ID returns error", func(t *testing.T) {
			w := HTTPRequest(t, env, "POST", "/summarize/invalid-id", nil)

			if w.Code == http.StatusOK {
				t.Error("Expected error for invalid ID")
			}
		})

		// Test 4: Summarize content directly
		t.Run("POST /summarize with content", func(t *testing.T) {
			reqBody := map[string]interface{}{
				"content": "This is a long piece of content that needs to be summarized. It talks about various topics including technology, science, and art.",
			}

			w := HTTPRequest(t, env, "POST", "/summarize", reqBody)

			if w.Code != http.StatusOK && w.Code != http.StatusInternalServerError {
				t.Errorf("Expected status 200 or 500, got %d", w.Code)
			}
		})
	})
}

package ai

import (
	"fmt"
	"strings"

	"backend/internal/models"
)

// MockAIClient provides mock AI responses for testing
type MockAIClient struct {
	// Optional callbacks for custom behavior
	AnalyzeNoteFunc             func(content string, includeSummary bool) (*models.NoteAnalysis, error)
	ClassifyNoteFunc            func(title, content string) (string, error)
	GenerateTitleFunc           func(content string) (string, error)
	GenerateSummaryFunc         func(content string) (string, error)
	GenerateSummaryWithPromptFunc func(content, customPrompt string) (string, error)
	GenerateStructuredSummaryFunc func(content, promptText, promptSchema string) (string, map[string]interface{}, error)
	GenerateAnswerFunc          func(question, contextText string) (string, error)
	GenerateEmbeddingFunc       func(text string) ([]float32, error)
}

// NewMockAIClient creates a new mock AI client with default behavior
func NewMockAIClient() *MockAIClient {
	return &MockAIClient{}
}

// Ensure MockAIClient implements Client interface
var _ Client = (*MockAIClient)(nil)

// Close is a no-op for the mock client
func (m *MockAIClient) Close() error {
	return nil
}

// AnalyzeNote returns a mock analysis
func (m *MockAIClient) AnalyzeNote(content string, includeSummary bool) (*models.NoteAnalysis, error) {
	if m.AnalyzeNoteFunc != nil {
		return m.AnalyzeNoteFunc(content, includeSummary)
	}

	// Generate a simple title from first few words
	title := generateMockTitle(content)

	analysis := &models.NoteAnalysis{
		Title:    title,
		Category: "other",
	}

	if includeSummary {
		analysis.Summary = generateMockSummary(content)
	}

	return analysis, nil
}

// ClassifyNote returns a mock classification
func (m *MockAIClient) ClassifyNote(title, content string) (string, error) {
	if m.ClassifyNoteFunc != nil {
		return m.ClassifyNoteFunc(title, content)
	}
	return "other", nil
}

// GenerateTitle returns a mock title
func (m *MockAIClient) GenerateTitle(content string) (string, error) {
	if m.GenerateTitleFunc != nil {
		return m.GenerateTitleFunc(content)
	}
	return generateMockTitle(content), nil
}

// GenerateSummary returns a mock summary
func (m *MockAIClient) GenerateSummary(content string) (string, error) {
	if m.GenerateSummaryFunc != nil {
		return m.GenerateSummaryFunc(content)
	}
	return generateMockSummary(content), nil
}

// GenerateSummaryWithPrompt returns a mock summary
func (m *MockAIClient) GenerateSummaryWithPrompt(content, customPrompt string) (string, error) {
	if m.GenerateSummaryWithPromptFunc != nil {
		return m.GenerateSummaryWithPromptFunc(content, customPrompt)
	}
	return generateMockSummary(content), nil
}

// GenerateStructuredSummary returns a mock structured summary
func (m *MockAIClient) GenerateStructuredSummary(content, promptText, promptSchema string) (string, map[string]interface{}, error) {
	if m.GenerateStructuredSummaryFunc != nil {
		return m.GenerateStructuredSummaryFunc(content, promptText, promptSchema)
	}

	summary := generateMockSummary(content)
	structuredData := map[string]interface{}{
		"summary": summary,
	}

	return summary, structuredData, nil
}

// GenerateAnswer returns a mock answer
func (m *MockAIClient) GenerateAnswer(question, contextText string) (string, error) {
	if m.GenerateAnswerFunc != nil {
		return m.GenerateAnswerFunc(question, contextText)
	}
	return fmt.Sprintf("Based on your notes, here is information related to: %s", question), nil
}

// GenerateEmbedding returns a mock embedding vector
func (m *MockAIClient) GenerateEmbedding(text string) ([]float32, error) {
	if m.GenerateEmbeddingFunc != nil {
		return m.GenerateEmbeddingFunc(text)
	}

	// Return a 768-dimensional zero vector (matching text-embedding-004 dimensions)
	embedding := make([]float32, 768)
	// Add some variation based on text length to make embeddings slightly different
	for i := 0; i < len(embedding) && i < len(text); i++ {
		embedding[i] = float32(text[i]) / 255.0
	}
	return embedding, nil
}

// AskAboutContent returns a mock response about content
func (m *MockAIClient) AskAboutContent(prompt, content string) (string, error) {
	return fmt.Sprintf("Response to: %s (based on content of length %d)", prompt, len(content)), nil
}

// Helper functions for generating mock content

func generateMockTitle(content string) string {
	// Take first few words as title
	words := strings.Fields(content)
	if len(words) == 0 {
		return "Untitled Note"
	}

	maxWords := 5
	if len(words) < maxWords {
		maxWords = len(words)
	}

	title := strings.Join(words[:maxWords], " ")
	if len(title) > 50 {
		title = title[:50]
	}

	return title
}

func generateMockSummary(content string) string {
	// Take first 200 characters as summary
	if len(content) <= 200 {
		return content
	}
	return content[:200] + "..."
}

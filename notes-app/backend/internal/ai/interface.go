package ai

import "backend/internal/models"

// Client defines the interface for AI operations
// This allows for mocking in tests
type Client interface {
	// Close closes the underlying client connection
	Close() error

	// Generation methods
	AnalyzeNote(content string, includeSummary bool) (*models.NoteAnalysis, error)
	ClassifyNote(title, content string) (string, error)
	GenerateTitle(content string) (string, error)
	GenerateSummary(content string) (string, error)
	GenerateSummaryWithPrompt(content string, customPrompt string) (string, error)
	GenerateStructuredSummary(content, promptText, promptSchema string) (string, map[string]interface{}, error)
	GenerateAnswer(question, contextText string) (string, error)
	AskAboutContent(prompt, content string) (string, error)

	// Embedding methods
	GenerateEmbedding(text string) ([]float32, error)
}

// Ensure AIClient implements Client interface
var _ Client = (*AIClient)(nil)

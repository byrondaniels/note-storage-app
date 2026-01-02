package ai

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/google/generative-ai-go/genai"
	"google.golang.org/api/option"

	"backend/internal/utils"
)

// AIClient wraps the Gemini generative AI client with helper methods
type AIClient struct {
	client *genai.Client
}

// NewAIClient creates a new AI client with the provided API key
func NewAIClient(ctx context.Context, apiKey string) (*AIClient, error) {
	client, err := genai.NewClient(ctx, option.WithAPIKey(apiKey))
	if err != nil {
		return nil, fmt.Errorf("failed to create Gemini client: %w", err)
	}

	return &AIClient{client: client}, nil
}

// Close closes the underlying client connection
func (c *AIClient) Close() error {
	return c.client.Close()
}

// GenerativeModel returns a generative model by name
func (c *AIClient) GenerativeModel(name string) *genai.GenerativeModel {
	return c.client.GenerativeModel(name)
}

// EmbeddingModel returns an embedding model by name
func (c *AIClient) EmbeddingModel(name string) *genai.EmbeddingModel {
	return c.client.EmbeddingModel(name)
}

// ExtractTextResponse extracts plain text from a Gemini response
// Consolidates the duplicate pattern used throughout the codebase
func ExtractTextResponse(result *genai.GenerateContentResponse) (string, error) {
	if result == nil || len(result.Candidates) == 0 || result.Candidates[0].Content == nil {
		return "", fmt.Errorf("no response generated")
	}

	responseText := strings.TrimSpace(string(result.Candidates[0].Content.Parts[0].(genai.Text)))
	return responseText, nil
}

// ExtractJSONResponse extracts and parses JSON from a Gemini response
// Automatically cleans markdown code blocks before parsing
func ExtractJSONResponse(result *genai.GenerateContentResponse, target interface{}) error {
	if result == nil || len(result.Candidates) == 0 || result.Candidates[0].Content == nil {
		return fmt.Errorf("no response generated")
	}

	responseText := string(result.Candidates[0].Content.Parts[0].(genai.Text))
	responseText = utils.CleanMarkdownCodeBlocks(responseText)

	if err := json.Unmarshal([]byte(responseText), target); err != nil {
		return fmt.Errorf("failed to parse JSON response: %w", err)
	}

	return nil
}

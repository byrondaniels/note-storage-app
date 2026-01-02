package ai

import (
	"context"
	"fmt"

	"github.com/google/generative-ai-go/genai"

	"backend/internal/config"
)

// GenerateEmbedding generates a vector embedding for the given text using the configured embedding model
func (c *AIClient) GenerateEmbedding(text string) ([]float32, error) {
	ctx := context.Background()

	model := c.EmbeddingModel(config.EMBEDDING_MODEL)

	result, err := model.EmbedContent(ctx, genai.Text(text))
	if err != nil {
		return nil, fmt.Errorf("failed to generate embedding: %w", err)
	}

	if result == nil || result.Embedding == nil || len(result.Embedding.Values) == 0 {
		return nil, fmt.Errorf("no embedding returned")
	}

	return result.Embedding.Values, nil
}

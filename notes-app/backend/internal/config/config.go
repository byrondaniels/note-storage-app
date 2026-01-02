package config

import (
	"os"
	"strings"
)

// Database and Vector Store Constants
const (
	COLLECTION_NAME     = "notes_embeddings"
	CHUNK_SIZE          = 1000
	MAX_WORDS           = 10000
	EMBEDDING_DIM       = 768
	MIN_RELEVANCE_SCORE = 0.3 // Filter out results below 30% relevance

	// Gemini AI Model Configuration
	EMBEDDING_MODEL  = "text-embedding-004"    // For generating embeddings
	GENERATION_MODEL = "gemini-2.5-flash-lite" // For text generation and classification
)

// Config holds the application configuration
type Config struct {
	MongoURI     string
	QdrantURL    string
	GeminiAPIKey string
}

// LoadConfig loads configuration from environment variables
func LoadConfig() *Config {
	mongoURI := os.Getenv("MONGO_URI")
	if mongoURI == "" {
		mongoURI = "mongodb://mongo:27017"
	}

	qdrantURL := os.Getenv("QDRANT_URL")
	if qdrantURL == "" {
		qdrantURL = "qdrant:6334" // Use gRPC port
	}

	// Remove http:// prefix for gRPC connection and switch to gRPC port
	if strings.HasPrefix(qdrantURL, "http://") {
		qdrantURL = strings.TrimPrefix(qdrantURL, "http://")
		qdrantURL = strings.Replace(qdrantURL, ":6333", ":6334", 1) // Switch to gRPC port
	}

	geminiAPIKey := os.Getenv("GEMINI_API_KEY")

	return &Config{
		MongoURI:     mongoURI,
		QdrantURL:    qdrantURL,
		GeminiAPIKey: geminiAPIKey,
	}
}

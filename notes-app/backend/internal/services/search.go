package services

import (
	"context"
	"fmt"
	"sort"
	"strings"

	"backend/internal/ai"
	"backend/internal/config"
	"backend/internal/models"
	"backend/internal/repository"
	"backend/internal/vectordb"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// SearchService handles semantic search and Q&A operations
type SearchService struct {
	notesRepo    *repository.NotesRepository
	aiClient     ai.Client
	qdrantClient *vectordb.QdrantClient
}

// NewSearchService creates a new SearchService
func NewSearchService(
	notesRepo *repository.NotesRepository,
	aiClient ai.Client,
	qdrantClient *vectordb.QdrantClient,
) *SearchService {
	return &SearchService{
		notesRepo:    notesRepo,
		aiClient:     aiClient,
		qdrantClient: qdrantClient,
	}
}

// SemanticSearch performs a vector similarity search across notes
func (s *SearchService) SemanticSearch(ctx context.Context, query string, limit int) ([]models.SearchResult, error) {
	if limit <= 0 {
		limit = 10
	}

	queryEmbedding, err := s.aiClient.GenerateEmbedding(query)
	if err != nil {
		return nil, fmt.Errorf("failed to generate embedding for query: %w", err)
	}

	searchResults, err := s.qdrantClient.Search(queryEmbedding, limit*2)
	if err != nil {
		return nil, fmt.Errorf("search failed: %w", err)
	}

	noteScores := make(map[string]float32)
	noteIDs := make(map[string]bool)

	for _, result := range searchResults {
		if existingScore, exists := noteScores[result.NoteID]; !exists || result.Score > existingScore {
			noteScores[result.NoteID] = result.Score
		}
		noteIDs[result.NoteID] = true
	}

	var objectIDs []primitive.ObjectID
	for noteIDStr := range noteIDs {
		if objID, err := primitive.ObjectIDFromHex(noteIDStr); err == nil {
			objectIDs = append(objectIDs, objID)
		}
	}

	if len(objectIDs) == 0 {
		return []models.SearchResult{}, nil
	}

	notes, err := s.notesRepo.FindAll(ctx, bson.M{"_id": bson.M{"$in": objectIDs}})
	if err != nil {
		return nil, fmt.Errorf("failed to fetch notes: %w", err)
	}

	var results []models.SearchResult
	for _, note := range notes {
		score := noteScores[note.ID.Hex()]

		// Only include results above the minimum relevance threshold
		if score >= config.MIN_RELEVANCE_SCORE {
			results = append(results, models.SearchResult{
				Note:  note,
				Score: score,
			})
		}
	}

	// Sort results by score in descending order (highest relevance first)
	sort.Slice(results, func(i, j int) bool {
		return results[i].Score > results[j].Score
	})

	// Apply limit after filtering and sorting
	if len(results) > limit {
		results = results[:limit]
	}

	return results, nil
}

// AnswerQuestion answers a question using relevant notes as context
func (s *SearchService) AnswerQuestion(ctx context.Context, question string) (*models.QuestionResponse, error) {
	// Step 1: Search for relevant notes using semantic search
	queryEmbedding, err := s.aiClient.GenerateEmbedding(question)
	if err != nil {
		return nil, fmt.Errorf("failed to generate embedding for question: %w", err)
	}

	searchResults, err := s.qdrantClient.Search(queryEmbedding, 5) // Get top 5 most relevant notes
	if err != nil {
		return nil, fmt.Errorf("search failed: %w", err)
	}

	// Step 2: Get relevant notes and prepare context
	var relevantNotes []models.SearchResult
	var contextText strings.Builder
	noteIDs := make(map[string]bool)

	for _, result := range searchResults {
		// Only include highly relevant notes (higher threshold for Q&A)
		if result.Score >= 0.4 && !noteIDs[result.NoteID] {
			if objID, err := primitive.ObjectIDFromHex(result.NoteID); err == nil {
				note, err := s.notesRepo.FindByID(ctx, objID)
				if err == nil {
					relevantNotes = append(relevantNotes, models.SearchResult{
						Note:  *note,
						Score: result.Score,
					})

					// Add to context with clear delineation
					contextText.WriteString(fmt.Sprintf("Title: %s\nContent: %s\n\n", note.Title, note.Content))
					noteIDs[result.NoteID] = true
				}
			}
		}
	}

	if len(relevantNotes) == 0 {
		return &models.QuestionResponse{
			Answer:   "I couldn't find any relevant information in your notes to answer that question.",
			Sources:  []models.SearchResult{},
			Question: question,
		}, nil
	}

	// Step 3: Generate answer using relevant context
	answer, err := s.aiClient.GenerateAnswer(question, contextText.String())
	if err != nil {
		return nil, fmt.Errorf("failed to generate answer: %w", err)
	}

	return &models.QuestionResponse{
		Answer:   answer,
		Sources:  relevantNotes,
		Question: question,
	}, nil
}

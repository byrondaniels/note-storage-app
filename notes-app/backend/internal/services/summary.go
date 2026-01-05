package services

import (
	"context"
	"fmt"
	"log"
	"time"

	"backend/internal/ai"
	"backend/internal/models"
	"backend/internal/repository"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// SummaryService handles summary generation operations
type SummaryService struct {
	notesRepo           *repository.NotesRepository
	channelSettingsRepo *repository.ChannelSettingsRepository
	aiClient            ai.Client
}

// NewSummaryService creates a new SummaryService
func NewSummaryService(
	notesRepo *repository.NotesRepository,
	channelSettingsRepo *repository.ChannelSettingsRepository,
	aiClient ai.Client,
) *SummaryService {
	return &SummaryService{
		notesRepo:           notesRepo,
		channelSettingsRepo: channelSettingsRepo,
		aiClient:            aiClient,
	}
}

// GenerateSummaryRequest holds parameters for summary generation
type GenerateSummaryRequest struct {
	NoteID       string
	Content      string
	PromptText   string
	PromptSchema string
}

// GenerateSummary generates a summary for a note, using channel settings if available
func (s *SummaryService) GenerateSummary(ctx context.Context, req *GenerateSummaryRequest) (*models.SummarizeResponse, error) {
	// Convert note ID from string to ObjectID
	objID, err := primitive.ObjectIDFromHex(req.NoteID)
	if err != nil {
		return nil, fmt.Errorf("invalid note ID: %w", err)
	}

	// Look up the note to get channel/author info
	note, err := s.notesRepo.FindByID(ctx, objID)
	if err != nil {
		return nil, fmt.Errorf("note not found: %w", err)
	}

	// Check for custom prompt and schema based on channel
	promptText := req.PromptText
	promptSchema := req.PromptSchema

	if promptText == "" && promptSchema == "" && note.Metadata != nil {
		if author, ok := note.Metadata["author"].(string); ok && author != "" {
			settings, _ := s.channelSettingsRepo.FindByName(ctx, author)
			if settings != nil {
				promptText = settings.PromptText
				promptSchema = settings.PromptSchema
			}
		}
	}

	// Generate structured summary using Gemini
	summary, structuredData, err := s.aiClient.GenerateStructuredSummary(req.Content, promptText, promptSchema)
	if err != nil {
		return nil, fmt.Errorf("failed to generate summary: %w", err)
	}

	// Update the note in the database with summary, structured data, and last summarized timestamp
	updateFields := bson.M{
		"summary":            summary,
		"last_summarized_at": time.Now(),
	}
	if structuredData != nil {
		updateFields["structured_data"] = structuredData
	}

	err = s.notesRepo.Update(ctx, objID, bson.M{"$set": updateFields})
	if err != nil {
		return nil, fmt.Errorf("failed to save summary: %w", err)
	}

	return &models.SummarizeResponse{
		Summary:        summary,
		StructuredData: structuredData,
	}, nil
}

// GenerateSummaryByID generates a summary for a note using its stored content
func (s *SummaryService) GenerateSummaryByID(ctx context.Context, noteID string, promptText, promptSchema string) (*models.SummarizeResponse, error) {
	// Convert note ID from string to ObjectID
	objID, err := primitive.ObjectIDFromHex(noteID)
	if err != nil {
		return nil, fmt.Errorf("invalid note ID: %w", err)
	}

	// Look up the note
	note, err := s.notesRepo.FindByID(ctx, objID)
	if err != nil {
		return nil, fmt.Errorf("note not found: %w", err)
	}

	// If no override provided, check channel settings
	if promptText == "" && promptSchema == "" && note.Metadata != nil {
		if author, ok := note.Metadata["author"].(string); ok && author != "" {
			settings, _ := s.channelSettingsRepo.FindByName(ctx, author)
			if settings != nil {
				promptText = settings.PromptText
				promptSchema = settings.PromptSchema
				if promptText != "" || promptSchema != "" {
					log.Printf("Using custom prompt/schema for channel %s", author)
				}
			}
		}
	}

	// Generate structured summary using Gemini with the note's content
	summary, structuredData, err := s.aiClient.GenerateStructuredSummary(note.Content, promptText, promptSchema)
	if err != nil {
		log.Printf("Failed to generate summary: %v", err)
		return nil, fmt.Errorf("failed to generate summary: %w", err)
	}

	// Update the note in the database with summary, structured data, and last summarized timestamp
	updateFields := bson.M{
		"summary":            summary,
		"last_summarized_at": time.Now(),
	}
	if structuredData != nil {
		updateFields["structured_data"] = structuredData
	}

	err = s.notesRepo.Update(ctx, objID, bson.M{"$set": updateFields})
	if err != nil {
		return nil, fmt.Errorf("failed to save summary: %w", err)
	}

	return &models.SummarizeResponse{
		Summary:        summary,
		StructuredData: structuredData,
	}, nil
}

// RegenerateTitlesResult holds the result of regenerating titles
type RegenerateTitlesResult struct {
	Regenerated int
	Errors      int
	Total       int
}

// RegenerateAllTitles regenerates titles for all notes
func (s *SummaryService) RegenerateAllTitles(ctx context.Context) (*RegenerateTitlesResult, error) {
	// Find all notes
	notes, err := s.notesRepo.FindAll(ctx, bson.M{})
	if err != nil {
		return nil, fmt.Errorf("failed to find notes: %w", err)
	}

	result := &RegenerateTitlesResult{
		Total: len(notes),
	}

	for _, note := range notes {
		newTitle, err := s.aiClient.GenerateTitle(note.Content)
		if err != nil {
			log.Printf("Failed to generate title for note %s: %v", note.ID.Hex(), err)
			result.Errors++
			continue
		}

		err = s.notesRepo.Update(
			ctx,
			note.ID,
			bson.M{"$set": bson.M{"title": newTitle}},
		)
		if err != nil {
			log.Printf("Failed to update title for note %s: %v", note.ID.Hex(), err)
			result.Errors++
		} else {
			result.Regenerated++
			log.Printf("Updated title for note %s: %s -> %s", note.ID.Hex(), note.Title, newTitle)
		}
	}

	return result, nil
}

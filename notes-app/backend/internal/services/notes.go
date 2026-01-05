package services

import (
	"context"
	"fmt"
	"log"
	"time"

	"backend/internal/ai"
	"backend/internal/models"
	"backend/internal/repository"
	"backend/internal/vectordb"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

// NotesService handles business logic for note operations
type NotesService struct {
	notesRepo           *repository.NotesRepository
	chunksRepo          *repository.ChunksRepository
	channelSettingsRepo *repository.ChannelSettingsRepository
	aiClient            ai.Client
	qdrantClient        *vectordb.QdrantClient
	workerPool          *WorkerPool
}

// NewNotesService creates a new NotesService
func NewNotesService(
	notesRepo *repository.NotesRepository,
	chunksRepo *repository.ChunksRepository,
	channelSettingsRepo *repository.ChannelSettingsRepository,
	aiClient ai.Client,
	qdrantClient *vectordb.QdrantClient,
	workerPool *WorkerPool,
) *NotesService {
	return &NotesService{
		notesRepo:           notesRepo,
		chunksRepo:          chunksRepo,
		channelSettingsRepo: channelSettingsRepo,
		aiClient:            aiClient,
		qdrantClient:        qdrantClient,
		workerPool:          workerPool,
	}
}

// GetNotes retrieves notes with optional channel filter
func (s *NotesService) GetNotes(ctx context.Context, channel string) ([]models.Note, error) {
	filter := bson.M{}
	if channel != "" {
		filter["metadata.author"] = channel
	}
	return s.notesRepo.FindAll(ctx, filter)
}

// CreateNoteResult holds the result of creating a note
type CreateNoteResult struct {
	Note      *models.Note
	Duplicate bool
	URL       string
}

// CreateNote creates a new note with AI analysis and queues embedding generation
func (s *NotesService) CreateNote(ctx context.Context, req *models.CreateNoteRequest) (*CreateNoteResult, error) {
	log.Printf("=== CREATE NOTE SERVICE CALLED ===")
	log.Printf("Request parsed: Content length=%d, Metadata=%+v", len(req.Content), req.Metadata)

	// Initialize metadata if nil
	metadata := req.Metadata
	if metadata == nil {
		metadata = make(map[string]interface{})
	}

	// Check if this is YouTube content (needs summary)
	isYouTube := false
	if platform, exists := metadata["platform"]; exists {
		if platformStr, ok := platform.(string); ok && platformStr == "youtube" {
			isYouTube = true
		}
	}

	// Check for custom prompt settings based on author/channel
	var customPromptText, customPromptSchema string
	if author, ok := metadata["author"].(string); ok && author != "" {
		settings, err := s.channelSettingsRepo.FindByName(ctx, author)
		if err == nil && settings != nil && (settings.PromptText != "" || settings.PromptSchema != "") {
			customPromptText = settings.PromptText
			customPromptSchema = settings.PromptSchema
			log.Printf("Found custom prompt for channel '%s' during note creation", author)
		}
	}

	// Use combined analysis if title not provided (single API call for title + category + optional summary)
	var title, category, summary string
	var structuredData map[string]interface{}

	if req.Title == "" {
		// Always get title and category from analyzeNote
		// Only get summary from analyzeNote if no custom prompt exists
		useDefaultSummary := customPromptText == "" && customPromptSchema == ""
		analysis, err := s.aiClient.AnalyzeNote(req.Content, isYouTube && useDefaultSummary)
		if err != nil {
			log.Printf("Failed to analyze note: %v", err)
			title = "Untitled Note"
			category = "other"
		} else {
			title = analysis.Title
			category = analysis.Category
			if useDefaultSummary {
				summary = analysis.Summary
			}
			log.Printf("Note analyzed - Title: %s, Category: %s, Summary length: %d", title, category, len(summary))
		}
	} else {
		title = req.Title
		// If title is provided, we still need category - do a quick analysis
		useDefaultSummary := customPromptText == "" && customPromptSchema == ""
		analysis, err := s.aiClient.AnalyzeNote(req.Content, isYouTube && useDefaultSummary)
		if err != nil {
			log.Printf("Failed to analyze note for category: %v", err)
			category = "other"
		} else {
			category = analysis.Category
			if useDefaultSummary {
				summary = analysis.Summary
			}
		}
	}

	// If custom prompt exists, generate structured summary with it
	if customPromptText != "" || customPromptSchema != "" {
		log.Printf("Generating summary with custom prompt for new note")
		customSummary, customStructuredData, err := s.aiClient.GenerateStructuredSummary(req.Content, customPromptText, customPromptSchema)
		if err != nil {
			log.Printf("Failed to generate custom summary: %v", err)
			// Fall back to default summary if custom fails
		} else {
			summary = customSummary
			structuredData = customStructuredData
			log.Printf("Custom summary generated, length: %d, has structured data: %v", len(summary), structuredData != nil)
		}
	}

	// Parse SourcePublishedAt from metadata.timestamp if available
	var sourcePublishedAt *time.Time
	if ts, ok := metadata["timestamp"].(string); ok && ts != "" {
		if parsed, err := time.Parse(time.RFC3339, ts); err == nil {
			sourcePublishedAt = &parsed
		} else {
			log.Printf("Failed to parse timestamp '%s': %v", ts, err)
		}
	}

	// Set LastSummarizedAt if we generated a summary
	var lastSummarizedAt *time.Time
	if summary != "" {
		now := time.Now()
		lastSummarizedAt = &now
	}

	note := models.Note{
		Title:             title,
		Content:           req.Content,
		Category:          category,
		Summary:           summary,
		StructuredData:    structuredData,
		Created:           time.Now(),
		SourcePublishedAt: sourcePublishedAt,
		LastSummarizedAt:  lastSummarizedAt,
		Metadata:          metadata,
	}

	// Check for duplicate URL before inserting
	if urlVal, ok := metadata["url"].(string); ok && urlVal != "" {
		exists, err := s.notesRepo.ExistsByURL(ctx, urlVal)
		if err != nil {
			log.Printf("Error checking for duplicate URL: %v", err)
		} else if exists {
			log.Printf("Duplicate note detected for URL: %s", urlVal)
			return &CreateNoteResult{
				Duplicate: true,
				URL:       urlVal,
			}, nil
		}
	}

	noteID, err := s.notesRepo.Create(ctx, &note)
	if err != nil {
		return nil, fmt.Errorf("failed to create note: %w", err)
	}

	note.ID = noteID

	// Queue job for embedding generation only (title, category, summary already done)
	s.workerPool.Submit(models.ProcessingJob{
		NoteID:   note.ID,
		Title:    note.Title,
		Content:  note.Content,
		Metadata: note.Metadata,
	})

	return &CreateNoteResult{
		Note:      &note,
		Duplicate: false,
	}, nil
}

// UpdateNote updates a note's content and regenerates title and embeddings
func (s *NotesService) UpdateNote(ctx context.Context, noteID string, req *models.UpdateNoteRequest) (*models.Note, error) {
	objID, err := primitive.ObjectIDFromHex(noteID)
	if err != nil {
		return nil, fmt.Errorf("invalid note ID: %w", err)
	}

	// Find the existing note first
	_, err = s.notesRepo.FindByID(ctx, objID)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return nil, fmt.Errorf("note not found")
		}
		return nil, fmt.Errorf("failed to find note: %w", err)
	}

	// Generate new title from content
	newTitle, err := s.aiClient.GenerateTitle(req.Content)
	if err != nil {
		log.Printf("Failed to generate title for updated note: %v", err)
		newTitle = "Updated Note" // fallback
	}

	// Update the note
	update := bson.M{
		"$set": bson.M{
			"title":   newTitle,
			"content": req.Content,
		},
	}

	err = s.notesRepo.Update(ctx, objID, update)
	if err != nil {
		return nil, fmt.Errorf("failed to update note: %w", err)
	}

	// Get the updated note
	updatedNote, err := s.notesRepo.FindByID(ctx, objID)
	if err != nil {
		return nil, fmt.Errorf("failed to retrieve updated note: %w", err)
	}

	// Queue re-processing job for embeddings
	s.workerPool.Submit(models.ProcessingJob{
		NoteID:   updatedNote.ID,
		Title:    updatedNote.Title,
		Content:  updatedNote.Content,
		Metadata: updatedNote.Metadata,
	})

	return updatedNote, nil
}

// DeleteNote removes a note and its associated chunks and embeddings
func (s *NotesService) DeleteNote(ctx context.Context, noteID string) error {
	objID, err := primitive.ObjectIDFromHex(noteID)
	if err != nil {
		return fmt.Errorf("invalid note ID: %w", err)
	}

	// Check if note exists
	_, err = s.notesRepo.FindByID(ctx, objID)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return fmt.Errorf("note not found")
		}
		return fmt.Errorf("failed to find note: %w", err)
	}

	// Delete note from MongoDB
	err = s.notesRepo.Delete(ctx, objID)
	if err != nil {
		return fmt.Errorf("failed to delete note: %w", err)
	}

	// Delete associated chunks from MongoDB
	_, err = s.chunksRepo.DeleteByNoteID(ctx, objID)
	if err != nil {
		log.Printf("Failed to delete chunks for note %s: %v", noteID, err)
		// Don't fail the request, just log the error
	}

	// Delete embeddings from Qdrant
	_, err = s.qdrantClient.DeleteByNoteID(objID)
	if err != nil {
		log.Printf("Failed to delete embeddings for note %s: %v", noteID, err)
		// Don't fail the request, just log the error
	}

	return nil
}

// GetNoteByID retrieves a single note by ID
func (s *NotesService) GetNoteByID(ctx context.Context, noteID string) (*models.Note, error) {
	objID, err := primitive.ObjectIDFromHex(noteID)
	if err != nil {
		return nil, fmt.Errorf("invalid note ID: %w", err)
	}

	note, err := s.notesRepo.FindByID(ctx, objID)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return nil, fmt.Errorf("note not found")
		}
		return nil, fmt.Errorf("failed to find note: %w", err)
	}

	return note, nil
}

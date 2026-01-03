package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"regexp"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/google/generative-ai-go/genai"
	pb "github.com/qdrant/go-client/qdrant"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"

	"backend/internal/ai"
	"backend/internal/config"
	"backend/internal/models"
	"backend/internal/repository"
	"backend/internal/utils"
)

var (
	mongoClient       *repository.MongoClient
	notesRepo         *repository.NotesRepository
	collectionsClient pb.CollectionsClient
	pointsClient      pb.PointsClient
	aiClient          *ai.AIClient
	jobQueue          chan models.ProcessingJob
	wg                sync.WaitGroup
)

func main() {
	cfg := config.LoadConfig()
	if cfg.GeminiAPIKey == "" {
		log.Fatal("GEMINI_API_KEY environment variable is required")
	}

	var err error
	mongoClient, err = repository.NewMongoClient(context.TODO(), cfg.MongoURI, "notesdb")
	if err != nil {
		log.Fatal("Failed to connect to MongoDB:", err)
	}
	defer mongoClient.Close(context.TODO())

	notesRepo = repository.NewNotesRepository(mongoClient.GetDatabase())

	conn, err := grpc.Dial(cfg.QdrantURL, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		log.Fatal("Failed to connect to Qdrant:", err)
	}
	defer conn.Close()

	collectionsClient = pb.NewCollectionsClient(conn)
	pointsClient = pb.NewPointsClient(conn)

	aiClient, err = ai.NewAIClient(context.Background(), cfg.GeminiAPIKey)
	if err != nil {
		log.Fatal("Failed to create AI client:", err)
	}
	defer aiClient.Close()

	if err := initializeQdrant(); err != nil {
		log.Fatal("Failed to initialize Qdrant:", err)
	}

	jobQueue = make(chan models.ProcessingJob, 100)

	for i := 0; i < 3; i++ {
		wg.Add(1)
		go processingWorker()
	}

	r := gin.Default()

	r.Use(cors.New(cors.Config{
		AllowAllOrigins:  true,
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Content-Length", "Accept-Encoding", "X-CSRF-Token", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: false,
		MaxAge:           12 * time.Hour,
	}))

	r.GET("/notes", getNotes)
	r.POST("/notes", createNote)
	r.PUT("/notes/:id", updateNote)
	r.DELETE("/notes/:id", deleteNote)
	r.POST("/search", searchNotes)
	r.POST("/ask", answerQuestion)
	r.POST("/ai-question", askAIAboutNote)
	r.POST("/summarize", summarizeNote)
	r.POST("/summarize/:id", summarizeNoteById)
	r.GET("/categories", getCategories)
	r.GET("/notes/category/:category", getNotesByCategory)
	r.GET("/categories/stats", getCategoryStats)
	r.POST("/migrate/classify", classifyExistingNotes)
	r.POST("/migrate/titles", regenerateAllTitles)

	// Channel settings routes
	r.GET("/channels", getChannelsWithNotes)
	r.GET("/channel-settings", getAllChannelSettings)
	r.GET("/channel-settings/:channel", getChannelSettings)
	r.PUT("/channel-settings/:channel", updateChannelSettings)
	r.DELETE("/channel-settings/:channel", deleteChannelSettings)
	r.DELETE("/channels/:channel/notes", deleteChannelNotes)

	log.Println("Server starting on :8080")
	r.Run(":8080")
}

func initializeQdrant() error {
	ctx := context.Background()

	collections, err := collectionsClient.List(ctx, &pb.ListCollectionsRequest{})
	if err != nil {
		return fmt.Errorf("failed to list collections: %w", err)
	}

	collectionExists := false
	for _, collection := range collections.Collections {
		if collection.Name == config.COLLECTION_NAME {
			collectionExists = true
			break
		}
	}

	if !collectionExists {
		log.Printf("Creating Qdrant collection: %s", config.COLLECTION_NAME)
		_, err := collectionsClient.Create(ctx, &pb.CreateCollection{
			CollectionName: config.COLLECTION_NAME,
			VectorsConfig: &pb.VectorsConfig{
				Config: &pb.VectorsConfig_Params{
					Params: &pb.VectorParams{
						Size:     config.EMBEDDING_DIM,
						Distance: pb.Distance_Cosine,
					},
				},
			},
		})
		if err != nil {
			return fmt.Errorf("failed to create collection: %w", err)
		}
	}

	return nil
}

func processingWorker() {
	defer wg.Done()

	for job := range jobQueue {
		if err := processNoteJob(job); err != nil {
			log.Printf("Error processing job for note %s: %v", job.NoteID.Hex(), err)
		}
	}
}

func processNoteJob(job models.ProcessingJob) error {
	// Note: Title, category, and summary are now generated during createNote()
	// This job only handles embedding generation

	fullText := job.Title + "\n\n" + job.Content

	// Skip embedding if sensitive data detected
	if utils.ContainsSensitiveData(fullText) {
		log.Printf("Skipping embedding for note %s: Sensitive data detected (API keys, passwords, etc.)", job.NoteID.Hex())
		return nil // Not an error, just skip embedding for security
	}

	words := strings.Fields(fullText)

	if len(words) > config.MAX_WORDS {
		words = words[:config.MAX_WORDS]
		fullText = strings.Join(words, " ")
	}

	chunks := utils.ChunkText(fullText, config.CHUNK_SIZE)

	for i, chunk := range chunks {
		chunkDoc := models.NoteChunk{
			NoteID:   job.NoteID,
			Content:  chunk,
			ChunkIdx: i,
		}

		result, err := mongoClient.ChunksCollection().InsertOne(context.Background(), chunkDoc)
		if err != nil {
			log.Printf("Error saving chunk: %v", err)
			continue
		}

		chunkID := result.InsertedID.(primitive.ObjectID)

		embedding, err := aiClient.GenerateEmbedding(chunk)
		if err != nil {
			log.Printf("Error generating embedding: %v", err)
			continue
		}

		if err := storeEmbedding(chunkID, job.NoteID, embedding); err != nil {
			log.Printf("Error storing embedding: %v", err)
		}
	}

	return nil
}

func storeEmbedding(chunkID, noteID primitive.ObjectID, embedding []float32) error {
	ctx := context.Background()

	point := &pb.PointStruct{
		Id: &pb.PointId{
			PointIdOptions: &pb.PointId_Num{
				Num: uint64(time.Now().UnixNano()), // Use timestamp as unique ID
			},
		},
		Vectors: &pb.Vectors{
			VectorsOptions: &pb.Vectors_Vector{
				Vector: &pb.Vector{Data: embedding},
			},
		},
		Payload: map[string]*pb.Value{
			"chunk_id": {Kind: &pb.Value_StringValue{StringValue: chunkID.Hex()}},
			"note_id":  {Kind: &pb.Value_StringValue{StringValue: noteID.Hex()}},
		},
	}

	_, err := pointsClient.Upsert(ctx, &pb.UpsertPoints{
		CollectionName: config.COLLECTION_NAME,
		Points:         []*pb.PointStruct{point},
	})

	return err
}

func getNotes(c *gin.Context) {
	// Build filter based on query params
	filter := bson.M{}

	// Filter by channel (author) if provided
	if channel := c.Query("channel"); channel != "" {
		filter["metadata.author"] = channel
	}

	notes, err := notesRepo.FindAll(context.TODO(), filter)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, notes)
}

func createNote(c *gin.Context) {
	log.Printf("=== CREATE NOTE FUNCTION CALLED ===")

	var req models.CreateNoteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		log.Printf("JSON binding error: %v", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

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
		var settings models.ChannelSettings
		err := mongoClient.ChannelSettingsCollection().FindOne(
			context.Background(),
			bson.M{"channel_name": author},
		).Decode(&settings)

		if err == nil && (settings.PromptText != "" || settings.PromptSchema != "") {
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
		analysis, err := aiClient.AnalyzeNote(req.Content, isYouTube && useDefaultSummary)
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
		analysis, err := aiClient.AnalyzeNote(req.Content, isYouTube && useDefaultSummary)
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
		customSummary, customStructuredData, err := aiClient.GenerateStructuredSummary(req.Content, customPromptText, customPromptSchema)
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
		exists, err := notesRepo.ExistsByURL(context.Background(), urlVal)
		if err != nil {
			log.Printf("Error checking for duplicate URL: %v", err)
		} else if exists {
			log.Printf("Duplicate note detected for URL: %s", urlVal)
			c.JSON(http.StatusConflict, gin.H{"error": "duplicate", "url": urlVal})
			return
		}
	}

	noteID, err := notesRepo.Create(context.TODO(), &note)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	note.ID = noteID

	// Queue job for embedding generation only (title, category, summary already done)
	job := models.ProcessingJob{
		NoteID:   note.ID,
		Title:    note.Title,
		Content:  note.Content,
		Metadata: note.Metadata,
	}

	select {
	case jobQueue <- job:
		log.Printf("Queued embedding job for note: %s", note.ID.Hex())
	default:
		log.Printf("Job queue full, skipping embedding for note: %s", note.ID.Hex())
	}

	c.JSON(http.StatusCreated, note)
}

func updateNote(c *gin.Context) {
	noteID := c.Param("id")

	objID, err := primitive.ObjectIDFromHex(noteID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid note ID"})
		return
	}

	var req models.UpdateNoteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Find the existing note first
	_, err = notesRepo.FindByID(context.Background(), objID)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			c.JSON(http.StatusNotFound, gin.H{"error": "Note not found"})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to find note"})
		}
		return
	}

	// Generate new title from content
	newTitle, err := aiClient.GenerateTitle(req.Content)
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

	err = notesRepo.Update(context.Background(), objID, update)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update note"})
		return
	}

	// Get the updated note
	updatedNote, err := notesRepo.FindByID(context.Background(), objID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve updated note"})
		return
	}

	// Queue re-processing job for embeddings and classification
	job := models.ProcessingJob{
		NoteID:   updatedNote.ID,
		Title:    updatedNote.Title,
		Content:  updatedNote.Content,
		Metadata: updatedNote.Metadata,
	}

	select {
	case jobQueue <- job:
		log.Printf("Queued re-processing job for updated note: %s", updatedNote.ID.Hex())
	default:
		log.Printf("Job queue full, skipping re-processing for updated note: %s", updatedNote.ID.Hex())
	}

	c.JSON(http.StatusOK, *updatedNote)
}

func deleteNote(c *gin.Context) {
	noteID := c.Param("id")

	objID, err := primitive.ObjectIDFromHex(noteID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid note ID"})
		return
	}

	// Check if note exists
	_, err = notesRepo.FindByID(context.Background(), objID)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			c.JSON(http.StatusNotFound, gin.H{"error": "Note not found"})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to find note"})
		}
		return
	}

	// Delete note from MongoDB
	err = notesRepo.Delete(context.Background(), objID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete note"})
		return
	}

	// Delete associated chunks from MongoDB
	_, err = mongoClient.ChunksCollection().DeleteMany(context.Background(), bson.M{"note_id": objID})
	if err != nil {
		log.Printf("Failed to delete chunks for note %s: %v", noteID, err)
		// Don't fail the request, just log the error
	}

	// TODO: Delete embeddings from Qdrant (would require additional logic to find points by note_id)
	// For now, we'll leave the embeddings as they won't match any existing notes

	c.JSON(http.StatusOK, gin.H{"message": "Note deleted successfully"})
}

func searchNotes(c *gin.Context) {
	var req models.SearchRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.Limit <= 0 {
		req.Limit = 10
	}

	queryEmbedding, err := aiClient.GenerateEmbedding(req.Query)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate embedding for query"})
		return
	}

	searchResult, err := pointsClient.Search(context.Background(), &pb.SearchPoints{
		CollectionName: config.COLLECTION_NAME,
		Vector:         queryEmbedding,
		Limit:          uint64(req.Limit * 2),
		WithPayload:    &pb.WithPayloadSelector{SelectorOptions: &pb.WithPayloadSelector_Enable{Enable: true}},
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Search failed"})
		return
	}

	noteScores := make(map[string]float32)
	noteIDs := make(map[string]bool)

	for _, point := range searchResult.Result {
		noteIDStr := point.Payload["note_id"].GetStringValue()
		score := point.Score

		if existingScore, exists := noteScores[noteIDStr]; !exists || score > existingScore {
			noteScores[noteIDStr] = score
		}
		noteIDs[noteIDStr] = true
	}

	var objectIDs []primitive.ObjectID
	for noteIDStr := range noteIDs {
		if objID, err := primitive.ObjectIDFromHex(noteIDStr); err == nil {
			objectIDs = append(objectIDs, objID)
		}
	}

	if len(objectIDs) == 0 {
		c.JSON(http.StatusOK, []models.SearchResult{})
		return
	}

	notes, err := notesRepo.FindAll(context.Background(), bson.M{"_id": bson.M{"$in": objectIDs}})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch notes"})
		return
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
	if len(results) > req.Limit {
		results = results[:req.Limit]
	}

	c.JSON(http.StatusOK, results)
}

func getCategories(c *gin.Context) {
	pipeline := mongo.Pipeline{
		{{Key: "$group", Value: bson.M{
			"_id":   "$category",
			"count": bson.M{"$sum": 1},
		}}},
		{{Key: "$sort", Value: bson.M{"count": -1}}},
	}

	cursor, err := notesRepo.Aggregate(context.Background(), pipeline)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to aggregate categories"})
		return
	}
	defer cursor.Close(context.Background())

	var results []models.CategoryCount
	for cursor.Next(context.Background()) {
		var result struct {
			ID    string `bson:"_id"`
			Count int    `bson:"count"`
		}
		if err := cursor.Decode(&result); err != nil {
			continue
		}

		// Skip empty categories
		if result.ID != "" {
			results = append(results, models.CategoryCount{
				Name:  result.ID,
				Count: result.Count,
			})
		}
	}

	// Add categories with 0 notes
	existingCategories := make(map[string]bool)
	for _, result := range results {
		existingCategories[result.Name] = true
	}

	for _, category := range config.CATEGORIES {
		if !existingCategories[category] {
			results = append(results, models.CategoryCount{
				Name:  category,
				Count: 0,
			})
		}
	}

	c.JSON(http.StatusOK, results)
}

func getNotesByCategory(c *gin.Context) {
	category := c.Param("category")

	// Validate category
	if !config.IsValidCategory(category) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid category"})
		return
	}

	notes, err := notesRepo.FindByCategory(context.Background(), category)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch notes"})
		return
	}

	c.JSON(http.StatusOK, notes)
}

func getCategoryStats(c *gin.Context) {
	pipeline := mongo.Pipeline{
		{{Key: "$group", Value: bson.M{
			"_id":   "$category",
			"count": bson.M{"$sum": 1},
		}}},
		{{Key: "$sort", Value: bson.M{"count": -1}}},
	}

	cursor, err := notesRepo.Aggregate(context.Background(), pipeline)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get category stats"})
		return
	}
	defer cursor.Close(context.Background())

	var categoryStats []models.CategoryCount
	totalNotes := 0

	for cursor.Next(context.Background()) {
		var result struct {
			ID    string `bson:"_id"`
			Count int    `bson:"count"`
		}
		if err := cursor.Decode(&result); err != nil {
			continue
		}

		if result.ID != "" {
			categoryStats = append(categoryStats, models.CategoryCount{
				Name:  result.ID,
				Count: result.Count,
			})
			totalNotes += result.Count
		}
	}

	response := gin.H{
		"categories":       categoryStats,
		"total_notes":      totalNotes,
		"total_categories": len(config.CATEGORIES),
	}

	c.JSON(http.StatusOK, response)
}

func classifyExistingNotes(c *gin.Context) {
	// Find notes without category or with empty category
	notes, err := notesRepo.FindAll(context.Background(), bson.M{
		"$or": []bson.M{
			{"category": bson.M{"$exists": false}},
			{"category": ""},
		},
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to find notes"})
		return
	}

	classified := 0
	errors := 0

	for _, note := range notes {
		category, err := aiClient.ClassifyNote(note.Title, note.Content)
		if err != nil {
			log.Printf("Failed to classify note %s: %v", note.ID.Hex(), err)
			category = "other"
			errors++
		}

		err = notesRepo.Update(
			context.Background(),
			note.ID,
			bson.M{"$set": bson.M{"category": category}},
		)
		if err != nil {
			log.Printf("Failed to update note %s with category: %v", note.ID.Hex(), err)
			errors++
		} else {
			classified++
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"message":    "Classification complete",
		"classified": classified,
		"errors":     errors,
		"total":      len(notes),
	})
}

func answerQuestion(c *gin.Context) {
	var req models.QuestionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Step 1: Search for relevant notes using semantic search
	queryEmbedding, err := aiClient.GenerateEmbedding(req.Question)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate embedding for question"})
		return
	}

	searchResult, err := pointsClient.Search(context.Background(), &pb.SearchPoints{
		CollectionName: config.COLLECTION_NAME,
		Vector:         queryEmbedding,
		Limit:          uint64(5), // Get top 5 most relevant notes
		WithPayload:    &pb.WithPayloadSelector{SelectorOptions: &pb.WithPayloadSelector_Enable{Enable: true}},
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Search failed"})
		return
	}

	// Step 2: Get relevant notes and prepare context
	var relevantNotes []models.SearchResult
	var contextText strings.Builder
	noteIDs := make(map[string]bool)

	for _, point := range searchResult.Result {
		noteIDStr := point.Payload["note_id"].GetStringValue()
		score := point.Score

		// Only include highly relevant notes (higher threshold for Q&A)
		if score >= 0.4 && !noteIDs[noteIDStr] {
			if objID, err := primitive.ObjectIDFromHex(noteIDStr); err == nil {
				note, err := notesRepo.FindByID(context.Background(), objID)
				if err == nil {
					relevantNotes = append(relevantNotes, models.SearchResult{
						Note:  *note,
						Score: score,
					})

					// Add to context with clear delineation
					contextText.WriteString(fmt.Sprintf("Title: %s\nContent: %s\n\n", note.Title, note.Content))
					noteIDs[noteIDStr] = true
				}
			}
		}
	}

	if len(relevantNotes) == 0 {
		c.JSON(http.StatusOK, models.QuestionResponse{
			Answer:   "I couldn't find any relevant information in your notes to answer that question.",
			Sources:  []models.SearchResult{},
			Question: req.Question,
		})
		return
	}

	// Step 3: Generate answer using relevant context
	answer, err := aiClient.GenerateAnswer(req.Question, contextText.String())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate answer"})
		return
	}

	c.JSON(http.StatusOK, models.QuestionResponse{
		Answer:   answer,
		Sources:  relevantNotes,
		Question: req.Question,
	})
}

func askAIAboutNote(c *gin.Context) {
	var req models.AIQuestionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Create a combined prompt with the user's question and the note content
	fullPrompt := fmt.Sprintf(`%s

Content to analyze:
%s`, req.Prompt, req.Content)

	// Use Gemini to generate a response
	ctx := context.Background()
	model := aiClient.GenerativeModel(config.GENERATION_MODEL)
	result, err := model.GenerateContent(ctx, genai.Text(fullPrompt))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate AI response"})
		return
	}

	response, err := ai.ExtractTextResponse(result)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to extract AI response"})
		return
	}

	c.JSON(http.StatusOK, models.AIQuestionResponse{
		Response: response,
	})
}

func summarizeNote(c *gin.Context) {
	var req models.SummarizeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Convert note ID from string to ObjectID
	objID, err := primitive.ObjectIDFromHex(req.NoteId)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid note ID"})
		return
	}

	// Look up the note to get channel/author info
	note, err := notesRepo.FindByID(context.Background(), objID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Note not found"})
		return
	}

	// Check for custom prompt and schema based on channel
	var promptText, promptSchema string
	if note.Metadata != nil {
		if author, ok := note.Metadata["author"].(string); ok && author != "" {
			var settings models.ChannelSettings
			err = mongoClient.ChannelSettingsCollection().FindOne(
				context.Background(),
				bson.M{"channel_name": author},
			).Decode(&settings)

			if err == nil {
				promptText = settings.PromptText
				promptSchema = settings.PromptSchema
			}
		}
	}

	// Generate structured summary using Gemini
	summary, structuredData, err := aiClient.GenerateStructuredSummary(req.Content, promptText, promptSchema)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate summary"})
		return
	}

	// Update the note in the database with summary, structured data, and last summarized timestamp
	updateFields := bson.M{
		"summary":            summary,
		"last_summarized_at": time.Now(),
	}
	if structuredData != nil {
		updateFields["structured_data"] = structuredData
	}

	err = notesRepo.Update(context.Background(), objID, bson.M{"$set": updateFields})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save summary"})
		return
	}

	c.JSON(http.StatusOK, models.SummarizeResponse{
		Summary:        summary,
		StructuredData: structuredData,
	})
}

// summarizeNoteById takes noteId from URL path and uses the note's content from DB
func summarizeNoteById(c *gin.Context) {
	noteId := c.Param("id")

	// Convert note ID from string to ObjectID
	objID, err := primitive.ObjectIDFromHex(noteId)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid note ID"})
		return
	}

	// Look up the note
	note, err := notesRepo.FindByID(context.Background(), objID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Note not found"})
		return
	}

	// Parse optional request body for prompt overrides
	var req struct {
		PromptText   string `json:"promptText"`
		PromptSchema string `json:"promptSchema"`
	}
	c.ShouldBindJSON(&req) // Ignore error - body is optional

	// Determine which prompt/schema to use
	promptText := req.PromptText
	promptSchema := req.PromptSchema

	// If no override provided, check channel settings
	if promptText == "" && promptSchema == "" && note.Metadata != nil {
		if author, ok := note.Metadata["author"].(string); ok && author != "" {
			var settings models.ChannelSettings
			err = mongoClient.ChannelSettingsCollection().FindOne(
				context.Background(),
				bson.M{"channel_name": author},
			).Decode(&settings)

			if err == nil {
				promptText = settings.PromptText
				promptSchema = settings.PromptSchema
				if promptText != "" || promptSchema != "" {
					log.Printf("Using custom prompt/schema for channel %s", author)
				}
			}
		}
	}

	// Generate structured summary using Gemini with the note's content
	summary, structuredData, err := aiClient.GenerateStructuredSummary(note.Content, promptText, promptSchema)
	if err != nil {
		log.Printf("Failed to generate summary: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate summary"})
		return
	}

	// Update the note in the database with summary, structured data, and last summarized timestamp
	updateFields := bson.M{
		"summary":            summary,
		"last_summarized_at": time.Now(),
	}
	if structuredData != nil {
		updateFields["structured_data"] = structuredData
	}

	err = notesRepo.Update(context.Background(), objID, bson.M{"$set": updateFields})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save summary"})
		return
	}

	c.JSON(http.StatusOK, models.SummarizeResponse{
		Summary:        summary,
		StructuredData: structuredData,
	})
}

func regenerateAllTitles(c *gin.Context) {
	// Find all notes
	notes, err := notesRepo.FindAll(context.Background(), bson.M{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to find notes"})
		return
	}

	regenerated := 0
	errors := 0

	for _, note := range notes {
		newTitle, err := aiClient.GenerateTitle(note.Content)
		if err != nil {
			log.Printf("Failed to generate title for note %s: %v", note.ID.Hex(), err)
			errors++
			continue
		}

		err = notesRepo.Update(
			context.Background(),
			note.ID,
			bson.M{"$set": bson.M{"title": newTitle}},
		)
		if err != nil {
			log.Printf("Failed to update title for note %s: %v", note.ID.Hex(), err)
			errors++
		} else {
			regenerated++
			log.Printf("Updated title for note %s: %s -> %s", note.ID.Hex(), note.Title, newTitle)
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"message":     "Title regeneration complete",
		"regenerated": regenerated,
		"errors":      errors,
		"total":       len(notes),
	})
}

// Channel Settings Handlers

func getChannelsWithNotes(c *gin.Context) {
	// Aggregate to get unique channels (authors) from notes with their platform
	pipeline := mongo.Pipeline{
		{{Key: "$match", Value: bson.M{"metadata.author": bson.M{"$exists": true, "$ne": ""}}}},
		{{Key: "$group", Value: bson.M{
			"_id":       "$metadata.author",
			"platform":  bson.M{"$first": "$metadata.platform"},
			"noteCount": bson.M{"$sum": 1},
		}}},
		{{Key: "$sort", Value: bson.M{"noteCount": -1}}},
	}

	cursor, err := notesRepo.Aggregate(context.Background(), pipeline)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get channels"})
		return
	}
	defer cursor.Close(context.Background())

	var channels []bson.M
	if err = cursor.All(context.Background(), &channels); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to decode channels"})
		return
	}

	// Transform to cleaner format
	result := make([]gin.H, 0, len(channels))
	for _, ch := range channels {
		result = append(result, gin.H{
			"name":      ch["_id"],
			"platform":  ch["platform"],
			"noteCount": ch["noteCount"],
		})
	}

	c.JSON(http.StatusOK, result)
}

func getAllChannelSettings(c *gin.Context) {
	cursor, err := mongoClient.ChannelSettingsCollection().Find(context.Background(), bson.M{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get channel settings"})
		return
	}
	defer cursor.Close(context.Background())

	var settings []models.ChannelSettings
	if err = cursor.All(context.Background(), &settings); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to decode settings"})
		return
	}

	// Return empty array if no settings
	if settings == nil {
		settings = []models.ChannelSettings{}
	}

	c.JSON(http.StatusOK, settings)
}

func getChannelSettings(c *gin.Context) {
	channelName := c.Param("channel")

	var settings models.ChannelSettings
	err := mongoClient.ChannelSettingsCollection().FindOne(
		context.Background(),
		bson.M{"channel_name": channelName},
	).Decode(&settings)

	if err == mongo.ErrNoDocuments {
		// Return default settings if not found
		c.JSON(http.StatusOK, models.ChannelSettings{
			ChannelName:  channelName,
			ChannelUrl:   "",
			PromptText:   "",
			PromptSchema: "",
		})
		return
	}

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get settings"})
		return
	}

	c.JSON(http.StatusOK, settings)
}

func updateChannelSettings(c *gin.Context) {
	channelName := c.Param("channel")

	var req struct {
		Platform     string `json:"platform"`
		ChannelUrl   string `json:"channelUrl"`
		PromptText   string `json:"promptText"`
		PromptSchema string `json:"promptSchema"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Validate promptSchema is valid JSON if provided
	if req.PromptSchema != "" {
		var js json.RawMessage
		if err := json.Unmarshal([]byte(req.PromptSchema), &js); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid JSON in promptSchema"})
			return
		}
	}

	settings := models.ChannelSettings{
		ChannelName:  channelName,
		Platform:     req.Platform,
		ChannelUrl:   req.ChannelUrl,
		PromptText:   req.PromptText,
		PromptSchema: req.PromptSchema,
		UpdatedAt:    time.Now(),
	}

	// Upsert the settings
	opts := options.Update().SetUpsert(true)
	_, err := mongoClient.ChannelSettingsCollection().UpdateOne(
		context.Background(),
		bson.M{"channel_name": channelName},
		bson.M{"$set": settings},
		opts,
	)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save settings"})
		return
	}

	c.JSON(http.StatusOK, settings)
}

func deleteChannelSettings(c *gin.Context) {
	channelName := c.Param("channel")

	log.Printf("Deleting channel settings for: %s", channelName)

	result, err := mongoClient.ChannelSettingsCollection().DeleteOne(
		context.Background(),
		bson.M{"channel_name": channelName},
	)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete settings"})
		return
	}

	if result.DeletedCount == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Settings not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Settings deleted"})
}

func deleteChannelNotes(c *gin.Context) {
	channelName := c.Param("channel")

	log.Printf("Deleting all notes for channel: %s", channelName)

	// Find all notes for this channel
	notes, err := notesRepo.FindAll(context.Background(), bson.M{"metadata.author": channelName})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to find notes"})
		return
	}

	deletedNotes := 0
	deletedChunks := 0

	// Delete each note and its associated chunks/embeddings
	for _, note := range notes {
		// Delete chunks for this note
		chunkResult, err := mongoClient.ChunksCollection().DeleteMany(
			context.Background(),
			bson.M{"note_id": note.ID},
		)
		if err != nil {
			log.Printf("Error deleting chunks for note %s: %v", note.ID.Hex(), err)
		} else {
			deletedChunks += int(chunkResult.DeletedCount)
		}

		// TODO: Delete embeddings from Qdrant (would need to query by note_id in payload)

		// Delete the note
		err = notesRepo.Delete(context.Background(), note.ID)
		if err != nil {
			log.Printf("Error deleting note %s: %v", note.ID.Hex(), err)
		} else {
			deletedNotes++
		}
	}

	log.Printf("Deleted %d notes and %d chunks for channel: %s", deletedNotes, deletedChunks, channelName)

	c.JSON(http.StatusOK, gin.H{
		"message":       "Channel notes deleted",
		"deletedNotes":  deletedNotes,
		"deletedChunks": deletedChunks,
		"channel":       channelName,
	})
}

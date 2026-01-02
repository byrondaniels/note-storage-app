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
	"google.golang.org/api/option"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
)

type Note struct {
	ID                primitive.ObjectID     `json:"id" bson:"_id,omitempty"`
	Title             string                 `json:"title" bson:"title"`
	Content           string                 `json:"content" bson:"content"`
	Summary           string                 `json:"summary" bson:"summary"`
	StructuredData    map[string]interface{} `json:"structuredData" bson:"structured_data"`
	Category          string                 `json:"category" bson:"category"`
	Created           time.Time              `json:"created" bson:"created"`
	SourcePublishedAt *time.Time             `json:"sourcePublishedAt,omitempty" bson:"source_published_at,omitempty"`
	LastSummarizedAt  *time.Time             `json:"lastSummarizedAt,omitempty" bson:"last_summarized_at,omitempty"`
	Metadata          map[string]interface{} `json:"metadata" bson:"metadata"`
}

type NoteChunk struct {
	ID       primitive.ObjectID `json:"id" bson:"_id,omitempty"`
	NoteID   primitive.ObjectID `json:"note_id" bson:"note_id"`
	Content  string             `json:"content" bson:"content"`
	ChunkIdx int                `json:"chunk_idx" bson:"chunk_idx"`
}

type SearchRequest struct {
	Query string `json:"query" binding:"required"`
	Limit int    `json:"limit,omitempty"`
}

type SearchResult struct {
	Note  Note    `json:"note"`
	Score float32 `json:"score"`
}

type QuestionRequest struct {
	Question string `json:"question" binding:"required"`
}

type QuestionResponse struct {
	Answer     string       `json:"answer"`
	Sources    []SearchResult `json:"sources"`
	Question   string       `json:"question"`
}

type AIQuestionRequest struct {
	Content string `json:"content" binding:"required"`
	Prompt  string `json:"prompt" binding:"required"`
}

type AIQuestionResponse struct {
	Response string `json:"response"`
}

type SummarizeRequest struct {
	NoteId       string `json:"noteId"`
	Content      string `json:"content"`
	CustomPrompt string `json:"customPrompt"` // Optional override
}

type SummarizeResponse struct {
	Summary        string                 `json:"summary"`
	StructuredData map[string]interface{} `json:"structuredData,omitempty"`
}

type ProcessingJob struct {
	NoteID   primitive.ObjectID
	Title    string
	Content  string
	Metadata map[string]interface{}
}

// NoteAnalysis holds the combined AI analysis result
type NoteAnalysis struct {
	Title    string `json:"title"`
	Category string `json:"category"`
	Summary  string `json:"summary"`
}

// ChannelSettings holds per-channel configuration
type ChannelSettings struct {
	ID           primitive.ObjectID `json:"id" bson:"_id,omitempty"`
	ChannelName  string             `json:"channelName" bson:"channel_name"`
	Platform     string             `json:"platform" bson:"platform"`
	ChannelUrl   string             `json:"channelUrl" bson:"channel_url"`     // YouTube channel URL for sync
	PromptText   string             `json:"promptText" bson:"prompt_text"`     // Instructions for the AI
	PromptSchema string             `json:"promptSchema" bson:"prompt_schema"` // Expected JSON output structure
	UpdatedAt    time.Time          `json:"updatedAt" bson:"updated_at"`
}

var (
	notesCollection          *mongo.Collection
	chunksCollection         *mongo.Collection
	channelSettingsCollection *mongo.Collection
	collectionsClient pb.CollectionsClient
	pointsClient     pb.PointsClient
	genaiClient      *genai.Client
	jobQueue         chan ProcessingJob
	wg               sync.WaitGroup
)

// CATEGORIES defines all available note categories
var CATEGORIES = []string{
	// Personal & Life
	"journal", "reflections", "goals", "ideas", "thoughts", "dreams", "personal-growth",
	
	// Health & Fitness
	"recipes", "workouts", "meal-planning", "health-tips", "medical", "nutrition",
	
	// Work & Productivity
	"meeting-notes", "tasks", "project-ideas", "research", "documentation", "work-thoughts",
	
	// Learning & Growth
	"book-notes", "article-notes", "podcast-transcripts", "courses", "tutorials", "learning",
	
	// Relationships & Social
	"relationship-thoughts", "family", "social-interactions", "networking", "communication",
	
	// Financial & Planning
	"budgeting", "investments", "financial-planning", "expenses", "money-thoughts",
	
	// Travel & Adventure
	"travel-plans", "places-to-visit", "travel-experiences", "adventure-ideas",
	
	// Creative & Hobbies
	"writing-ideas", "art-projects", "creative-inspiration", "hobbies", "entertainment",
	
	// Technical & Code
	"coding-notes", "technical-docs", "troubleshooting", "apis", "programming",
	
	// Other
	"other", "miscellaneous", "random-thoughts",
}

const (
	COLLECTION_NAME      = "notes_embeddings"
	CHUNK_SIZE           = 1000
	MAX_WORDS            = 10000
	EMBEDDING_DIM        = 768
	MIN_RELEVANCE_SCORE  = 0.3 // Filter out results below 30% relevance
	
	// Gemini AI Model Configuration
	EMBEDDING_MODEL      = "text-embedding-004"     // For generating embeddings
	GENERATION_MODEL     = "gemini-2.5-flash-lite"  // For text generation and classification
)

func main() {
	mongoURI := os.Getenv("MONGO_URI")
	if mongoURI == "" {
		mongoURI = "mongodb://mongo:27017"
	}

	qdrantURL := os.Getenv("QDRANT_URL")
	if qdrantURL == "" {
		qdrantURL = "qdrant:6334"  // Use gRPC port
	}
	
	// Remove http:// prefix for gRPC connection and switch to gRPC port
	if strings.HasPrefix(qdrantURL, "http://") {
		qdrantURL = strings.TrimPrefix(qdrantURL, "http://")
		qdrantURL = strings.Replace(qdrantURL, ":6333", ":6334", 1)  // Switch to gRPC port
	}

	geminiAPIKey := os.Getenv("GEMINI_API_KEY")
	if geminiAPIKey == "" {
		log.Fatal("GEMINI_API_KEY environment variable is required")
	}

	mongoClient, err := mongo.Connect(context.TODO(), options.Client().ApplyURI(mongoURI))
	if err != nil {
		log.Fatal(err)
	}
	defer mongoClient.Disconnect(context.TODO())

	notesCollection = mongoClient.Database("notesdb").Collection("notes")
	chunksCollection = mongoClient.Database("notesdb").Collection("chunks")
	channelSettingsCollection = mongoClient.Database("notesdb").Collection("channel_settings")

	conn, err := grpc.Dial(qdrantURL, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		log.Fatal("Failed to connect to Qdrant:", err)
	}
	defer conn.Close()
	
	collectionsClient = pb.NewCollectionsClient(conn)
	pointsClient = pb.NewPointsClient(conn)

	genaiClient, err = genai.NewClient(context.Background(), option.WithAPIKey(geminiAPIKey))
	if err != nil {
		log.Fatal("Failed to create Gemini client:", err)
	}
	defer genaiClient.Close()

	if err := initializeQdrant(); err != nil {
		log.Fatal("Failed to initialize Qdrant:", err)
	}

	jobQueue = make(chan ProcessingJob, 100)
	
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
		if collection.Name == COLLECTION_NAME {
			collectionExists = true
			break
		}
	}

	if !collectionExists {
		log.Printf("Creating Qdrant collection: %s", COLLECTION_NAME)
		_, err := collectionsClient.Create(ctx, &pb.CreateCollection{
			CollectionName: COLLECTION_NAME,
			VectorsConfig: &pb.VectorsConfig{
				Config: &pb.VectorsConfig_Params{
					Params: &pb.VectorParams{
						Size:     EMBEDDING_DIM,
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

func classifyNote(title, content string) (string, error) {
	prompt := fmt.Sprintf(`
Classify this note into exactly ONE of these categories: %s

Note Title: %s
Note Content: %s

Rules:
1. Return ONLY the category name, nothing else
2. Choose the MOST relevant category
3. If uncertain, use "other"
4. Be consistent with similar content

Category:`, strings.Join(CATEGORIES, ", "), title, content)

	ctx := context.Background()
	model := genaiClient.GenerativeModel(GENERATION_MODEL)
	result, err := model.GenerateContent(ctx, genai.Text(prompt))
	if err != nil {
		return "", fmt.Errorf("failed to generate classification: %w", err)
	}

	if result == nil || len(result.Candidates) == 0 || result.Candidates[0].Content == nil {
		return "", fmt.Errorf("no classification result returned")
	}

	category := strings.TrimSpace(strings.ToLower(string(result.Candidates[0].Content.Parts[0].(genai.Text))))

	// Validate category is in our list
	for _, validCategory := range CATEGORIES {
		if category == validCategory {
			return category, nil
		}
	}

	// If not found, return "other"
	return "other", nil
}

// analyzeNote performs title generation, classification, and summary in a single API call
func analyzeNote(content string, includeSummary bool) (*NoteAnalysis, error) {
	// Get first 2000 characters for analysis to avoid token limits while keeping enough context
	excerpt := content
	if len(content) > 2000 {
		excerpt = content[:2000] + "..."
	}

	summaryInstruction := ""
	summaryField := `"summary": ""`
	if includeSummary {
		summaryInstruction = `4. "summary": A concise summary (2-4 sentences) capturing the key points and main takeaways`
		summaryField = `"summary": "your summary here"`
	}

	prompt := fmt.Sprintf(`Analyze this note and return a JSON object with the following fields:

1. "title": A concise, descriptive title (2-10 words, no quotes or special formatting)
2. "category": Exactly ONE category from this list: %s
3. Choose the MOST relevant category. If uncertain, use "other"
%s

IMPORTANT: Return ONLY valid JSON, no markdown formatting, no code blocks, just the raw JSON object.

Content to analyze:
%s

Return this exact JSON structure:
{"title": "your title here", "category": "category-name", %s}`,
		strings.Join(CATEGORIES, ", "),
		summaryInstruction,
		excerpt,
		summaryField)

	ctx := context.Background()
	model := genaiClient.GenerativeModel(GENERATION_MODEL)
	result, err := model.GenerateContent(ctx, genai.Text(prompt))
	if err != nil {
		return nil, fmt.Errorf("failed to analyze note: %w", err)
	}

	if result == nil || len(result.Candidates) == 0 || result.Candidates[0].Content == nil {
		return nil, fmt.Errorf("no analysis result returned")
	}

	responseText := strings.TrimSpace(string(result.Candidates[0].Content.Parts[0].(genai.Text)))

	// Clean up response - remove markdown code blocks if present
	responseText = strings.TrimPrefix(responseText, "```json")
	responseText = strings.TrimPrefix(responseText, "```")
	responseText = strings.TrimSuffix(responseText, "```")
	responseText = strings.TrimSpace(responseText)

	var analysis NoteAnalysis
	if err := json.Unmarshal([]byte(responseText), &analysis); err != nil {
		log.Printf("Failed to parse analysis JSON: %s, error: %v", responseText, err)
		return nil, fmt.Errorf("failed to parse analysis response: %w", err)
	}

	// Validate and clean up title
	analysis.Title = strings.Trim(analysis.Title, "\"'")
	if len(analysis.Title) > 100 {
		analysis.Title = analysis.Title[:100]
	}
	if analysis.Title == "" {
		analysis.Title = "Untitled Note"
	}

	// Validate category
	validCategory := false
	analysis.Category = strings.ToLower(strings.TrimSpace(analysis.Category))
	for _, cat := range CATEGORIES {
		if analysis.Category == cat {
			validCategory = true
			break
		}
	}
	if !validCategory {
		analysis.Category = "other"
	}

	return &analysis, nil
}

func processNoteJob(job ProcessingJob) error {
	// Note: Title, category, and summary are now generated during createNote()
	// This job only handles embedding generation

	fullText := job.Title + "\n\n" + job.Content

	// Skip embedding if sensitive data detected
	if containsSensitiveData(fullText) {
		log.Printf("Skipping embedding for note %s: Sensitive data detected (API keys, passwords, etc.)", job.NoteID.Hex())
		return nil // Not an error, just skip embedding for security
	}

	words := strings.Fields(fullText)

	if len(words) > MAX_WORDS {
		words = words[:MAX_WORDS]
		fullText = strings.Join(words, " ")
	}

	chunks := chunkText(fullText, CHUNK_SIZE)

	for i, chunk := range chunks {
		chunkDoc := NoteChunk{
			NoteID:   job.NoteID,
			Content:  chunk,
			ChunkIdx: i,
		}

		result, err := chunksCollection.InsertOne(context.Background(), chunkDoc)
		if err != nil {
			log.Printf("Error saving chunk: %v", err)
			continue
		}

		chunkID := result.InsertedID.(primitive.ObjectID)

		embedding, err := generateEmbedding(chunk)
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

func chunkText(text string, chunkSize int) []string {
	words := strings.Fields(text)
	var chunks []string
	
	for i := 0; i < len(words); i += chunkSize {
		end := i + chunkSize
		if end > len(words) {
			end = len(words)
		}
		chunks = append(chunks, strings.Join(words[i:end], " "))
	}
	
	return chunks
}

func containsSensitiveData(text string) bool {
	// Common patterns for sensitive information
	sensitivePatterns := []string{
		// API Keys
		`(?i)(api[_-]?key|apikey)\s*[:=]\s*[a-zA-Z0-9_-]{10,}`,
		`sk-[a-zA-Z0-9]{32,}`,                    // OpenAI API keys
		`AIza[a-zA-Z0-9_-]{35}`,                  // Google API keys  
		`ya29\.[a-zA-Z0-9_-]+`,                   // Google OAuth tokens
		`ghp_[a-zA-Z0-9]{36}`,                    // GitHub personal access tokens
		`gho_[a-zA-Z0-9]{36}`,                    // GitHub OAuth tokens
		
		// Passwords
		`(?i)(password|passwd|pwd)\s*[:=]\s*\S{6,}`,
		`(?i)(pass|pw)\s*[:=]\s*['"]\S{6,}['"]`,
		
		// Secrets and Tokens
		`(?i)(secret|token|auth)\s*[:=]\s*[a-zA-Z0-9_-]{10,}`,
		`(?i)bearer\s+[a-zA-Z0-9_-]{10,}`,
		`(?i)access[_-]?token\s*[:=]\s*[a-zA-Z0-9_-]{10,}`,
		
		// Database Connection Strings
		`(?i)(mongodb|mysql|postgres|redis)://[^\s]+`,
		`(?i)connection[_-]?string\s*[:=]\s*[^\s;]+`,
		
		// Private Keys (basic detection)
		`-----BEGIN [A-Z\s]+ PRIVATE KEY-----`,
		`(?i)private[_-]?key\s*[:=]\s*[a-zA-Z0-9+/=]{20,}`,
		
		// Common service tokens
		`xoxb-[a-zA-Z0-9-]+`,                     // Slack bot tokens
		`xoxp-[a-zA-Z0-9-]+`,                     // Slack user tokens
	}
	
	for _, pattern := range sensitivePatterns {
		matched, err := regexp.MatchString(pattern, text)
		if err != nil {
			log.Printf("Error matching pattern %s: %v", pattern, err)
			continue
		}
		if matched {
			return true
		}
	}
	
	return false
}

func generateEmbedding(text string) ([]float32, error) {
	ctx := context.Background()
	
	model := genaiClient.EmbeddingModel(EMBEDDING_MODEL)
	
	result, err := model.EmbedContent(ctx, genai.Text(text))
	if err != nil {
		return nil, fmt.Errorf("failed to generate embedding: %w", err)
	}

	if result == nil || result.Embedding == nil || len(result.Embedding.Values) == 0 {
		return nil, fmt.Errorf("no embedding returned")
	}

	return result.Embedding.Values, nil
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
		CollectionName: COLLECTION_NAME,
		Points:         []*pb.PointStruct{point},
	})

	return err
}

func getNotes(c *gin.Context) {
	// Build filter based on query params
	filter := bson.D{}

	// Filter by channel (author) if provided
	if channel := c.Query("channel"); channel != "" {
		filter = append(filter, bson.E{Key: "metadata.author", Value: channel})
	}

	cursor, err := notesCollection.Find(context.TODO(), filter)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer cursor.Close(context.TODO())

	var notes []Note
	if err = cursor.All(context.TODO(), &notes); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if notes == nil {
		notes = []Note{}
	}

	c.JSON(http.StatusOK, notes)
}

// checkNoteExistsByURL checks if a note with the given URL already exists
func checkNoteExistsByURL(url string) (bool, error) {
	if url == "" {
		return false, nil
	}

	count, err := notesCollection.CountDocuments(
		context.Background(),
		bson.M{"metadata.url": url},
	)
	if err != nil {
		return false, err
	}

	return count > 0, nil
}

type CreateNoteRequest struct {
	Content  string                 `json:"content" binding:"required"`
	Title    string                 `json:"title,omitempty"`    // Optional, will be auto-generated if empty
	Metadata map[string]interface{} `json:"metadata"`           // Optional, for social media metadata
}

func createNote(c *gin.Context) {
	log.Printf("=== CREATE NOTE FUNCTION CALLED ===")

	var req CreateNoteRequest
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
		var settings ChannelSettings
		err := channelSettingsCollection.FindOne(
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
		analysis, err := analyzeNote(req.Content, isYouTube && useDefaultSummary)
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
		analysis, err := analyzeNote(req.Content, isYouTube && useDefaultSummary)
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
		customSummary, customStructuredData, err := generateStructuredSummary(req.Content, customPromptText, customPromptSchema)
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

	note := Note{
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
		exists, err := checkNoteExistsByURL(urlVal)
		if err != nil {
			log.Printf("Error checking for duplicate URL: %v", err)
		} else if exists {
			log.Printf("Duplicate note detected for URL: %s", urlVal)
			c.JSON(http.StatusConflict, gin.H{"error": "duplicate", "url": urlVal})
			return
		}
	}

	result, err := notesCollection.InsertOne(context.TODO(), note)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	note.ID = result.InsertedID.(primitive.ObjectID)

	// Queue job for embedding generation only (title, category, summary already done)
	job := ProcessingJob{
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

type UpdateNoteRequest struct {
	Content string `json:"content" binding:"required"`
}

func updateNote(c *gin.Context) {
	noteID := c.Param("id")
	
	objID, err := primitive.ObjectIDFromHex(noteID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid note ID"})
		return
	}
	
	var req UpdateNoteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	
	// Find the existing note first
	var existingNote Note
	err = notesCollection.FindOne(context.Background(), bson.M{"_id": objID}).Decode(&existingNote)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			c.JSON(http.StatusNotFound, gin.H{"error": "Note not found"})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to find note"})
		}
		return
	}
	
	// Generate new title from content
	newTitle, err := generateTitle(req.Content)
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
	
	_, err = notesCollection.UpdateOne(context.Background(), bson.M{"_id": objID}, update)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update note"})
		return
	}
	
	// Get the updated note
	var updatedNote Note
	err = notesCollection.FindOne(context.Background(), bson.M{"_id": objID}).Decode(&updatedNote)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve updated note"})
		return
	}
	
	// Queue re-processing job for embeddings and classification
	job := ProcessingJob{
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
	
	c.JSON(http.StatusOK, updatedNote)
}

func deleteNote(c *gin.Context) {
	noteID := c.Param("id")
	
	objID, err := primitive.ObjectIDFromHex(noteID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid note ID"})
		return
	}
	
	// Check if note exists
	var existingNote Note
	err = notesCollection.FindOne(context.Background(), bson.M{"_id": objID}).Decode(&existingNote)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			c.JSON(http.StatusNotFound, gin.H{"error": "Note not found"})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to find note"})
		}
		return
	}
	
	// Delete note from MongoDB
	_, err = notesCollection.DeleteOne(context.Background(), bson.M{"_id": objID})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete note"})
		return
	}
	
	// Delete associated chunks from MongoDB
	_, err = chunksCollection.DeleteMany(context.Background(), bson.M{"note_id": objID})
	if err != nil {
		log.Printf("Failed to delete chunks for note %s: %v", noteID, err)
		// Don't fail the request, just log the error
	}
	
	// TODO: Delete embeddings from Qdrant (would require additional logic to find points by note_id)
	// For now, we'll leave the embeddings as they won't match any existing notes
	
	c.JSON(http.StatusOK, gin.H{"message": "Note deleted successfully"})
}

func searchNotes(c *gin.Context) {
	var req SearchRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.Limit <= 0 {
		req.Limit = 10
	}

	queryEmbedding, err := generateEmbedding(req.Query)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate embedding for query"})
		return
	}

	searchResult, err := pointsClient.Search(context.Background(), &pb.SearchPoints{
		CollectionName: COLLECTION_NAME,
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
		c.JSON(http.StatusOK, []SearchResult{})
		return
	}

	cursor, err := notesCollection.Find(context.Background(), bson.M{"_id": bson.M{"$in": objectIDs}})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch notes"})
		return
	}
	defer cursor.Close(context.Background())

	var notes []Note
	if err = cursor.All(context.Background(), &notes); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to decode notes"})
		return
	}

	var results []SearchResult
	for _, note := range notes {
		score := noteScores[note.ID.Hex()]
		
		// Only include results above the minimum relevance threshold
		if score >= MIN_RELEVANCE_SCORE {
			results = append(results, SearchResult{
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

type CategoryCount struct {
	Name  string `json:"name"`
	Count int    `json:"count"`
}

func getCategories(c *gin.Context) {
	pipeline := []bson.M{
		{
			"$group": bson.M{
				"_id":   "$category",
				"count": bson.M{"$sum": 1},
			},
		},
		{
			"$sort": bson.M{"count": -1},
		},
	}

	cursor, err := notesCollection.Aggregate(context.Background(), pipeline)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to aggregate categories"})
		return
	}
	defer cursor.Close(context.Background())

	var results []CategoryCount
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
			results = append(results, CategoryCount{
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
	
	for _, category := range CATEGORIES {
		if !existingCategories[category] {
			results = append(results, CategoryCount{
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
	validCategory := false
	for _, validCat := range CATEGORIES {
		if category == validCat {
			validCategory = true
			break
		}
	}
	
	if !validCategory {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid category"})
		return
	}

	// Sort by created date (newest first)
	opts := options.Find().SetSort(bson.M{"created": -1})
	cursor, err := notesCollection.Find(context.Background(), bson.M{"category": category}, opts)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch notes"})
		return
	}
	defer cursor.Close(context.Background())

	var notes []Note
	if err = cursor.All(context.Background(), &notes); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to decode notes"})
		return
	}

	if notes == nil {
		notes = []Note{}
	}

	c.JSON(http.StatusOK, notes)
}

func getCategoryStats(c *gin.Context) {
	pipeline := []bson.M{
		{
			"$group": bson.M{
				"_id":   "$category",
				"count": bson.M{"$sum": 1},
			},
		},
		{
			"$sort": bson.M{"count": -1},
		},
	}

	cursor, err := notesCollection.Aggregate(context.Background(), pipeline)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get category stats"})
		return
	}
	defer cursor.Close(context.Background())

	var categoryStats []CategoryCount
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
			categoryStats = append(categoryStats, CategoryCount{
				Name:  result.ID,
				Count: result.Count,
			})
			totalNotes += result.Count
		}
	}

	response := gin.H{
		"categories": categoryStats,
		"total_notes": totalNotes,
		"total_categories": len(CATEGORIES),
	}

	c.JSON(http.StatusOK, response)
}

func classifyExistingNotes(c *gin.Context) {
	// Find notes without category or with empty category
	cursor, err := notesCollection.Find(context.Background(), bson.M{
		"$or": []bson.M{
			{"category": bson.M{"$exists": false}},
			{"category": ""},
		},
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to find notes"})
		return
	}
	defer cursor.Close(context.Background())

	var notes []Note
	if err = cursor.All(context.Background(), &notes); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to decode notes"})
		return
	}

	classified := 0
	errors := 0

	for _, note := range notes {
		category, err := classifyNote(note.Title, note.Content)
		if err != nil {
			log.Printf("Failed to classify note %s: %v", note.ID.Hex(), err)
			category = "other"
			errors++
		}

		_, err = notesCollection.UpdateOne(
			context.Background(),
			bson.M{"_id": note.ID},
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
		"message": "Classification complete",
		"classified": classified,
		"errors": errors,
		"total": len(notes),
	})
}

func answerQuestion(c *gin.Context) {
	var req QuestionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Step 1: Search for relevant notes using semantic search
	queryEmbedding, err := generateEmbedding(req.Question)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate embedding for question"})
		return
	}

	searchResult, err := pointsClient.Search(context.Background(), &pb.SearchPoints{
		CollectionName: COLLECTION_NAME,
		Vector:         queryEmbedding,
		Limit:          uint64(5), // Get top 5 most relevant notes
		WithPayload:    &pb.WithPayloadSelector{SelectorOptions: &pb.WithPayloadSelector_Enable{Enable: true}},
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Search failed"})
		return
	}

	// Step 2: Get relevant notes and prepare context
	var relevantNotes []SearchResult
	var contextText strings.Builder
	noteIDs := make(map[string]bool)

	for _, point := range searchResult.Result {
		noteIDStr := point.Payload["note_id"].GetStringValue()
		score := point.Score
		
		// Only include highly relevant notes (higher threshold for Q&A)
		if score >= 0.4 && !noteIDs[noteIDStr] {
			if objID, err := primitive.ObjectIDFromHex(noteIDStr); err == nil {
				var note Note
				err := notesCollection.FindOne(context.Background(), bson.M{"_id": objID}).Decode(&note)
				if err == nil {
					relevantNotes = append(relevantNotes, SearchResult{
						Note:  note,
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
		c.JSON(http.StatusOK, QuestionResponse{
			Answer:   "I couldn't find any relevant information in your notes to answer that question.",
			Sources:  []SearchResult{},
			Question: req.Question,
		})
		return
	}

	// Step 3: Generate answer using relevant context
	answer, err := generateAnswer(req.Question, contextText.String())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate answer"})
		return
	}

	c.JSON(http.StatusOK, QuestionResponse{
		Answer:   answer,
		Sources:  relevantNotes,
		Question: req.Question,
	})
}

func generateAnswer(question, contextText string) (string, error) {
	prompt := fmt.Sprintf(`You are an AI assistant helping someone understand their personal notes. Based on the provided context from their notes, answer their question in a helpful and conversational way.

Context from their notes:
%s

Question: %s

Instructions:
1. Answer based ONLY on the information provided in the context
2. Be conversational and helpful
3. If the context doesn't contain enough information, say so politely
4. Reference specific notes when relevant (e.g., "According to your note about...")
5. Keep the answer concise but complete

Answer:`, contextText, question)

	ctx := context.Background()
	model := genaiClient.GenerativeModel(GENERATION_MODEL)
	result, err := model.GenerateContent(ctx, genai.Text(prompt))
	if err != nil {
		return "", fmt.Errorf("failed to generate answer: %w", err)
	}

	if result == nil || len(result.Candidates) == 0 || result.Candidates[0].Content == nil {
		return "", fmt.Errorf("no answer generated")
	}

	answer := strings.TrimSpace(string(result.Candidates[0].Content.Parts[0].(genai.Text)))
	return answer, nil
}

func generateTitle(content string) (string, error) {
	// Get first 500 characters for title generation to avoid token limits
	excerpt := content
	if len(content) > 500 {
		excerpt = content[:500] + "..."
	}

	prompt := fmt.Sprintf(`Generate a concise, descriptive title for this note content. The title should:

1. Be accurate and specific to the content
2. Be 2-10 words maximum
3. Capture the main topic/theme
4. Be clear and searchable
5. NOT include quotation marks or special formatting

Content:
%s

Title:`, excerpt)

	ctx := context.Background()
	model := genaiClient.GenerativeModel(GENERATION_MODEL)
	result, err := model.GenerateContent(ctx, genai.Text(prompt))
	if err != nil {
		return "", fmt.Errorf("failed to generate title: %w", err)
	}

	if result == nil || len(result.Candidates) == 0 || result.Candidates[0].Content == nil {
		return "", fmt.Errorf("no title generated")
	}

	title := strings.TrimSpace(string(result.Candidates[0].Content.Parts[0].(genai.Text)))
	
	// Clean up the title (remove quotes, ensure reasonable length)
	title = strings.Trim(title, "\"'")
	if len(title) > 100 {
		title = title[:100]
	}
	if title == "" {
		title = "Untitled Note"
	}
	
	return title, nil
}

func askAIAboutNote(c *gin.Context) {
	var req AIQuestionRequest
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
	model := genaiClient.GenerativeModel(GENERATION_MODEL)
	result, err := model.GenerateContent(ctx, genai.Text(fullPrompt))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate AI response"})
		return
	}

	if result == nil || len(result.Candidates) == 0 || result.Candidates[0].Content == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "No response generated"})
		return
	}

	response := strings.TrimSpace(string(result.Candidates[0].Content.Parts[0].(genai.Text)))
	
	c.JSON(http.StatusOK, AIQuestionResponse{
		Response: response,
	})
}

func summarizeNote(c *gin.Context) {
	var req SummarizeRequest
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
	var note Note
	err = notesCollection.FindOne(context.Background(), bson.M{"_id": objID}).Decode(&note)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Note not found"})
		return
	}

	// Check for custom prompt and schema based on channel
	var promptText, promptSchema string
	if note.Metadata != nil {
		if author, ok := note.Metadata["author"].(string); ok && author != "" {
			var settings ChannelSettings
			err = channelSettingsCollection.FindOne(
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
	summary, structuredData, err := generateStructuredSummary(req.Content, promptText, promptSchema)
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

	_, err = notesCollection.UpdateOne(
		context.Background(),
		bson.M{"_id": objID},
		bson.M{"$set": updateFields},
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save summary"})
		return
	}

	c.JSON(http.StatusOK, SummarizeResponse{
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
	var note Note
	err = notesCollection.FindOne(context.Background(), bson.M{"_id": objID}).Decode(&note)
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
			var settings ChannelSettings
			err = channelSettingsCollection.FindOne(
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
	summary, structuredData, err := generateStructuredSummary(note.Content, promptText, promptSchema)
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

	_, err = notesCollection.UpdateOne(
		context.Background(),
		bson.M{"_id": objID},
		bson.M{"$set": updateFields},
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save summary"})
		return
	}

	c.JSON(http.StatusOK, SummarizeResponse{
		Summary:        summary,
		StructuredData: structuredData,
	})
}

func generateSummary(content string) (string, error) {
	return generateSummaryWithPrompt(content, "")
}

func generateSummaryWithPrompt(content string, customPrompt string) (string, error) {
	var prompt string

	if customPrompt != "" {
		// Use custom prompt - append content to it
		prompt = fmt.Sprintf(`%s

Content to summarize:
%s`, customPrompt, content)
	} else {
		// Use default prompt
		prompt = fmt.Sprintf(`Please provide a concise and well-formatted summary of the following content. The summary should:

1. Be concise and to-the-point - avoid unnecessary words
2. If the content includes lists or multiple points, clearly outline each point with bullet points or numbered lists
3. Use proper spacing with line breaks between different sections or topics
4. Structure the information logically with clear paragraphs
5. Capture the key takeaways and main ideas
6. If there are actionable items or recommendations, list them clearly
7. Maintain the essential context but eliminate redundancy

Format your response with:
- Clear paragraph breaks between different topics
- Bullet points (•) or numbered lists when covering multiple items
- Proper spacing for readability

Content to summarize:
%s

Summary:`, content)
	}

	ctx := context.Background()
	model := genaiClient.GenerativeModel(GENERATION_MODEL)
	result, err := model.GenerateContent(ctx, genai.Text(prompt))
	if err != nil {
		return "", fmt.Errorf("failed to generate summary: %w", err)
	}

	if result == nil || len(result.Candidates) == 0 || result.Candidates[0].Content == nil {
		return "", fmt.Errorf("no summary generated")
	}

	summary := strings.TrimSpace(string(result.Candidates[0].Content.Parts[0].(genai.Text)))
	return summary, nil
}

// generateStructuredSummary generates a summary with structured data based on a schema
func generateStructuredSummary(content, promptText, promptSchema string) (string, map[string]interface{}, error) {
	// If no schema provided, fall back to regular summary
	if promptSchema == "" {
		summary, err := generateSummaryWithPrompt(content, promptText)
		if err != nil {
			return "", nil, err
		}
		return summary, nil, nil
	}

	// Build prompt that requests JSON output matching the schema
	prompt := fmt.Sprintf(`%s

You MUST respond with valid JSON matching this exact structure:
%s

IMPORTANT:
- Return ONLY valid JSON, no markdown formatting, no code blocks
- The "summary" field must always be included as a string
- Follow the schema structure exactly

Content to analyze:
%s`, promptText, promptSchema, content)

	ctx := context.Background()
	model := genaiClient.GenerativeModel(GENERATION_MODEL)
	result, err := model.GenerateContent(ctx, genai.Text(prompt))
	if err != nil {
		return "", nil, fmt.Errorf("failed to generate structured summary: %w", err)
	}

	if result == nil || len(result.Candidates) == 0 || result.Candidates[0].Content == nil {
		return "", nil, fmt.Errorf("no structured summary generated")
	}

	responseText := strings.TrimSpace(string(result.Candidates[0].Content.Parts[0].(genai.Text)))

	// Clean up response - remove markdown code blocks if present
	responseText = strings.TrimPrefix(responseText, "```json")
	responseText = strings.TrimPrefix(responseText, "```")
	responseText = strings.TrimSuffix(responseText, "```")
	responseText = strings.TrimSpace(responseText)

	// Parse the JSON response
	var structuredData map[string]interface{}
	if err := json.Unmarshal([]byte(responseText), &structuredData); err != nil {
		log.Printf("Failed to parse structured summary JSON: %s, error: %v", responseText, err)
		// Fall back to treating the response as plain text summary
		return responseText, nil, nil
	}

	// Extract summary field
	summary := ""
	if summaryVal, ok := structuredData["summary"]; ok {
		if summaryStr, ok := summaryVal.(string); ok {
			summary = summaryStr
		}
	}

	// If no summary in structured data, use the full response as summary
	if summary == "" {
		summary = responseText
	}

	return summary, structuredData, nil
}

func regenerateAllTitles(c *gin.Context) {
	// Find all notes
	cursor, err := notesCollection.Find(context.Background(), bson.M{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to find notes"})
		return
	}
	defer cursor.Close(context.Background())

	var notes []Note
	if err = cursor.All(context.Background(), &notes); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to decode notes"})
		return
	}

	regenerated := 0
	errors := 0

	for _, note := range notes {
		newTitle, err := generateTitle(note.Content)
		if err != nil {
			log.Printf("Failed to generate title for note %s: %v", note.ID.Hex(), err)
			errors++
			continue
		}

		_, err = notesCollection.UpdateOne(
			context.Background(),
			bson.M{"_id": note.ID},
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
		"message": "Title regeneration complete",
		"regenerated": regenerated,
		"errors": errors,
		"total": len(notes),
	})
}

// Channel Settings Handlers

func getChannelsWithNotes(c *gin.Context) {
	// Aggregate to get unique channels (authors) from notes with their platform
	pipeline := mongo.Pipeline{
		{{Key: "$match", Value: bson.M{"metadata.author": bson.M{"$exists": true, "$ne": ""}}}},
		{{Key: "$group", Value: bson.M{
			"_id": "$metadata.author",
			"platform": bson.M{"$first": "$metadata.platform"},
			"noteCount": bson.M{"$sum": 1},
		}}},
		{{Key: "$sort", Value: bson.M{"noteCount": -1}}},
	}

	cursor, err := notesCollection.Aggregate(context.Background(), pipeline)
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
	cursor, err := channelSettingsCollection.Find(context.Background(), bson.M{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get channel settings"})
		return
	}
	defer cursor.Close(context.Background())

	var settings []ChannelSettings
	if err = cursor.All(context.Background(), &settings); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to decode settings"})
		return
	}

	// Return empty array if no settings
	if settings == nil {
		settings = []ChannelSettings{}
	}

	c.JSON(http.StatusOK, settings)
}

func getChannelSettings(c *gin.Context) {
	channelName := c.Param("channel")

	var settings ChannelSettings
	err := channelSettingsCollection.FindOne(
		context.Background(),
		bson.M{"channel_name": channelName},
	).Decode(&settings)

	if err == mongo.ErrNoDocuments {
		// Return default settings if not found
		c.JSON(http.StatusOK, ChannelSettings{
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

	settings := ChannelSettings{
		ChannelName:  channelName,
		Platform:     req.Platform,
		ChannelUrl:   req.ChannelUrl,
		PromptText:   req.PromptText,
		PromptSchema: req.PromptSchema,
		UpdatedAt:    time.Now(),
	}

	// Upsert the settings
	opts := options.Update().SetUpsert(true)
	_, err := channelSettingsCollection.UpdateOne(
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

	result, err := channelSettingsCollection.DeleteOne(
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
	cursor, err := notesCollection.Find(
		context.Background(),
		bson.M{"metadata.author": channelName},
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to find notes"})
		return
	}
	defer cursor.Close(context.Background())

	var notes []Note
	if err = cursor.All(context.Background(), &notes); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to decode notes"})
		return
	}

	deletedNotes := 0
	deletedChunks := 0

	// Delete each note and its associated chunks/embeddings
	for _, note := range notes {
		// Delete chunks for this note
		chunkResult, err := chunksCollection.DeleteMany(
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
		_, err = notesCollection.DeleteOne(
			context.Background(),
			bson.M{"_id": note.ID},
		)
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
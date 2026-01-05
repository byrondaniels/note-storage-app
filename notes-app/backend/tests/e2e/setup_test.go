package e2e

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"

	"backend/internal/ai"
	"backend/internal/handlers"
	"backend/internal/models"
	"backend/internal/repository"
	"backend/internal/services"
	"backend/internal/vectordb"
)

// TestEnv holds all test dependencies
type TestEnv struct {
	Router      *gin.Engine
	MongoClient *mongo.Client
	Database    *mongo.Database
	QdrantURL   string
	CleanupFns  []func()
}

var testEnv *TestEnv

// SetupTestEnv initializes the test environment
func SetupTestEnv(t *testing.T) *TestEnv {
	if testEnv != nil {
		return testEnv
	}

	gin.SetMode(gin.TestMode)

	// Get test configuration from environment
	mongoURI := os.Getenv("TEST_MONGO_URI")
	if mongoURI == "" {
		mongoURI = "mongodb://localhost:27017"
	}

	qdrantURL := os.Getenv("TEST_QDRANT_URL")
	if qdrantURL == "" {
		qdrantURL = "localhost:6334"
	}

	geminiAPIKey := os.Getenv("GEMINI_API_KEY")
	if geminiAPIKey == "" {
		// Use mock AI client for tests without API key
		t.Log("GEMINI_API_KEY not set, using mock AI client")
	}

	// Connect to MongoDB
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	clientOptions := options.Client().ApplyURI(mongoURI)
	mongoClient, err := mongo.Connect(ctx, clientOptions)
	if err != nil {
		t.Fatalf("Failed to connect to MongoDB: %v", err)
	}

	// Ping MongoDB
	if err := mongoClient.Ping(ctx, nil); err != nil {
		t.Fatalf("Failed to ping MongoDB: %v", err)
	}

	// Use a test-specific database
	database := mongoClient.Database("notesdb_test")

	// Create repositories
	notesRepo := repository.NewNotesRepository(database)
	chunksRepo := repository.NewChunksRepository(database)
	channelSettingsRepo := repository.NewChannelSettingsRepository(database)

	// Initialize Qdrant client
	var qdrantClient *vectordb.QdrantClient
	qdrantClient, err = vectordb.NewQdrantClient(qdrantURL)
	if err != nil {
		t.Logf("Warning: Could not connect to Qdrant at %s: %v. Skipping vector tests.", qdrantURL, err)
	} else {
		if err := qdrantClient.Initialize(); err != nil {
			t.Logf("Warning: Could not initialize Qdrant: %v", err)
		}
	}

	// Initialize AI client (mock if no API key)
	var aiClient ai.Client
	if geminiAPIKey != "" {
		aiClient, err = ai.NewAIClient(context.Background(), geminiAPIKey)
		if err != nil {
			t.Logf("Warning: Could not create AI client: %v. Using mock AI client.", err)
			aiClient = ai.NewMockAIClient()
		}
	} else {
		aiClient = ai.NewMockAIClient()
	}

	// Initialize worker pool (always initialize with AI client, even if mock)
	var workerPool *services.WorkerPool
	if qdrantClient != nil {
		workerPool = services.NewWorkerPool(1, 10, chunksRepo, aiClient, qdrantClient)
		workerPool.Start()
	}

	// Create services
	notesService := services.NewNotesService(
		notesRepo,
		chunksRepo,
		channelSettingsRepo,
		aiClient,
		qdrantClient,
		workerPool,
	)

	var searchService *services.SearchService
	if qdrantClient != nil {
		searchService = services.NewSearchService(notesRepo, aiClient, qdrantClient)
	}

	summaryService := services.NewSummaryService(notesRepo, channelSettingsRepo, aiClient)

	// Create handlers
	notesHandler := handlers.NewNotesHandler(notesService)
	categoriesHandler := handlers.NewCategoriesHandler(notesRepo, aiClient)
	channelsHandler := handlers.NewChannelsHandler(notesRepo, chunksRepo, channelSettingsRepo, qdrantClient)

	// Configure Gin router
	router := gin.New()
	router.Use(gin.Recovery())
	router.Use(cors.New(cors.Config{
		AllowAllOrigins:  true,
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type"},
		AllowCredentials: false,
	}))

	// Register routes
	notesHandler.RegisterRoutes(router)
	categoriesHandler.RegisterRoutes(router)
	channelsHandler.RegisterRoutes(router)

	// Register search and summary handlers
	if searchService != nil {
		searchHandler := handlers.NewSearchHandler(searchService, aiClient)
		searchHandler.RegisterRoutes(router)
	}
	summaryHandler := handlers.NewSummaryHandler(summaryService)
	summaryHandler.RegisterRoutes(router)

	testEnv = &TestEnv{
		Router:      router,
		MongoClient: mongoClient,
		Database:    database,
		QdrantURL:   qdrantURL,
		CleanupFns:  []func(){},
	}

	// Add cleanup functions
	testEnv.CleanupFns = append(testEnv.CleanupFns, func() {
		if workerPool != nil {
			workerPool.Stop()
		}
		if qdrantClient != nil {
			qdrantClient.Close()
		}
		if aiClient != nil {
			aiClient.Close()
		}
	})

	return testEnv
}

// TeardownTestEnv cleans up the test environment
func TeardownTestEnv(t *testing.T, env *TestEnv) {
	if env == nil {
		return
	}

	ctx := context.Background()

	// Drop test database
	if err := env.Database.Drop(ctx); err != nil {
		t.Logf("Warning: Failed to drop test database: %v", err)
	}

	// Run cleanup functions
	for _, fn := range env.CleanupFns {
		fn()
	}

	// Disconnect MongoDB
	if err := env.MongoClient.Disconnect(ctx); err != nil {
		t.Logf("Warning: Failed to disconnect MongoDB: %v", err)
	}

	testEnv = nil
}

// CleanupCollections clears all test collections
func CleanupCollections(t *testing.T, env *TestEnv) {
	ctx := context.Background()
	collections := []string{"notes", "chunks", "channel_settings"}

	for _, name := range collections {
		_, err := env.Database.Collection(name).DeleteMany(ctx, bson.M{})
		if err != nil {
			t.Logf("Warning: Failed to clean collection %s: %v", name, err)
		}
	}
}

// HTTPRequest performs an HTTP request and returns the response
func HTTPRequest(t *testing.T, env *TestEnv, method, path string, body interface{}) *httptest.ResponseRecorder {
	var reqBody io.Reader
	if body != nil {
		jsonBody, err := json.Marshal(body)
		if err != nil {
			t.Fatalf("Failed to marshal request body: %v", err)
		}
		reqBody = bytes.NewBuffer(jsonBody)
	}

	req, err := http.NewRequest(method, path, reqBody)
	if err != nil {
		t.Fatalf("Failed to create request: %v", err)
	}
	req.Header.Set("Content-Type", "application/json")

	w := httptest.NewRecorder()
	env.Router.ServeHTTP(w, req)

	return w
}

// ParseResponse parses JSON response body
func ParseResponse(t *testing.T, w *httptest.ResponseRecorder, v interface{}) {
	if err := json.Unmarshal(w.Body.Bytes(), v); err != nil {
		t.Fatalf("Failed to parse response: %v (body: %s)", err, w.Body.String())
	}
}

// CreateTestNote creates a note for testing and returns its ID
func CreateTestNote(t *testing.T, env *TestEnv, content string, metadata map[string]interface{}) primitive.ObjectID {
	note := models.Note{
		Content:  content,
		Title:    "Test Note",
		Category: "other",
		Created:  time.Now(),
		Metadata: metadata,
	}

	ctx := context.Background()
	result, err := env.Database.Collection("notes").InsertOne(ctx, note)
	if err != nil {
		t.Fatalf("Failed to create test note: %v", err)
	}

	return result.InsertedID.(primitive.ObjectID)
}

// CreateTestChannelSettings creates channel settings for testing
func CreateTestChannelSettings(t *testing.T, env *TestEnv, channelName, platform string) {
	settings := models.ChannelSettings{
		ChannelName:  channelName,
		Platform:     platform,
		PromptText:   "Test prompt",
		PromptSchema: `{"summary": "string"}`,
		UpdatedAt:    time.Now(),
	}

	ctx := context.Background()
	_, err := env.Database.Collection("channel_settings").InsertOne(ctx, settings)
	if err != nil {
		t.Fatalf("Failed to create test channel settings: %v", err)
	}
}

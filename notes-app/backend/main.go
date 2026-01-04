package main

import (
	"context"
	"log"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"

	"backend/internal/ai"
	"backend/internal/config"
	"backend/internal/handlers"
	"backend/internal/repository"
	"backend/internal/services"
	"backend/internal/vectordb"
)

func main() {
	// Load configuration
	cfg := config.LoadConfig()
	if cfg.GeminiAPIKey == "" {
		log.Fatal("GEMINI_API_KEY environment variable is required")
	}

	// Initialize MongoDB client and repositories
	mongoClient, err := repository.NewMongoClient(context.TODO(), cfg.MongoURI, "notesdb")
	if err != nil {
		log.Fatal("Failed to connect to MongoDB:", err)
	}
	defer mongoClient.Close(context.TODO())

	notesRepo := repository.NewNotesRepository(mongoClient.GetDatabase())
	chunksRepo := repository.NewChunksRepository(mongoClient.GetDatabase())
	channelSettingsRepo := repository.NewChannelSettingsRepository(mongoClient.GetDatabase())

	// Initialize Qdrant vector database client
	qdrantClient, err := vectordb.NewQdrantClient(cfg.QdrantURL)
	if err != nil {
		log.Fatal("Failed to connect to Qdrant:", err)
	}
	defer qdrantClient.Close()

	if err := qdrantClient.Initialize(); err != nil {
		log.Fatal("Failed to initialize Qdrant:", err)
	}

	// Initialize AI client
	aiClient, err := ai.NewAIClient(context.Background(), cfg.GeminiAPIKey)
	if err != nil {
		log.Fatal("Failed to create AI client:", err)
	}
	defer aiClient.Close()

	// Initialize worker pool for background embedding generation
	workerPool := services.NewWorkerPool(3, 100, chunksRepo, aiClient, qdrantClient)
	workerPool.Start()
	defer workerPool.Stop()

	// Create services
	notesService := services.NewNotesService(
		notesRepo,
		chunksRepo,
		channelSettingsRepo,
		aiClient,
		qdrantClient,
		workerPool,
	)

	searchService := services.NewSearchService(
		notesRepo,
		aiClient,
		qdrantClient,
	)

	summaryService := services.NewSummaryService(
		notesRepo,
		channelSettingsRepo,
		aiClient,
	)

	// Create handlers
	notesHandler := handlers.NewNotesHandler(notesService)
	searchHandler := handlers.NewSearchHandler(searchService, aiClient)
	categoriesHandler := handlers.NewCategoriesHandler(notesRepo, aiClient)
	summaryHandler := handlers.NewSummaryHandler(summaryService)
	channelsHandler := handlers.NewChannelsHandler(
		notesRepo,
		chunksRepo,
		channelSettingsRepo,
		qdrantClient,
	)

	// Configure Gin router
	r := gin.Default()

	r.Use(cors.New(cors.Config{
		AllowAllOrigins:  true,
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Content-Length", "Accept-Encoding", "X-CSRF-Token", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: false,
		MaxAge:           12 * time.Hour,
	}))

	// Register routes
	notesHandler.RegisterRoutes(r)
	searchHandler.RegisterRoutes(r)
	categoriesHandler.RegisterRoutes(r)
	summaryHandler.RegisterRoutes(r)
	channelsHandler.RegisterRoutes(r)

	// Start server
	log.Println("Server starting on :8080")
	r.Run(":8080")
}

package handlers

import (
	"context"
	"log"
	"net/http"

	"backend/internal/ai"
	"backend/internal/config"
	"backend/internal/models"
	"backend/internal/repository"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
)

// CategoriesHandler handles HTTP requests for category operations
type CategoriesHandler struct {
	notesRepo *repository.NotesRepository
	aiClient  *ai.AIClient
}

// NewCategoriesHandler creates a new CategoriesHandler
func NewCategoriesHandler(notesRepo *repository.NotesRepository, aiClient *ai.AIClient) *CategoriesHandler {
	return &CategoriesHandler{
		notesRepo: notesRepo,
		aiClient:  aiClient,
	}
}

// GetCategories handles GET /categories
func (h *CategoriesHandler) GetCategories(c *gin.Context) {
	pipeline := mongo.Pipeline{
		{{Key: "$group", Value: bson.M{
			"_id":   "$category",
			"count": bson.M{"$sum": 1},
		}}},
		{{Key: "$sort", Value: bson.M{"count": -1}}},
	}

	cursor, err := h.notesRepo.Aggregate(context.Background(), pipeline)
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

// GetNotesByCategory handles GET /notes/category/:category
func (h *CategoriesHandler) GetNotesByCategory(c *gin.Context) {
	category := c.Param("category")

	// Validate category
	if !config.IsValidCategory(category) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid category"})
		return
	}

	notes, err := h.notesRepo.FindByCategory(context.Background(), category)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch notes"})
		return
	}

	c.JSON(http.StatusOK, notes)
}

// GetCategoryStats handles GET /categories/stats
func (h *CategoriesHandler) GetCategoryStats(c *gin.Context) {
	pipeline := mongo.Pipeline{
		{{Key: "$group", Value: bson.M{
			"_id":   "$category",
			"count": bson.M{"$sum": 1},
		}}},
		{{Key: "$sort", Value: bson.M{"count": -1}}},
	}

	cursor, err := h.notesRepo.Aggregate(context.Background(), pipeline)
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

// ClassifyExistingNotes handles POST /migrate/classify
func (h *CategoriesHandler) ClassifyExistingNotes(c *gin.Context) {
	// Find notes without category or with empty category
	notes, err := h.notesRepo.FindAll(context.Background(), bson.M{
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
		category, err := h.aiClient.ClassifyNote(note.Title, note.Content)
		if err != nil {
			log.Printf("Failed to classify note %s: %v", note.ID.Hex(), err)
			category = "other"
			errors++
		}

		err = h.notesRepo.Update(
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

// RegisterRoutes registers the category routes on the given router
func (h *CategoriesHandler) RegisterRoutes(r *gin.Engine) {
	r.GET("/categories", h.GetCategories)
	r.GET("/notes/category/:category", h.GetNotesByCategory)
	r.GET("/categories/stats", h.GetCategoryStats)
	r.POST("/migrate/classify", h.ClassifyExistingNotes)
}

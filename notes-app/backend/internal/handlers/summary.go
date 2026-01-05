package handlers

import (
	"log"
	"net/http"

	"backend/internal/models"
	"backend/internal/services"

	"github.com/gin-gonic/gin"
)

// SummaryHandler handles HTTP requests for summary operations
type SummaryHandler struct {
	summaryService *services.SummaryService
}

// NewSummaryHandler creates a new SummaryHandler
func NewSummaryHandler(summaryService *services.SummaryService) *SummaryHandler {
	return &SummaryHandler{
		summaryService: summaryService,
	}
}

// SummarizeNote handles POST /summarize
func (h *SummaryHandler) SummarizeNote(c *gin.Context) {
	var req models.SummarizeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	result, err := h.summaryService.GenerateSummary(c.Request.Context(), &services.GenerateSummaryRequest{
		NoteID:  req.NoteId,
		Content: req.Content,
	})
	if err != nil {
		log.Printf("Error generating summary: %v", err)
		if err.Error() == "invalid note ID: encoding/hex: invalid byte: U+0069 'i'" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid note ID"})
			return
		}
		if err.Error() == "note not found: mongo: no documents in result" {
			c.JSON(http.StatusNotFound, gin.H{"error": "Note not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate summary"})
		return
	}

	c.JSON(http.StatusOK, result)
}

// SummarizeNoteById handles POST /summarize/:id
func (h *SummaryHandler) SummarizeNoteById(c *gin.Context) {
	noteID := c.Param("id")

	// Parse optional request body for prompt overrides
	var req struct {
		PromptText   string `json:"promptText"`
		PromptSchema string `json:"promptSchema"`
	}
	c.ShouldBindJSON(&req) // Ignore error - body is optional

	result, err := h.summaryService.GenerateSummaryByID(
		c.Request.Context(),
		noteID,
		req.PromptText,
		req.PromptSchema,
	)
	if err != nil {
		if err.Error() == "invalid note ID: encoding/hex: invalid byte: U+0069 'i'" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid note ID"})
			return
		}
		if err.Error() == "note not found: mongo: no documents in result" {
			c.JSON(http.StatusNotFound, gin.H{"error": "Note not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate summary"})
		return
	}

	c.JSON(http.StatusOK, result)
}

// RegenerateAllTitles handles POST /migrate/titles
func (h *SummaryHandler) RegenerateAllTitles(c *gin.Context) {
	result, err := h.summaryService.RegenerateAllTitles(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":     "Title regeneration complete",
		"regenerated": result.Regenerated,
		"errors":      result.Errors,
		"total":       result.Total,
	})
}

// RegisterRoutes registers the summary routes on the given router
func (h *SummaryHandler) RegisterRoutes(r *gin.Engine) {
	r.POST("/summarize", h.SummarizeNote)
	r.POST("/summarize/:id", h.SummarizeNoteById)
	r.POST("/migrate/titles", h.RegenerateAllTitles)
}

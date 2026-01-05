package handlers

import (
	"net/http"

	"backend/internal/ai"
	"backend/internal/models"
	"backend/internal/services"

	"github.com/gin-gonic/gin"
)

// SearchHandler handles HTTP requests for search and Q&A operations
type SearchHandler struct {
	searchService *services.SearchService
	aiClient      ai.Client
}

// NewSearchHandler creates a new SearchHandler
func NewSearchHandler(searchService *services.SearchService, aiClient ai.Client) *SearchHandler {
	return &SearchHandler{
		searchService: searchService,
		aiClient:      aiClient,
	}
}

// SearchNotes handles POST /search
func (h *SearchHandler) SearchNotes(c *gin.Context) {
	var req models.SearchRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	results, err := h.searchService.SemanticSearch(c.Request.Context(), req.Query, req.Limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, results)
}

// AnswerQuestion handles POST /ask
func (h *SearchHandler) AnswerQuestion(c *gin.Context) {
	var req models.QuestionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	response, err := h.searchService.AnswerQuestion(c.Request.Context(), req.Question)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, response)
}

// AskAIAboutNote handles POST /ai-question
func (h *SearchHandler) AskAIAboutNote(c *gin.Context) {
	var req models.AIQuestionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	response, err := h.aiClient.AskAboutContent(req.Prompt, req.Content)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate AI response"})
		return
	}

	c.JSON(http.StatusOK, models.AIQuestionResponse{
		Response: response,
	})
}

// RegisterRoutes registers the search routes on the given router
func (h *SearchHandler) RegisterRoutes(r *gin.Engine) {
	r.POST("/search", h.SearchNotes)
	r.POST("/ask", h.AnswerQuestion)
	r.POST("/ai-question", h.AskAIAboutNote)
}

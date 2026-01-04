package handlers

import (
	"context"
	"fmt"
	"net/http"

	"backend/internal/ai"
	"backend/internal/config"
	"backend/internal/models"
	"backend/internal/services"

	"github.com/gin-gonic/gin"
	"github.com/google/generative-ai-go/genai"
)

// SearchHandler handles HTTP requests for search and Q&A operations
type SearchHandler struct {
	searchService *services.SearchService
	aiClient      *ai.AIClient
}

// NewSearchHandler creates a new SearchHandler
func NewSearchHandler(searchService *services.SearchService, aiClient *ai.AIClient) *SearchHandler {
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

	// Create a combined prompt with the user's question and the note content
	fullPrompt := fmt.Sprintf(`%s

Content to analyze:
%s`, req.Prompt, req.Content)

	// Use Gemini to generate a response
	ctx := context.Background()
	model := h.aiClient.GenerativeModel(config.GENERATION_MODEL)
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

// RegisterRoutes registers the search routes on the given router
func (h *SearchHandler) RegisterRoutes(r *gin.Engine) {
	r.POST("/search", h.SearchNotes)
	r.POST("/ask", h.AnswerQuestion)
	r.POST("/ai-question", h.AskAIAboutNote)
}

package handlers

import (
	"net/http"

	"backend/internal/models"
	"backend/internal/services"

	"github.com/gin-gonic/gin"
)

// NotesHandler handles HTTP requests for note operations
type NotesHandler struct {
	notesService *services.NotesService
}

// NewNotesHandler creates a new NotesHandler
func NewNotesHandler(notesService *services.NotesService) *NotesHandler {
	return &NotesHandler{
		notesService: notesService,
	}
}

// GetNotes handles GET /notes
func (h *NotesHandler) GetNotes(c *gin.Context) {
	channel := c.Query("channel")

	notes, err := h.notesService.GetNotes(c.Request.Context(), channel)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, notes)
}

// CreateNote handles POST /notes
func (h *NotesHandler) CreateNote(c *gin.Context) {
	var req models.CreateNoteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	result, err := h.notesService.CreateNote(c.Request.Context(), &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if result.Duplicate {
		c.JSON(http.StatusConflict, gin.H{"error": "duplicate", "url": result.URL})
		return
	}

	c.JSON(http.StatusCreated, result.Note)
}

// UpdateNote handles PUT /notes/:id
func (h *NotesHandler) UpdateNote(c *gin.Context) {
	noteID := c.Param("id")

	var req models.UpdateNoteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	updatedNote, err := h.notesService.UpdateNote(c.Request.Context(), noteID, &req)
	if err != nil {
		if err.Error() == "invalid note ID: encoding/hex: invalid byte: U+0069 'i'" ||
			err.Error() == "note not found" {
			c.JSON(http.StatusNotFound, gin.H{"error": "Note not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update note"})
		return
	}

	c.JSON(http.StatusOK, *updatedNote)
}

// DeleteNote handles DELETE /notes/:id
func (h *NotesHandler) DeleteNote(c *gin.Context) {
	noteID := c.Param("id")

	err := h.notesService.DeleteNote(c.Request.Context(), noteID)
	if err != nil {
		if err.Error() == "invalid note ID: encoding/hex: invalid byte: U+0069 'i'" ||
			err.Error() == "note not found" {
			c.JSON(http.StatusNotFound, gin.H{"error": "Note not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete note"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Note deleted successfully"})
}

// RegisterRoutes registers the note routes on the given router
func (h *NotesHandler) RegisterRoutes(r *gin.Engine) {
	r.GET("/notes", h.GetNotes)
	r.POST("/notes", h.CreateNote)
	r.PUT("/notes/:id", h.UpdateNote)
	r.DELETE("/notes/:id", h.DeleteNote)
}

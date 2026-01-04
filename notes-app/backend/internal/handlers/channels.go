package handlers

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"time"

	"backend/internal/models"
	"backend/internal/repository"
	"backend/internal/vectordb"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
)

// ChannelsHandler handles HTTP requests for channel operations
type ChannelsHandler struct {
	notesRepo           *repository.NotesRepository
	chunksRepo          *repository.ChunksRepository
	channelSettingsRepo *repository.ChannelSettingsRepository
	qdrantClient        *vectordb.QdrantClient
}

// NewChannelsHandler creates a new ChannelsHandler
func NewChannelsHandler(
	notesRepo *repository.NotesRepository,
	chunksRepo *repository.ChunksRepository,
	channelSettingsRepo *repository.ChannelSettingsRepository,
	qdrantClient *vectordb.QdrantClient,
) *ChannelsHandler {
	return &ChannelsHandler{
		notesRepo:           notesRepo,
		chunksRepo:          chunksRepo,
		channelSettingsRepo: channelSettingsRepo,
		qdrantClient:        qdrantClient,
	}
}

// GetChannelsWithNotes handles GET /channels
func (h *ChannelsHandler) GetChannelsWithNotes(c *gin.Context) {
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

	cursor, err := h.notesRepo.Aggregate(context.Background(), pipeline)
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

// GetAllChannelSettings handles GET /channel-settings
func (h *ChannelsHandler) GetAllChannelSettings(c *gin.Context) {
	settings, err := h.channelSettingsRepo.FindAll(context.Background())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get channel settings"})
		return
	}

	c.JSON(http.StatusOK, settings)
}

// GetChannelSettings handles GET /channel-settings/:channel
func (h *ChannelsHandler) GetChannelSettings(c *gin.Context) {
	channelName := c.Param("channel")

	settings, err := h.channelSettingsRepo.FindByName(context.Background(), channelName)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get settings"})
		return
	}

	if settings == nil {
		// Return default settings if not found
		c.JSON(http.StatusOK, models.ChannelSettings{
			ChannelName:  channelName,
			ChannelUrl:   "",
			PromptText:   "",
			PromptSchema: "",
		})
		return
	}

	c.JSON(http.StatusOK, *settings)
}

// UpdateChannelSettings handles PUT /channel-settings/:channel
func (h *ChannelsHandler) UpdateChannelSettings(c *gin.Context) {
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
	err := h.channelSettingsRepo.Upsert(context.Background(), &settings)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save settings"})
		return
	}

	c.JSON(http.StatusOK, settings)
}

// DeleteChannelSettings handles DELETE /channel-settings/:channel
func (h *ChannelsHandler) DeleteChannelSettings(c *gin.Context) {
	channelName := c.Param("channel")

	log.Printf("Deleting channel settings for: %s", channelName)

	deletedCount, err := h.channelSettingsRepo.Delete(context.Background(), channelName)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete settings"})
		return
	}

	if deletedCount == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Settings not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Settings deleted"})
}

// DeleteChannelNotes handles DELETE /channels/:channel/notes
func (h *ChannelsHandler) DeleteChannelNotes(c *gin.Context) {
	channelName := c.Param("channel")

	log.Printf("Deleting all notes for channel: %s", channelName)

	// Find all notes for this channel
	notes, err := h.notesRepo.FindAll(context.Background(), bson.M{"metadata.author": channelName})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to find notes"})
		return
	}

	deletedNotes := 0
	deletedChunks := 0

	// Delete each note and its associated chunks/embeddings
	for _, note := range notes {
		// Delete chunks for this note
		chunkCount, err := h.chunksRepo.DeleteByNoteID(context.Background(), note.ID)
		if err != nil {
			log.Printf("Error deleting chunks for note %s: %v", note.ID.Hex(), err)
		} else {
			deletedChunks += int(chunkCount)
		}

		// Delete embeddings from Qdrant
		_, err = h.qdrantClient.DeleteByNoteID(note.ID)
		if err != nil {
			log.Printf("Error deleting embeddings for note %s: %v", note.ID.Hex(), err)
		}

		// Delete the note
		err = h.notesRepo.Delete(context.Background(), note.ID)
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

// RegisterRoutes registers the channel routes on the given router
func (h *ChannelsHandler) RegisterRoutes(r *gin.Engine) {
	r.GET("/channels", h.GetChannelsWithNotes)
	r.GET("/channel-settings", h.GetAllChannelSettings)
	r.GET("/channel-settings/:channel", h.GetChannelSettings)
	r.PUT("/channel-settings/:channel", h.UpdateChannelSettings)
	r.DELETE("/channel-settings/:channel", h.DeleteChannelSettings)
	r.DELETE("/channels/:channel/notes", h.DeleteChannelNotes)
}

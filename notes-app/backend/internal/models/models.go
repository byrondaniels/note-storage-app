package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
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
	Answer   string         `json:"answer"`
	Sources  []SearchResult `json:"sources"`
	Question string         `json:"question"`
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

type CreateNoteRequest struct {
	Content  string                 `json:"content" binding:"required"`
	Title    string                 `json:"title,omitempty"`    // Optional, will be auto-generated if empty
	Metadata map[string]interface{} `json:"metadata"`           // Optional, for social media metadata
}

type UpdateNoteRequest struct {
	Content string `json:"content" binding:"required"`
}

type CategoryCount struct {
	Name  string `json:"name"`
	Count int    `json:"count"`
}

package repository

import (
	"context"

	"backend/internal/models"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

// ChunksRepository provides database operations for note chunks
type ChunksRepository struct {
	collection *mongo.Collection
}

// NewChunksRepository creates a new ChunksRepository
func NewChunksRepository(db *mongo.Database) *ChunksRepository {
	return &ChunksRepository{
		collection: db.Collection("chunks"),
	}
}

// Create inserts a new chunk and returns the inserted ID
func (r *ChunksRepository) Create(ctx context.Context, chunk *models.NoteChunk) (primitive.ObjectID, error) {
	result, err := r.collection.InsertOne(ctx, chunk)
	if err != nil {
		return primitive.NilObjectID, err
	}
	return result.InsertedID.(primitive.ObjectID), nil
}

// DeleteByNoteID removes all chunks associated with a note
func (r *ChunksRepository) DeleteByNoteID(ctx context.Context, noteID primitive.ObjectID) (int64, error) {
	result, err := r.collection.DeleteMany(ctx, bson.M{"note_id": noteID})
	if err != nil {
		return 0, err
	}
	return result.DeletedCount, nil
}

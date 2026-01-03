package repository

import (
	"context"

	"backend/internal/models"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// NotesRepository provides database operations for notes
type NotesRepository struct {
	collection *mongo.Collection
}

// NewNotesRepository creates a new NotesRepository
func NewNotesRepository(db *mongo.Database) *NotesRepository {
	return &NotesRepository{
		collection: db.Collection("notes"),
	}
}

// FindAll retrieves notes matching the given filter
func (r *NotesRepository) FindAll(ctx context.Context, filter bson.M, opts ...*options.FindOptions) ([]models.Note, error) {
	cursor, err := r.collection.Find(ctx, filter, opts...)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var notes []models.Note
	if err = cursor.All(ctx, &notes); err != nil {
		return nil, err
	}

	if notes == nil {
		notes = []models.Note{}
	}

	return notes, nil
}

// FindByID retrieves a single note by its ID
func (r *NotesRepository) FindByID(ctx context.Context, id primitive.ObjectID) (*models.Note, error) {
	var note models.Note
	err := r.collection.FindOne(ctx, bson.M{"_id": id}).Decode(&note)
	if err != nil {
		return nil, err
	}
	return &note, nil
}

// FindByCategory retrieves all notes with the given category, sorted by created date (newest first)
func (r *NotesRepository) FindByCategory(ctx context.Context, category string) ([]models.Note, error) {
	opts := options.Find().SetSort(bson.M{"created": -1})
	return r.FindAll(ctx, bson.M{"category": category}, opts)
}

// FindByURL retrieves a note by its metadata URL
func (r *NotesRepository) FindByURL(ctx context.Context, url string) (*models.Note, error) {
	var note models.Note
	err := r.collection.FindOne(ctx, bson.M{"metadata.url": url}).Decode(&note)
	if err != nil {
		return nil, err
	}
	return &note, nil
}

// ExistsByURL checks if a note with the given URL already exists
func (r *NotesRepository) ExistsByURL(ctx context.Context, url string) (bool, error) {
	if url == "" {
		return false, nil
	}

	count, err := r.collection.CountDocuments(ctx, bson.M{"metadata.url": url})
	if err != nil {
		return false, err
	}

	return count > 0, nil
}

// Create inserts a new note and returns the inserted ID
func (r *NotesRepository) Create(ctx context.Context, note *models.Note) (primitive.ObjectID, error) {
	result, err := r.collection.InsertOne(ctx, note)
	if err != nil {
		return primitive.NilObjectID, err
	}
	return result.InsertedID.(primitive.ObjectID), nil
}

// Update modifies a note with the given update document
func (r *NotesRepository) Update(ctx context.Context, id primitive.ObjectID, update bson.M) error {
	_, err := r.collection.UpdateOne(ctx, bson.M{"_id": id}, update)
	return err
}

// Delete removes a note by its ID
func (r *NotesRepository) Delete(ctx context.Context, id primitive.ObjectID) error {
	_, err := r.collection.DeleteOne(ctx, bson.M{"_id": id})
	return err
}

// DeleteByAuthor deletes all notes for a given author/channel
func (r *NotesRepository) DeleteByAuthor(ctx context.Context, author string) (int64, error) {
	result, err := r.collection.DeleteMany(ctx, bson.M{"metadata.author": author})
	if err != nil {
		return 0, err
	}
	return result.DeletedCount, nil
}

// Aggregate runs an aggregation pipeline on the notes collection
func (r *NotesRepository) Aggregate(ctx context.Context, pipeline mongo.Pipeline) (*mongo.Cursor, error) {
	return r.collection.Aggregate(ctx, pipeline)
}

// Collection returns the underlying mongo collection for advanced operations
func (r *NotesRepository) Collection() *mongo.Collection {
	return r.collection
}

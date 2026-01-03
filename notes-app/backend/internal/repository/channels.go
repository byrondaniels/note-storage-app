package repository

import (
	"context"

	"backend/internal/models"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// ChannelSettingsRepository provides database operations for channel settings
type ChannelSettingsRepository struct {
	collection *mongo.Collection
}

// NewChannelSettingsRepository creates a new ChannelSettingsRepository
func NewChannelSettingsRepository(db *mongo.Database) *ChannelSettingsRepository {
	return &ChannelSettingsRepository{
		collection: db.Collection("channel_settings"),
	}
}

// FindByName retrieves channel settings by channel name
// Returns nil if not found (no error for ErrNoDocuments)
func (r *ChannelSettingsRepository) FindByName(ctx context.Context, channelName string) (*models.ChannelSettings, error) {
	var settings models.ChannelSettings
	err := r.collection.FindOne(ctx, bson.M{"channel_name": channelName}).Decode(&settings)
	if err == mongo.ErrNoDocuments {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &settings, nil
}

// FindAll retrieves all channel settings
func (r *ChannelSettingsRepository) FindAll(ctx context.Context) ([]models.ChannelSettings, error) {
	cursor, err := r.collection.Find(ctx, bson.M{})
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var settings []models.ChannelSettings
	if err = cursor.All(ctx, &settings); err != nil {
		return nil, err
	}

	if settings == nil {
		settings = []models.ChannelSettings{}
	}

	return settings, nil
}

// Upsert creates or updates channel settings by channel name
func (r *ChannelSettingsRepository) Upsert(ctx context.Context, settings *models.ChannelSettings) error {
	opts := options.Update().SetUpsert(true)
	_, err := r.collection.UpdateOne(
		ctx,
		bson.M{"channel_name": settings.ChannelName},
		bson.M{"$set": settings},
		opts,
	)
	return err
}

// Delete removes channel settings by channel name
// Returns the number of deleted documents
func (r *ChannelSettingsRepository) Delete(ctx context.Context, channelName string) (int64, error) {
	result, err := r.collection.DeleteOne(ctx, bson.M{"channel_name": channelName})
	if err != nil {
		return 0, err
	}
	return result.DeletedCount, nil
}

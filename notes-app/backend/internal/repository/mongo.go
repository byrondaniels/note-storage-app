package repository

import (
	"context"
	"fmt"

	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// MongoClient wraps the MongoDB client and provides access to collections
type MongoClient struct {
	client *mongo.Client
	db     *mongo.Database
}

// NewMongoClient creates a new MongoDB client connection
func NewMongoClient(ctx context.Context, uri, dbName string) (*MongoClient, error) {
	client, err := mongo.Connect(ctx, options.Client().ApplyURI(uri))
	if err != nil {
		return nil, fmt.Errorf("failed to connect to MongoDB: %w", err)
	}

	// Ping to verify connection
	if err := client.Ping(ctx, nil); err != nil {
		return nil, fmt.Errorf("failed to ping MongoDB: %w", err)
	}

	return &MongoClient{
		client: client,
		db:     client.Database(dbName),
	}, nil
}

// Close closes the MongoDB connection
func (m *MongoClient) Close(ctx context.Context) error {
	return m.client.Disconnect(ctx)
}

// NotesCollection returns the notes collection
func (m *MongoClient) NotesCollection() *mongo.Collection {
	return m.db.Collection("notes")
}

// ChunksCollection returns the chunks collection
func (m *MongoClient) ChunksCollection() *mongo.Collection {
	return m.db.Collection("chunks")
}

// ChannelSettingsCollection returns the channel settings collection
func (m *MongoClient) ChannelSettingsCollection() *mongo.Collection {
	return m.db.Collection("channel_settings")
}

// GetDatabase returns the underlying database
func (m *MongoClient) GetDatabase() *mongo.Database {
	return m.db
}

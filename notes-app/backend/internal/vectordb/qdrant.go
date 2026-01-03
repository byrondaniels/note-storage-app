package vectordb

import (
	"context"
	"fmt"
	"log"
	"time"

	"backend/internal/config"

	pb "github.com/qdrant/go-client/qdrant"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
)

// VectorSearchResult represents a search result from Qdrant
type VectorSearchResult struct {
	ChunkID string
	NoteID  string
	Score   float32
}

// QdrantClient provides vector database operations
type QdrantClient struct {
	conn              *grpc.ClientConn
	collectionsClient pb.CollectionsClient
	pointsClient      pb.PointsClient
}

// NewQdrantClient creates a new QdrantClient and establishes connection
func NewQdrantClient(url string) (*QdrantClient, error) {
	conn, err := grpc.Dial(url, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		return nil, fmt.Errorf("failed to connect to Qdrant: %w", err)
	}

	return &QdrantClient{
		conn:              conn,
		collectionsClient: pb.NewCollectionsClient(conn),
		pointsClient:      pb.NewPointsClient(conn),
	}, nil
}

// Close closes the gRPC connection
func (q *QdrantClient) Close() error {
	if q.conn != nil {
		return q.conn.Close()
	}
	return nil
}

// Initialize creates the Qdrant collection if it doesn't exist
func (q *QdrantClient) Initialize() error {
	ctx := context.Background()

	collections, err := q.collectionsClient.List(ctx, &pb.ListCollectionsRequest{})
	if err != nil {
		return fmt.Errorf("failed to list collections: %w", err)
	}

	collectionExists := false
	for _, collection := range collections.Collections {
		if collection.Name == config.COLLECTION_NAME {
			collectionExists = true
			break
		}
	}

	if !collectionExists {
		log.Printf("Creating Qdrant collection: %s", config.COLLECTION_NAME)
		_, err := q.collectionsClient.Create(ctx, &pb.CreateCollection{
			CollectionName: config.COLLECTION_NAME,
			VectorsConfig: &pb.VectorsConfig{
				Config: &pb.VectorsConfig_Params{
					Params: &pb.VectorParams{
						Size:     config.EMBEDDING_DIM,
						Distance: pb.Distance_Cosine,
					},
				},
			},
		})
		if err != nil {
			return fmt.Errorf("failed to create collection: %w", err)
		}
	}

	return nil
}

// StoreEmbedding stores an embedding in Qdrant with chunk and note references
func (q *QdrantClient) StoreEmbedding(chunkID, noteID primitive.ObjectID, embedding []float32) error {
	ctx := context.Background()

	point := &pb.PointStruct{
		Id: &pb.PointId{
			PointIdOptions: &pb.PointId_Num{
				Num: uint64(time.Now().UnixNano()), // Use timestamp as unique ID
			},
		},
		Vectors: &pb.Vectors{
			VectorsOptions: &pb.Vectors_Vector{
				Vector: &pb.Vector{Data: embedding},
			},
		},
		Payload: map[string]*pb.Value{
			"chunk_id": {Kind: &pb.Value_StringValue{StringValue: chunkID.Hex()}},
			"note_id":  {Kind: &pb.Value_StringValue{StringValue: noteID.Hex()}},
		},
	}

	_, err := q.pointsClient.Upsert(ctx, &pb.UpsertPoints{
		CollectionName: config.COLLECTION_NAME,
		Points:         []*pb.PointStruct{point},
	})

	return err
}

// Search performs a vector similarity search and returns matching results
func (q *QdrantClient) Search(vector []float32, limit int) ([]VectorSearchResult, error) {
	ctx := context.Background()

	searchResult, err := q.pointsClient.Search(ctx, &pb.SearchPoints{
		CollectionName: config.COLLECTION_NAME,
		Vector:         vector,
		Limit:          uint64(limit),
		WithPayload:    &pb.WithPayloadSelector{SelectorOptions: &pb.WithPayloadSelector_Enable{Enable: true}},
	})
	if err != nil {
		return nil, fmt.Errorf("search failed: %w", err)
	}

	var results []VectorSearchResult
	for _, point := range searchResult.Result {
		results = append(results, VectorSearchResult{
			ChunkID: point.Payload["chunk_id"].GetStringValue(),
			NoteID:  point.Payload["note_id"].GetStringValue(),
			Score:   point.Score,
		})
	}

	return results, nil
}

// DeleteByNoteID removes all embeddings associated with a note
func (q *QdrantClient) DeleteByNoteID(noteID primitive.ObjectID) (int, error) {
	ctx := context.Background()

	// Use a filter to find and delete points with matching note_id
	result, err := q.pointsClient.Delete(ctx, &pb.DeletePoints{
		CollectionName: config.COLLECTION_NAME,
		Points: &pb.PointsSelector{
			PointsSelectorOneOf: &pb.PointsSelector_Filter{
				Filter: &pb.Filter{
					Must: []*pb.Condition{
						{
							ConditionOneOf: &pb.Condition_Field{
								Field: &pb.FieldCondition{
									Key: "note_id",
									Match: &pb.Match{
										MatchValue: &pb.Match_Keyword{
											Keyword: noteID.Hex(),
										},
									},
								},
							},
						},
					},
				},
			},
		},
	})
	if err != nil {
		return 0, fmt.Errorf("failed to delete embeddings: %w", err)
	}

	// Qdrant delete doesn't return count directly, but operation succeeded
	_ = result
	return 0, nil // We can't get exact count from Qdrant delete response
}

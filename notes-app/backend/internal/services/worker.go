package services

import (
	"context"
	"log"
	"strings"
	"sync"

	"backend/internal/ai"
	"backend/internal/config"
	"backend/internal/models"
	"backend/internal/repository"
	"backend/internal/utils"
	"backend/internal/vectordb"
)

// WorkerPool manages background job processing for note embeddings
type WorkerPool struct {
	jobQueue     chan models.ProcessingJob
	workerCount  int
	wg           sync.WaitGroup
	chunksRepo   *repository.ChunksRepository
	aiClient     *ai.AIClient
	qdrantClient *vectordb.QdrantClient
}

// NewWorkerPool creates a new WorkerPool with the specified number of workers
func NewWorkerPool(
	workerCount int,
	queueSize int,
	chunksRepo *repository.ChunksRepository,
	aiClient *ai.AIClient,
	qdrantClient *vectordb.QdrantClient,
) *WorkerPool {
	return &WorkerPool{
		jobQueue:     make(chan models.ProcessingJob, queueSize),
		workerCount:  workerCount,
		chunksRepo:   chunksRepo,
		aiClient:     aiClient,
		qdrantClient: qdrantClient,
	}
}

// Start launches the worker goroutines
func (wp *WorkerPool) Start() {
	for i := 0; i < wp.workerCount; i++ {
		wp.wg.Add(1)
		go wp.worker()
	}
	log.Printf("Started %d background workers", wp.workerCount)
}

// Stop gracefully shuts down the worker pool
func (wp *WorkerPool) Stop() {
	close(wp.jobQueue)
	wp.wg.Wait()
	log.Println("All background workers stopped")
}

// Submit adds a job to the queue
// Returns true if the job was queued, false if the queue is full
func (wp *WorkerPool) Submit(job models.ProcessingJob) bool {
	select {
	case wp.jobQueue <- job:
		log.Printf("Queued embedding job for note: %s", job.NoteID.Hex())
		return true
	default:
		log.Printf("Job queue full, skipping embedding for note: %s", job.NoteID.Hex())
		return false
	}
}

// worker processes jobs from the queue
func (wp *WorkerPool) worker() {
	defer wp.wg.Done()

	for job := range wp.jobQueue {
		if err := wp.processJob(job); err != nil {
			log.Printf("Error processing job for note %s: %v", job.NoteID.Hex(), err)
		}
	}
}

// processJob handles the embedding generation for a single note
func (wp *WorkerPool) processJob(job models.ProcessingJob) error {
	// Note: Title, category, and summary are now generated during createNote()
	// This job only handles embedding generation

	fullText := job.Title + "\n\n" + job.Content

	// Skip embedding if sensitive data detected
	if utils.ContainsSensitiveData(fullText) {
		log.Printf("Skipping embedding for note %s: Sensitive data detected (API keys, passwords, etc.)", job.NoteID.Hex())
		return nil // Not an error, just skip embedding for security
	}

	words := strings.Fields(fullText)

	if len(words) > config.MAX_WORDS {
		words = words[:config.MAX_WORDS]
		fullText = strings.Join(words, " ")
	}

	chunks := utils.ChunkText(fullText, config.CHUNK_SIZE)

	for i, chunk := range chunks {
		chunkDoc := models.NoteChunk{
			NoteID:   job.NoteID,
			Content:  chunk,
			ChunkIdx: i,
		}

		chunkID, err := wp.chunksRepo.Create(context.Background(), &chunkDoc)
		if err != nil {
			log.Printf("Error saving chunk: %v", err)
			continue
		}

		embedding, err := wp.aiClient.GenerateEmbedding(chunk)
		if err != nil {
			log.Printf("Error generating embedding: %v", err)
			continue
		}

		if err := wp.qdrantClient.StoreEmbedding(chunkID, job.NoteID, embedding); err != nil {
			log.Printf("Error storing embedding: %v", err)
		}
	}

	return nil
}

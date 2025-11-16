# Notes App

An intelligent notes application with Vue.js frontend and Golang backend, featuring AI-powered semantic search using Google Gemini embeddings and Qdrant vector database.

## Features

- Upload notes with title and content (up to 10,000 words)
- View all saved notes
- **AI-powered semantic search** using natural language queries
- Automatic text chunking and embedding generation
- Async job processing for embeddings
- Vector similarity search with relevance scoring
- Fully containerized with Docker

## Getting Started

### Prerequisites

- Docker and Docker Compose installed on your system
- Google Gemini API key (free tier available)

### Setup

1. Clone this repository
2. Navigate to the project directory:
   ```bash
   cd notes-app
   ```

3. Copy the environment file and add your Gemini API key:
   ```bash
   cp .env.example .env
   ```
   Edit `.env` and add your Gemini API key:
   ```
   GEMINI_API_KEY=your_actual_gemini_api_key_here
   ```

4. Start all services using Docker Compose:
   ```bash
   docker-compose up --build
   ```

5. Access the application:
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:8080
   - Qdrant Dashboard: http://localhost:6333/dashboard

### Services

- **Frontend**: Vue.js application served on port 3000
- **Backend**: Golang REST API on port 8080 with async workers
- **Database**: MongoDB on port 27017
- **Vector DB**: Qdrant on ports 6333 (HTTP) and 6334 (gRPC)

### API Endpoints

- `GET /notes` - Retrieve all notes
- `POST /notes` - Create a new note (triggers async embedding job)
- `POST /search` - Semantic search using natural language queries

### How It Works

1. **Note Creation**: When you create a note, it's saved to MongoDB and an async job is queued
2. **Text Processing**: The async worker chunks the note text (max 10,000 words) into 1,000-word segments
3. **Embedding Generation**: Each chunk is sent to Google Gemini to generate embeddings using the text-embedding-004 model
4. **Vector Storage**: Embeddings are stored in Qdrant with references to the original note
5. **Semantic Search**: Search queries are embedded and matched against stored vectors using cosine similarity

### Project Structure

```
notes-app/
├── frontend/           # Vue.js frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── UploadNotes.vue
│   │   │   ├── ViewNotes.vue
│   │   │   └── SearchNotes.vue
│   │   ├── App.vue
│   │   └── main.js
│   ├── Dockerfile
│   └── package.json
├── backend/            # Golang backend with AI features
│   ├── main.go         # Async workers, Gemini integration, Qdrant
│   ├── go.mod
│   └── Dockerfile
├── docker-compose.yml  # All services including Qdrant
├── .env.example        # Environment variables template
└── README.md
```

### Search Examples

Try these natural language queries:
- "machine learning algorithms"
- "recipes with chicken"
- "travel plans for Europe"
- "debugging techniques"
- "project ideas"

The semantic search understands context and meaning, not just keyword matching!

### Stopping the Application

```bash
docker-compose down
```

To remove all data:
```bash
docker-compose down -v
```
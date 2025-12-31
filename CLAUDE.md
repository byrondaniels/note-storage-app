# CLAUDE.md - AI Navigation Guide for note-storage-app

## Project Overview

A personal notes storage application with AI-powered semantic search and categorization. Consists of two main components:
1. **Notes App** - Vue.js frontend + Go backend with MongoDB and Qdrant vector database for intelligent note management
2. **Browser Extension** - Chrome extension to save social media posts (Twitter/X, LinkedIn, YouTube) directly to the notes app

**Tech Stack:**
- Frontend: Vue 3, Vue Router, Axios
- Backend: Go 1.21, Gin framework, MongoDB, Qdrant (vector DB)
- AI: Google Gemini API (embeddings + text generation)
- Infrastructure: Docker, Docker Compose, Nginx
- Extension: Chrome Manifest V3, vanilla JavaScript

**Quick Start:**
```bash
cd notes-app
cp .env.example .env  # Add your GEMINI_API_KEY
docker-compose up --build
# Frontend: http://localhost:3000
# Backend: http://localhost:8080
# Qdrant: http://localhost:6333/dashboard
```

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Browser Extension                             │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐                    │
│  │ Twitter/X │  │ LinkedIn  │  │  YouTube  │                    │
│  └─────┬─────┘  └─────┬─────┘  └─────┬─────┘                    │
│        └──────────────┴───────────────┘                         │
│                       │                                          │
│              POST /notes (with metadata)                        │
└───────────────────────┼─────────────────────────────────────────┘
                        │
                        ▼
┌───────────────────────────────────────────────────────────────────┐
│                         Notes App                                  │
│  ┌─────────────────┐         ┌──────────────────────────────────┐ │
│  │   Vue Frontend  │◄───────►│         Go Backend               │ │
│  │   (port 3000)   │  REST   │        (port 8080)               │ │
│  │                 │         │                                  │ │
│  │ - ViewNotes     │         │  ┌──────────────────────────┐   │ │
│  │ - QuestionAnswer│         │  │    Async Job Workers (3) │   │ │
│  │ - CategoryBrowser│        │  │  - Chunking              │   │ │
│  │ - SearchNotes   │         │  │  - Embedding generation  │   │ │
│  │ - UploadNotes   │         │  │  - Combined AI analysis  │   │ │
│  │ - ChannelSettings│        │  │  - Channel settings      │   │ │
│  └─────────────────┘         │  └──────────────────────────┘   │ │
│                              │              │                   │ │
│                              └──────────────┼───────────────────┘ │
└─────────────────────────────────────────────┼─────────────────────┘
                                              │
                    ┌─────────────────────────┼───────────────────┐
                    │                         │                   │
                    ▼                         ▼                   ▼
             ┌───────────┐           ┌────────────┐      ┌────────────┐
             │  MongoDB  │           │   Qdrant   │      │ Gemini API │
             │ (port     │           │  (6333/    │      │ - Embeddings│
             │  27017)   │           │   6334)    │      │ - Generation│
             │           │           │            │      │ - Classify  │
             │ - notes   │           │ - vectors  │      └────────────┘
             │ - chunks  │           │ - 768 dim  │
             │ - channel_│           └────────────┘
             │   settings│
             └───────────┘
```

**Key Design Patterns:**
- **Async Job Processing**: Note creation triggers background jobs for embedding/classification
- **Combined AI Analysis**: Single Gemini call generates title, category, and summary together
- **Chunking Strategy**: Long notes split into 1000-word chunks for embedding
- **Vector Similarity Search**: Cosine similarity with 0.3 minimum relevance threshold
- **Platform Abstraction**: Extension uses polymorphic pattern for multi-platform support
- **Channel Import**: Extension can bulk-import YouTube channel transcripts via localhost bridge

**Data Flow:**
1. User creates note (via app or extension)
2. Note saved to MongoDB immediately
3. Async worker picks up job, runs combined AI analysis (title + category + summary in one call)
4. Text chunked and embedded via Gemini text-embedding-004
5. Embeddings stored in Qdrant with note references
6. Search queries are embedded and matched against vectors

## Directory Structure

```
note-storage-app/
├── CLAUDE.md                          # This file
├── README.md                          # Root readme
├── .gitignore                         # Git ignore patterns
│
├── notes-app/                         # Main application
│   ├── README.md                      # App documentation
│   ├── docker-compose.yml             # Service orchestration
│   ├── .env.example                   # Environment template
│   ├── CATEGORIZATION_IMPLEMENTATION_PLAN.md
│   │
│   ├── backend/                       # Go backend
│   │   ├── main.go                    # Single file with all logic
│   │   ├── go.mod                     # Go dependencies
│   │   └── Dockerfile
│   │
│   └── frontend/                      # Vue.js frontend
│       ├── package.json
│       ├── vue.config.js
│       ├── Dockerfile
│       ├── nginx.conf
│       ├── public/
│       │   └── index.html
│       └── src/
│           ├── main.js                # App entry, router setup
│           ├── App.vue                # Root component
│           └── components/
│               ├── ViewNotes.vue      # Main notes interface (largest)
│               ├── ChannelSettings.vue# YouTube import & channel config
│               ├── QuestionAnswer.vue # AI Q&A interface
│               ├── SearchNotes.vue    # Semantic search
│               ├── CategoryBrowser.vue# Category navigation
│               └── UploadNotes.vue    # Note creation
│
└── tweet-saver-extension/             # Chrome extension
    ├── manifest.json                  # Extension manifest v3
    ├── README.md                      # Extension docs
    ├── INSTALLATION.md
    ├── PROJECT_SUMMARY.md
    ├── content.js                     # Main platform logic (largest)
    ├── background.js                  # Service worker, channel import
    ├── localhost-bridge.js            # Vue app ↔ extension messaging
    ├── popup.html / popup.js          # Extension popup UI
    ├── options.html / options.js      # Settings page
    ├── styles.css                     # Button styling
    └── icons/                         # Extension icons
```

## Key Files

**Entry Points:**
- `notes-app/backend/main.go:145` - Backend main(), server startup
- `notes-app/frontend/src/main.js` - Frontend entry, Vue app creation
- `tweet-saver-extension/content.js:1854-1859` - Extension initialization

**Configuration:**
- `notes-app/docker-compose.yml` - All service definitions
- `notes-app/.env.example` - Required: GEMINI_API_KEY
- `tweet-saver-extension/manifest.json` - Extension permissions/config

**Central/Frequently Modified:**
- `notes-app/backend/main.go` - All backend logic in single file (1800+ lines)
- `notes-app/frontend/src/components/ViewNotes.vue` - Main UI (2500+ lines)
- `notes-app/frontend/src/components/ChannelSettings.vue` - Import UI (1200+ lines)
- `tweet-saver-extension/content.js` - Platform detection/saving (2100+ lines)

## Code Conventions

**Naming:**
- Go: PascalCase for exported, camelCase for internal
- Vue: PascalCase components, camelCase methods/data
- JavaScript: camelCase throughout, SCREAMING_CASE for constants
- CSS: kebab-case class names

**File Organization:**
- Backend: Single main.go file (monolithic)
- Frontend: Single-file Vue components with scoped styles
- Extension: Separate files per concern (content, background, popup)

**Import Patterns:**
- Go: Standard library first, then external packages
- Vue: Vue framework imports, then axios for HTTP
- Extension: Chrome APIs via `chrome.*` globals

**Error Handling:**
- Go: Check error return values, log and return HTTP errors
- Vue: Try/catch with console.error, alert for user feedback
- Extension: Try/catch with console.log, button state feedback

## Module Map

### Backend (notes-app/backend/main.go)

**Purpose:** REST API server with AI processing capabilities

**Key Exports/Types:**
```go
type Note struct           // Main data model (line 28)
type NoteChunk struct       // Embedding chunks (line 38)
type SearchRequest struct   // Search payload (line 45)
type ProcessingJob struct   // Async job data (line 83)
type NoteAnalysis struct    // Combined AI result (title/category/summary)
type ChannelSettings struct // Per-channel config (custom prompts)
```

**API Endpoints:**
- `GET /notes` - List all notes
- `POST /notes` - Create note (triggers async processing)
- `PUT /notes/:id` - Update note content
- `DELETE /notes/:id` - Delete note and chunks
- `POST /search` - Semantic vector search
- `POST /ask` - Q&A with context from notes
- `POST /ai-question` - Ask about specific note
- `POST /summarize` - Generate note summary
- `POST /summarize/:id` - Summarize note by ID
- `GET /categories` - List categories with counts
- `GET /notes/category/:category` - Notes by category
- `GET /categories/stats` - Category statistics
- `POST /migrate/classify` - Classify uncategorized notes
- `POST /migrate/titles` - Regenerate all titles
- `GET /channels` - List channels with note counts
- `GET /channel-settings` - Get all channel settings
- `GET /channel-settings/:channel` - Get channel config
- `PUT /channel-settings/:channel` - Update channel config
- `DELETE /channels/:channel/notes` - Delete all notes for channel

**Key Functions:**
- `processNoteJob()` - Main async processing pipeline
- `analyzeNote()` - Combined AI analysis (title + category + summary)
- `generateEmbedding()` - Gemini embedding generation
- `classifyNote()` - AI category classification (standalone)
- `containsSensitiveData()` - Security pattern matching

**Dependencies:**
- MongoDB: Note/chunk storage
- Qdrant: Vector embeddings
- Gemini API: AI capabilities

### Frontend (notes-app/frontend/)

**Purpose:** User interface for note management

**Key Components:**

| Component | Purpose | Lines |
|-----------|---------|-------|
| ViewNotes.vue | Main two-panel notes interface | ~2500 |
| ChannelSettings.vue | YouTube import & channel config | ~1200 |
| QuestionAnswer.vue | AI-powered Q&A across notes | ~600 |
| SearchNotes.vue | Semantic search interface | ~600 |
| CategoryBrowser.vue | Category navigation | ~400 |
| UploadNotes.vue | Note creation form | ~200 |

**ViewNotes.vue Features:**
- Two-panel layout (list + detail)
- Category filtering with expandable section
- Channel filtering (group by author/channel)
- Semantic search with debounce
- Inline editing with keyboard shortcuts
- Summary generation with custom prompts
- AI questions modal
- Delete confirmation

**ChannelSettings.vue Features:**
- YouTube channel import via extension
- Bulk transcript extraction
- Custom summary prompts per channel
- Import progress tracking
- Channel management (delete all notes)

**Dependencies:**
- axios: HTTP client
- vue-router: Navigation

### Browser Extension (tweet-saver-extension/)

**Purpose:** Save social media content to notes API

**Key Files:**

| File | Purpose |
|------|---------|
| content.js | Platform detection, content extraction, button injection |
| background.js | Service worker, config storage, channel import |
| localhost-bridge.js | Message relay between Vue app and extension |
| popup.js | Quick settings UI |
| options.js | Advanced configuration page |

**SocialMediaSaver Class (content.js):**
- `detectPlatform()` - Identify current site
- `findPosts()` - Platform-specific post detection
- `getPostContent()` / `getPostAuthor()` - Content extraction
- `addSaveButton()` - Inject save UI
- `savePost()` - Send to API

**Supported Platforms:**
- Twitter/X: Tweet detection via data-testid selectors
- LinkedIn: Post detection via data-view-name selectors
- YouTube: Transcript extraction from video pages

**Dependencies:**
- Chrome Storage API: Config persistence
- Chrome Runtime API: Message passing

## Type Definitions / Schemas

**Note Schema (MongoDB):**
```go
{
  _id:      ObjectID,
  title:    string,
  content:  string,
  summary:  string,       // Optional, AI-generated
  category: string,       // From CATEGORIES list
  created:  time.Time,
  metadata: {             // From extension
    platform:  string,    // twitter/linkedin/youtube
    author:    string,
    url:       string,
    timestamp: string
  }
}
```

**NoteChunk Schema:**
```go
{
  _id:       ObjectID,
  note_id:   ObjectID,    // Reference to parent note
  content:   string,      // Chunk text (max 1000 words)
  chunk_idx: int
}
```

**Qdrant Point Payload:**
```go
{
  chunk_id: string,       // Chunk ObjectID
  note_id:  string        // Note ObjectID
}
```

**ChannelSettings Schema:**
```go
{
  _id:           ObjectID,
  channel_name:  string,    // Author/channel name
  platform:      string,    // youtube/twitter/linkedin
  summary_mode:  string,    // "default" or "custom"
  custom_prompt: string,    // Custom summary prompt
  updated_at:    time.Time
}
```

**Predefined Categories:**
```
journal, reflections, goals, ideas, thoughts, dreams, personal-growth,
recipes, workouts, meal-planning, health-tips, medical, nutrition,
meeting-notes, tasks, project-ideas, research, documentation, work-thoughts,
book-notes, article-notes, podcast-transcripts, courses, tutorials, learning,
... (40+ categories total)
```

## Testing

**Current State:**
- No automated tests present in the codebase
- Testing relies on manual verification via Docker Compose

**Manual Testing:**
```bash
# Start all services
cd notes-app && docker-compose up --build

# Test API endpoints
curl http://localhost:8080/notes
curl -X POST http://localhost:8080/notes -d '{"content":"test"}' -H "Content-Type: application/json"
curl -X POST http://localhost:8080/search -d '{"query":"test"}' -H "Content-Type: application/json"

# Extension: Load unpacked in chrome://extensions
```

**Extension Testing:**
1. Load extension at `chrome://extensions`
2. Enable Developer Mode
3. Load unpacked → select tweet-saver-extension folder
4. Navigate to Twitter/LinkedIn/YouTube and verify save buttons appear

## Common Tasks

### Adding a New API Endpoint

1. Add handler function in `notes-app/backend/main.go`
2. Register route in `main()` after line 213
3. Add corresponding fetch call in relevant Vue component

### Adding a New Vue Component

1. Create `ComponentName.vue` in `notes-app/frontend/src/components/`
2. Add route in `notes-app/frontend/src/main.js` (lines 7-11)
3. Add navigation link in `App.vue` nav section

### Adding a New Social Platform to Extension

1. Add platform detection in `content.js:detectPlatform()` (line 16)
2. Create `find[Platform]Posts()` method
3. Create `get[Platform]Content/Author/Handle/Url()` methods
4. Add host permission in `manifest.json` (lines 12-21)
5. Add content script match pattern in `manifest.json` (lines 23-32)

### Modifying Categories

1. Edit `CATEGORIES` array in `main.go` (lines 101-131)
2. Categories are used for AI classification prompts
3. Existing notes can be migrated via `POST /migrate/classify`

### Files That Change Together

- `main.go` API changes → corresponding Vue component changes
- `manifest.json` permissions → `content.js` platform handlers
- Vue component data changes → associated CSS in same file

## Gotchas & Context

### Backend Gotchas

1. **Single File Backend**: All 1800+ lines in main.go - consider splitting for larger changes
2. **Sensitive Data Detection** (line 419): Skips embedding for content with API keys, passwords
3. **Gemini Rate Limits**: Workers may fail silently on API rate limits
4. **gRPC Port**: Qdrant uses 6334 for gRPC, not 6333 (HTTP)
5. **Job Queue Size**: Limited to 100 jobs (line 195), may drop jobs if full

### Frontend Gotchas

1. **Large Components**: ViewNotes.vue (2500+) and ChannelSettings.vue (1200+) - complex state management
2. **Console Debug Logs**: Lines 157-158 have console.log in template (development artifacts)
3. **No State Management**: Uses component-local state, not Vuex/Pinia
4. **API URL**: Hardcoded fallback to localhost:8080 if VUE_APP_API_URL not set

### Extension Gotchas

1. **DOM Selectors Fragile**: Platform UI changes break selectors (LinkedIn especially)
2. **Transcript Extraction**: YouTube transcripts require clicking through UI
3. **MutationObserver**: Can cause performance issues on heavy pages
4. **Chrome Storage Sync**: Config stored in sync storage, limited to 100KB

### Architecture Decisions

1. **Monolithic Backend**: Single file chosen for simplicity in early development
2. **Text-embedding-004**: 768-dimensional embeddings, good balance of quality/cost
3. **Gemini 2.5 Flash Lite**: Used for generation tasks (classification, summaries, titles)
4. **Combined AI Analysis**: Single API call for title+category+summary reduces latency
5. **Chunk Size 1000 words**: Balances context window vs embedding quality
6. **3 Workers**: Parallel processing for embedding generation
7. **Localhost Bridge**: Extension communicates with Vue app via content script injection

### Technical Debt Areas

1. Qdrant cleanup TODO at line 715 - orphaned embeddings not deleted
2. No input validation on frontend before API calls
3. Extension config not validated before use
4. No retry logic for failed API calls
5. YouTube transcript extraction is brittle

## Meta

- **Last analyzed:** 2025-12-31
- **Git SHA:** 0b80c1442bec4c029ff0e4f4f7d96541e6f6f116
- **Files analyzed:** 24

### Changelog

**2025-12-31** (0b80c14)
- Added YouTube channel import feature with `ChannelSettings.vue` component
- New `channel_settings` MongoDB collection for per-channel config
- Combined AI analysis (`analyzeNote()`) reduces API calls by generating title/category/summary together
- Added channel-related API endpoints (`/channels`, `/channel-settings`)
- Extension now supports bulk transcript import via `localhost-bridge.js`
- Switched from `gemini-2.5-flash` to `gemini-2.5-flash-lite` model

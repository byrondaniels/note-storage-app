# E2E Testing Guide

This document covers running and maintaining the end-to-end tests for the Notes App.

## Overview

The E2E test suite consists of two parts:
1. **Backend E2E Tests** - Go tests that verify API endpoints with real MongoDB and Qdrant instances
2. **Frontend E2E Tests** - Playwright tests that verify the Vue.js frontend through browser automation

## Prerequisites

- Docker and Docker Compose installed
- Node.js 18+ (for running Playwright locally)
- Go 1.21+ (optional, tests can run in Docker)

## Running Tests

### Quick Start

```bash
# From the notes-app directory
cd notes-app

# Start the test environment
docker-compose -f docker-compose.test.yml up -d

# Wait for services to be healthy
docker-compose -f docker-compose.test.yml ps

# Run backend tests
docker run --rm \
  --network notes-app_test-network \
  -e TEST_MONGO_URI="mongodb://mongo-test:27017" \
  -e TEST_QDRANT_URL="qdrant-test:6334" \
  -v $(pwd)/backend:/app \
  -w /app \
  golang:1.21-alpine \
  go test -v ./tests/e2e/...

# Run frontend tests
cd e2e
npm install
npx playwright install chromium
npx playwright test
```

### Backend E2E Tests

The backend tests verify all API endpoints work correctly with real database instances.

#### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `TEST_MONGO_URI` | `mongodb://localhost:27018` | MongoDB connection URI |
| `TEST_QDRANT_URL` | `localhost:6336` | Qdrant gRPC URL |
| `GEMINI_API_KEY` | (none) | Optional - uses mock AI client if not set |

#### Running with Docker (Recommended)

```bash
# Start test databases
docker-compose -f docker-compose.test.yml up -d mongo-test qdrant-test

# Run tests in container
docker run --rm \
  --network notes-app_test-network \
  -e TEST_MONGO_URI="mongodb://mongo-test:27017" \
  -e TEST_QDRANT_URL="qdrant-test:6334" \
  -v $(pwd)/backend:/app \
  -w /app \
  golang:1.21-alpine \
  go test -v ./tests/e2e/...
```

#### Running Locally

```bash
# Ensure test services are running and ports are mapped
docker-compose -f docker-compose.test.yml up -d

# Set environment variables
export TEST_MONGO_URI="mongodb://localhost:27018"
export TEST_QDRANT_URL="localhost:6336"

# Run tests
cd backend
go test -v ./tests/e2e/...
```

#### Test Coverage

The backend tests cover:
- **Notes CRUD** - Create, Read, Update, Delete operations
- **Search** - Semantic search functionality
- **Categories** - Category listing and filtering
- **Channels** - Channel settings and management
- **Error Handling** - Invalid IDs, missing resources

### Frontend E2E Tests (Playwright)

The frontend tests verify the Vue.js application through browser automation.

#### Setup

```bash
cd e2e
npm install
npx playwright install chromium
```

#### Running Tests

```bash
# Run all tests
npx playwright test

# Run with UI mode (interactive)
npx playwright test --ui

# Run in headed mode (see browser)
npx playwright test --headed

# Run specific test file
npx playwright test tests/notes.spec.ts

# Run with debug mode
npx playwright test --debug
```

#### View Test Report

```bash
npx playwright show-report
```

#### Configuration

Tests are configured in `playwright.config.ts`:
- Base URL: `http://localhost:3000`
- Browser: Chromium only
- Timeout: 30 seconds per test
- Retries: 0 (no automatic retries)

## Current Test Status

### Backend Tests: 27/27 Passing

All backend E2E tests pass successfully with the mock AI client.

### Frontend Tests: 35/51 Passing

16 tests are currently failing due to DOM selector mismatches between the test expectations and the actual Vue.js frontend implementation.

#### Failing Tests

| Test File | Failing Tests | Root Cause |
|-----------|---------------|------------|
| `notes.spec.ts` | 5 | Selectors don't match actual DOM structure |
| `search.spec.ts` | 3 | Search UI selectors incorrect |
| `categories.spec.ts` | 3 | Category navigation selectors incorrect |
| `qa.spec.ts` | 3 | Q&A interface selectors incorrect |
| `upload.spec.ts` | 2 | Upload form selectors incorrect |

## Next Steps

### Priority 1: Fix Playwright Selectors

The frontend tests need selector updates to match the actual Vue.js component structure. Each component should be analyzed:

1. **ViewNotes.vue** - Main notes interface
   - Check note list selectors
   - Check note detail panel selectors
   - Check filter/search input selectors

2. **SearchNotes.vue** - Semantic search
   - Check search input selector
   - Check results list selector

3. **CategoryBrowser.vue** - Category navigation
   - Check category list selectors
   - Check category item selectors

4. **QuestionAnswer.vue** - AI Q&A
   - Check question input selector
   - Check answer display selector

5. **UploadNotes.vue** - Note creation
   - Check form field selectors
   - Check submit button selector

### Priority 2: Add Test Data-Testid Attributes

For more reliable testing, add `data-testid` attributes to key elements in Vue components:

```vue
<!-- Example in ViewNotes.vue -->
<input data-testid="search-input" v-model="searchQuery" />
<div data-testid="notes-list">
  <div data-testid="note-item" v-for="note in notes" :key="note._id">
    ...
  </div>
</div>
```

### Priority 3: CI/CD Integration

1. Add GitHub Actions workflow for automated testing
2. Run backend tests on every PR
3. Run Playwright tests against deployed preview environments

## Architecture Notes

### Mock AI Client

The backend tests use a mock AI client (`internal/ai/mock.go`) when `GEMINI_API_KEY` is not provided. This allows:
- Testing without API costs
- Faster test execution
- Deterministic results

The mock client:
- Returns predictable titles based on content
- Always classifies notes as "other"
- Returns 768-dimensional mock embeddings
- Generates simple summaries from content

### Test Isolation

- Each test run uses a fresh database state
- Tests clean up after themselves
- No shared state between test files

### Docker Compose Test Environment

`docker-compose.test.yml` provides:
- `mongo-test` - MongoDB on port 27018
- `qdrant-test` - Qdrant on ports 6335 (HTTP) and 6336 (gRPC)
- Isolated network for container-to-container communication

## Troubleshooting

### Qdrant Container Unhealthy

The Qdrant health check uses process detection since the image doesn't include curl:
```yaml
healthcheck:
  test: ["CMD-SHELL", "cat /proc/*/comm 2>/dev/null | grep -q qdrant"]
```

### MongoDB Connection Refused

Ensure the test MongoDB is running and healthy:
```bash
docker-compose -f docker-compose.test.yml ps mongo-test
```

### Playwright Version Mismatch

The package.json pins Playwright to 1.40.1. If you see version mismatch errors:
```bash
cd e2e
rm -rf node_modules package-lock.json
npm install
npx playwright install chromium
```

### Tests Timeout

Increase timeout in `playwright.config.ts`:
```typescript
timeout: 60 * 1000, // 60 seconds
```

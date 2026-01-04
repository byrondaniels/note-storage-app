# End-to-End Testing Guide

This document describes the E2E testing infrastructure for the Notes App.

## Overview

The E2E test suite consists of:

1. **Backend API Tests (Go)** - Tests the REST API endpoints directly
2. **Frontend E2E Tests (Playwright)** - Tests the UI workflows through a browser
3. **Docker Compose Test Environment** - Isolated infrastructure for testing

## Quick Start

### Run All Tests

```bash
./scripts/test-all.sh
```

This will:
1. Start the test Docker containers
2. Run backend Go tests
3. Run frontend Playwright tests
4. Clean up containers

### Run Individual Test Suites

```bash
# Backend tests only
./scripts/test-backend.sh

# Frontend tests only (requires test environment running)
./scripts/test-frontend.sh
```

## Test Environment

### Docker Compose Test Environment

The test environment uses `docker-compose.test.yml` which creates isolated services:

| Service | Port | Description |
|---------|------|-------------|
| mongo-test | 27018 | MongoDB test instance |
| qdrant-test | 6335/6336 | Qdrant test instance |
| backend-test | 8081 | Backend API |
| frontend-test | 3001 | Frontend UI |

### Starting the Test Environment Manually

```bash
cd notes-app
docker-compose -f docker-compose.test.yml up -d
```

### Stopping the Test Environment

```bash
docker-compose -f docker-compose.test.yml down -v
```

## Backend Tests

### Location

```
notes-app/backend/tests/e2e/
├── setup_test.go       # Test environment setup
├── notes_test.go       # Notes CRUD tests
├── categories_test.go  # Categories tests
├── channels_test.go    # Channels tests
└── search_test.go      # Search and AI tests
```

### Running Backend Tests

```bash
cd notes-app/backend

# Set environment variables
export TEST_MONGO_URI="mongodb://localhost:27018"
export TEST_QDRANT_URL="localhost:6336"

# Run tests
go test -v ./tests/e2e/... -timeout 120s
```

### Test Coverage

- **Notes API**
  - GET /notes - List notes with channel filtering
  - POST /notes - Create note with AI analysis
  - PUT /notes/:id - Update note content
  - DELETE /notes/:id - Delete note and cleanup

- **Categories API**
  - GET /categories - List categories with counts
  - GET /notes/category/:category - Filter notes by category
  - GET /categories/stats - Get category statistics
  - POST /migrate/classify - AI classification migration

- **Channels API**
  - GET /channels - List channels with note counts
  - GET /channel-settings - List all settings
  - GET /channel-settings/:channel - Get channel settings
  - PUT /channel-settings/:channel - Create/update settings
  - DELETE /channel-settings/:channel - Delete settings
  - DELETE /channels/:channel/notes - Delete all channel notes

- **Search API** (requires GEMINI_API_KEY)
  - POST /search - Semantic search
  - POST /ask - Q&A with context
  - POST /ai-question - Ask about content

### AI-Dependent Tests

Some tests require the `GEMINI_API_KEY` environment variable. Without it:
- AI-related tests are skipped
- Note creation may fail (AI generates titles/categories)

## Frontend Tests

### Location

```
notes-app/e2e/
├── package.json           # Dependencies
├── playwright.config.ts   # Playwright configuration
└── tests/
    ├── fixtures.ts        # Test utilities
    ├── notes.spec.ts      # Notes management tests
    ├── categories.spec.ts # Category tests
    ├── qa.spec.ts         # Q&A tests
    ├── settings.spec.ts   # Settings tests
    ├── navigation.spec.ts # Navigation & smoke tests
    └── api.spec.ts        # API tests via Playwright
```

### Running Frontend Tests

```bash
cd notes-app/e2e

# Install dependencies
npm install
npx playwright install chromium

# Set environment variables
export E2E_BASE_URL="http://localhost:3001"
export E2E_API_URL="http://localhost:8081"

# Run tests
npm test

# Run with UI
npm run test:ui

# Run headed (visible browser)
npm run test:headed

# Run with debugging
npm run test:debug
```

### Test Coverage

- **Navigation Tests**
  - Page loading
  - Navigation links
  - Responsive layout

- **Notes Tests**
  - Display notes list
  - Search and filtering
  - Note selection and detail view
  - CRUD operations

- **Category Tests**
  - Category filtering
  - Category badges

- **Q&A Tests**
  - Q&A interface
  - Question submission
  - AI question on notes

- **Settings Tests**
  - Settings page
  - Channel configuration

### Viewing Test Reports

```bash
npm run test:report
```

## Environment Variables

### Backend Tests

| Variable | Default | Description |
|----------|---------|-------------|
| TEST_MONGO_URI | mongodb://localhost:27017 | MongoDB connection string |
| TEST_QDRANT_URL | localhost:6334 | Qdrant gRPC endpoint |
| GEMINI_API_KEY | (none) | Google Gemini API key for AI tests |

### Frontend Tests

| Variable | Default | Description |
|----------|---------|-------------|
| E2E_BASE_URL | http://localhost:3001 | Frontend URL |
| E2E_API_URL | http://localhost:8081 | Backend API URL |
| CI | (none) | Set to any value for CI mode |

## CI/CD Integration

### GitHub Actions Example

```yaml
name: E2E Tests

on: [push, pull_request]

jobs:
  e2e:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Start test environment
        run: |
          cd notes-app
          docker-compose -f docker-compose.test.yml up -d

      - name: Wait for services
        run: |
          sleep 30

      - name: Run backend tests
        run: |
          cd notes-app/backend
          export TEST_MONGO_URI="mongodb://localhost:27018"
          export TEST_QDRANT_URL="localhost:6336"
          go test -v ./tests/e2e/... -timeout 120s

      - name: Install Playwright
        run: |
          cd notes-app/e2e
          npm ci
          npx playwright install --with-deps chromium

      - name: Run frontend tests
        run: |
          cd notes-app/e2e
          export E2E_BASE_URL="http://localhost:3001"
          export E2E_API_URL="http://localhost:8081"
          export CI=true
          npx playwright test

      - uses: actions/upload-artifact@v3
        if: always()
        with:
          name: playwright-report
          path: notes-app/e2e/playwright-report/

      - name: Cleanup
        if: always()
        run: |
          cd notes-app
          docker-compose -f docker-compose.test.yml down -v
```

## Troubleshooting

### Tests fail to connect to MongoDB

Ensure MongoDB is running on the correct port:
```bash
docker-compose -f docker-compose.test.yml up -d mongo-test
```

### Tests fail to connect to Qdrant

Ensure Qdrant is running:
```bash
docker-compose -f docker-compose.test.yml up -d qdrant-test
```

### AI tests are skipped

Set the GEMINI_API_KEY environment variable:
```bash
export GEMINI_API_KEY="your-api-key"
```

### Frontend tests time out

1. Check if frontend is running: `curl http://localhost:3001`
2. Check if backend is running: `curl http://localhost:8081/notes`
3. Increase timeout in `playwright.config.ts`

### Test database not cleaned up

Force cleanup:
```bash
docker-compose -f docker-compose.test.yml down -v
```

## Best Practices

1. **Isolation**: Each test should clean up after itself
2. **Independence**: Tests should not depend on each other
3. **Determinism**: Use API helpers to set up test data
4. **Speed**: Use parallel execution where possible
5. **Reliability**: Add retries for flaky tests in CI

## Adding New Tests

### Backend

1. Add test file in `backend/tests/e2e/`
2. Use `SetupTestEnv(t)` for setup
3. Use `CleanupCollections(t, env)` for cleanup
4. Use `HTTPRequest()` and `ParseResponse()` helpers

### Frontend

1. Add test file in `e2e/tests/`
2. Import `test, expect` from `./fixtures`
3. Use `notesPage` and `apiHelper` fixtures
4. Use `apiHelper.deleteAllNotes()` for cleanup

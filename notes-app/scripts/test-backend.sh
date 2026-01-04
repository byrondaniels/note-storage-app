#!/bin/bash

# Backend E2E Test Runner
# This script runs the Go backend E2E tests

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/../backend"

echo "🧪 Running Backend E2E Tests..."
echo "================================"

# Check if MongoDB is running
if ! nc -z localhost 27017 2>/dev/null; then
    echo "⚠️  MongoDB is not running on localhost:27017"
    echo "   Start MongoDB or run: docker-compose -f docker-compose.test.yml up mongo-test"
    exit 1
fi

# Check if Qdrant is running
if ! nc -z localhost 6334 2>/dev/null; then
    echo "⚠️  Qdrant is not running on localhost:6334"
    echo "   Start Qdrant or run: docker-compose -f docker-compose.test.yml up qdrant-test"
    exit 1
fi

cd "$BACKEND_DIR"

# Set test environment variables
export TEST_MONGO_URI="mongodb://localhost:27017"
export TEST_QDRANT_URL="localhost:6334"

# Run tests
echo ""
echo "Running tests..."
go test -v ./tests/e2e/... -timeout 120s

echo ""
echo "✅ Backend E2E tests completed!"

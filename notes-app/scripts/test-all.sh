#!/bin/bash

# Full E2E Test Suite Runner
# This script starts the test environment and runs all E2E tests

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$SCRIPT_DIR/.."

echo "🚀 Notes App E2E Test Suite"
echo "============================"
echo ""

# Parse arguments
SKIP_DOCKER=false
SKIP_BACKEND=false
SKIP_FRONTEND=false

while [[ "$#" -gt 0 ]]; do
    case $1 in
        --skip-docker) SKIP_DOCKER=true ;;
        --skip-backend) SKIP_BACKEND=true ;;
        --skip-frontend) SKIP_FRONTEND=true ;;
        --help)
            echo "Usage: $0 [options]"
            echo ""
            echo "Options:"
            echo "  --skip-docker    Don't start/stop Docker containers"
            echo "  --skip-backend   Skip backend Go tests"
            echo "  --skip-frontend  Skip frontend Playwright tests"
            echo "  --help           Show this help message"
            exit 0
            ;;
        *) echo "Unknown option: $1"; exit 1 ;;
    esac
    shift
done

cd "$ROOT_DIR"

# Cleanup function
cleanup() {
    echo ""
    echo "🧹 Cleaning up..."
    if [ "$SKIP_DOCKER" = false ]; then
        docker-compose -f docker-compose.test.yml down -v 2>/dev/null || true
    fi
}

trap cleanup EXIT

# Start test environment
if [ "$SKIP_DOCKER" = false ]; then
    echo "📦 Starting test environment..."
    docker-compose -f docker-compose.test.yml up -d

    echo "⏳ Waiting for services to be healthy..."

    # Wait for MongoDB
    echo -n "   MongoDB: "
    for i in {1..30}; do
        if docker-compose -f docker-compose.test.yml exec -T mongo-test mongosh --eval "db.adminCommand('ping')" >/dev/null 2>&1; then
            echo "✅"
            break
        fi
        sleep 1
        echo -n "."
    done

    # Wait for Qdrant
    echo -n "   Qdrant: "
    for i in {1..30}; do
        if curl -s http://localhost:6335/health >/dev/null 2>&1; then
            echo "✅"
            break
        fi
        sleep 1
        echo -n "."
    done

    # Wait for Backend
    echo -n "   Backend: "
    for i in {1..60}; do
        if curl -s http://localhost:8081/notes >/dev/null 2>&1; then
            echo "✅"
            break
        fi
        sleep 1
        echo -n "."
    done

    # Wait for Frontend
    echo -n "   Frontend: "
    for i in {1..60}; do
        if curl -s http://localhost:3001 >/dev/null 2>&1; then
            echo "✅"
            break
        fi
        sleep 1
        echo -n "."
    done

    echo ""
fi

# Run backend tests
if [ "$SKIP_BACKEND" = false ]; then
    echo ""
    echo "🧪 Running Backend E2E Tests..."
    echo "--------------------------------"

    cd "$ROOT_DIR/backend"

    export TEST_MONGO_URI="mongodb://localhost:27018"
    export TEST_QDRANT_URL="localhost:6336"

    if go test -v ./tests/e2e/... -timeout 120s; then
        echo "✅ Backend tests passed!"
    else
        echo "❌ Backend tests failed!"
        exit 1
    fi

    cd "$ROOT_DIR"
fi

# Run frontend tests
if [ "$SKIP_FRONTEND" = false ]; then
    echo ""
    echo "🎭 Running Frontend E2E Tests..."
    echo "---------------------------------"

    cd "$ROOT_DIR/e2e"

    # Install dependencies if needed
    if [ ! -d "node_modules" ]; then
        echo "Installing Playwright dependencies..."
        npm install
        npx playwright install chromium
    fi

    export E2E_BASE_URL="http://localhost:3001"
    export E2E_API_URL="http://localhost:8081"

    if npx playwright test; then
        echo "✅ Frontend tests passed!"
    else
        echo "❌ Frontend tests failed!"
        exit 1
    fi

    cd "$ROOT_DIR"
fi

echo ""
echo "========================================"
echo "✅ All E2E tests completed successfully!"
echo "========================================"

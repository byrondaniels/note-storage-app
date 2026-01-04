#!/bin/bash

# Frontend E2E Test Runner
# This script runs the Playwright frontend E2E tests

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
E2E_DIR="$SCRIPT_DIR/../e2e"

echo "🎭 Running Frontend E2E Tests with Playwright..."
echo "================================================="

cd "$E2E_DIR"

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
    npx playwright install chromium
fi

# Set environment variables
export E2E_BASE_URL="${E2E_BASE_URL:-http://localhost:3001}"
export E2E_API_URL="${E2E_API_URL:-http://localhost:8081}"

echo ""
echo "Base URL: $E2E_BASE_URL"
echo "API URL: $E2E_API_URL"
echo ""

# Run tests
npx playwright test "$@"

echo ""
echo "✅ Frontend E2E tests completed!"
echo ""
echo "To view the report, run: npm run test:report"

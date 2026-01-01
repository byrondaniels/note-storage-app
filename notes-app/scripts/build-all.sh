#!/bin/bash
# Build all services
cd "$(dirname "$0")/.."
echo "Building backend..."
docker compose build backend 2>&1 | tail -3
echo "Building frontend..."
docker compose build frontend 2>&1 | tail -3
echo "Done."

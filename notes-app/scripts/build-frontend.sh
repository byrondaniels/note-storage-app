#!/bin/bash
# Build the frontend service
cd "$(dirname "$0")/.." && docker compose build frontend 2>&1 | tail -5

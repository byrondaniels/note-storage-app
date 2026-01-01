#!/bin/bash
# Build the backend service
cd "$(dirname "$0")/.." && docker compose build backend 2>&1 | tail -5

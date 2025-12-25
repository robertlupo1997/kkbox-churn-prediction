#!/bin/bash
# KKBOX Churn Prediction - Docker Quick Start Script

set -e

echo "========================================"
echo "KKBOX Churn Prediction - Docker Setup"
echo "========================================"
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "Error: Docker is not running. Please start Docker and try again."
    exit 1
fi

# Check if required files exist
echo "Checking required files..."
MISSING_FILES=()

if [ ! -f "models/xgb.json" ]; then
    MISSING_FILES+=("models/xgb.json")
fi

if [ ! -f "eval/app_features.csv" ]; then
    MISSING_FILES+=("eval/app_features.csv")
fi

if [ ! -f "rules.yaml" ]; then
    MISSING_FILES+=("rules.yaml")
fi

if [ ${#MISSING_FILES[@]} -gt 0 ]; then
    echo "Warning: The following required files are missing:"
    for file in "${MISSING_FILES[@]}"; do
        echo "  - $file"
    done
    echo ""
    echo "The API may not function properly without these files."
    echo "Press Ctrl+C to cancel or wait 5 seconds to continue..."
    sleep 5
fi

echo "Files check complete."
echo ""

# Stop any existing containers
echo "Stopping existing containers..."
docker-compose down 2>/dev/null || true

echo ""
echo "Building and starting services..."
echo "This may take a few minutes on first run..."
echo ""

# Build and start services
docker-compose up --build -d

echo ""
echo "Waiting for services to be healthy..."
sleep 5

# Wait for API to be healthy
MAX_ATTEMPTS=30
ATTEMPT=0
while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
    if curl -f http://localhost:8000/api/health > /dev/null 2>&1; then
        echo "API is healthy!"
        break
    fi
    ATTEMPT=$((ATTEMPT + 1))
    echo "Waiting for API... (attempt $ATTEMPT/$MAX_ATTEMPTS)"
    sleep 2
done

if [ $ATTEMPT -eq $MAX_ATTEMPTS ]; then
    echo "Warning: API did not become healthy within expected time."
    echo "Check logs with: docker-compose logs api"
fi

echo ""
echo "========================================"
echo "Services are running!"
echo "========================================"
echo ""
echo "Access the application:"
echo "  Frontend:  http://localhost:3000"
echo "  API Docs:  http://localhost:8000/docs"
echo "  API Health: http://localhost:8000/api/health"
echo ""
echo "Useful commands:"
echo "  View logs:        docker-compose logs -f"
echo "  Stop services:    docker-compose down"
echo "  Restart services: docker-compose restart"
echo ""
echo "Press Ctrl+C to stop following logs, services will continue running."
echo ""

# Follow logs
docker-compose logs -f

# KKBOX Churn Prediction - Production Docker Image
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    make \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY requirements.txt requirements-dev.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code
COPY . .

# Install project in development mode
RUN pip install -e .

# Create necessary directories
RUN mkdir -p data models features eval plots logs

# Set Python path
ENV PYTHONPATH=/app:$PYTHONPATH

# Default command runs the full pipeline
CMD ["make", "all"]

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import pandas, duckdb, sklearn, xgboost; print('All dependencies available')" || exit 1

# Labels for better container management
LABEL maintainer="Portfolio Showcase"
LABEL version="1.0.0"
LABEL description="KKBOX churn prediction with temporal safeguards"
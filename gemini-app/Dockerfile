# Use Node.js 20 slim image
FROM node:20-slim

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy application code
COPY . .

# Expose port 3000
EXPOSE 3000

# Run Vite dev server with --host flag to allow external connections
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "3000"]

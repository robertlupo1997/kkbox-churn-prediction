# Build stage
FROM node:20-alpine AS build

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Build the app
RUN npm run build

# Production stage
#
# nginx, not `serve`, because this container has to reverse-proxy /api/* to the
# api service. The client requests relative paths -- that is what makes the same
# bundle work on Hugging Face Spaces, where one uvicorn serves both -- and
# `serve` cannot proxy to an upstream. See nginx.conf.
FROM nginx:1.27-alpine

# Copy built files from build stage
COPY --from=build /app/dist /usr/share/nginx/html

# Replace the default server block; ours listens on 3000 and proxies /api/.
RUN rm -f /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/app.conf

EXPOSE 3000

CMD ["nginx", "-g", "daemon off;"]

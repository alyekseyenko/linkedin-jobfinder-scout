# 🖥️ Neural Interface - Production Multi-Stage Builder
FROM node:20-alpine AS builder

WORKDIR /app

# Cache dependencies layer
COPY package*.json ./
RUN npm ci

# Copy source and build SPA bundle
COPY . .
RUN npm run build

# 🚀 Stage 2: High-Performance Lightweight Nginx Runner (~25MB)
FROM nginx:alpine AS runner

# Copy SPA static assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy production Nginx reverse proxy configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 5173

CMD ["nginx", "-g", "daemon off;"]

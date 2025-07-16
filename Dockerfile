# Base image
FROM node:18-alpine

# Tạo thư mục làm việc
WORKDIR /app

# Copy source code
COPY . .

# Cài dependencies
RUN npm install

# Build Vite project
RUN npm run build

# Install a lightweight web server to serve static files
RUN npm install -g serve

# Expose port (default Vite build output uses 3000)
EXPOSE 3000

# Default command
CMD ["serve", "-s", "dist"]

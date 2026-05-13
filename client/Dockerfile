FROM node:20-alpine

WORKDIR /app

# Copy client package files
COPY client/package.json ./

# Install dependencies
RUN npm install

# Copy client source
COPY client/ ./

# Expose Vite dev server port
EXPOSE 5173

# Run Vite dev server (accessible from outside container)
CMD ["npx", "vite", "--host", "0.0.0.0"]

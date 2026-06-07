FROM node:20-alpine AS build

WORKDIR /app

# Copy root workspace files
COPY package.json package-lock.json ./
COPY prisma ./prisma/
COPY server/package.json ./server/

# Install all dependencies (including dev)
RUN npm install --workspace=server --ignore-scripts
RUN npx prisma generate --schema=./prisma/schema.prisma

# Copy server source and build
COPY server ./server/
WORKDIR /app/server
RUN npm run build

# Stage 2: Production
FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
COPY prisma ./prisma/
COPY server/package.json ./server/

# Install only production dependencies
ENV NODE_ENV=production
RUN npm install --workspace=server --omit=dev --ignore-scripts
RUN npx prisma generate --schema=./prisma/schema.prisma

# Copy built code
COPY --from=build /app/server/dist ./server/dist

EXPOSE 3001

CMD ["sh", "-c", "npx prisma db push --schema=./prisma/schema.prisma --skip-generate && node server/dist/seed.js && node server/dist/index.js"]

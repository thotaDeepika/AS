FROM node:20-alpine

WORKDIR /app

# Copy root workspace files
COPY package.json package-lock.json ./
COPY prisma ./prisma/
COPY server/package.json ./server/

# Install dependencies
RUN npm install --workspace=server --ignore-scripts
RUN npx prisma generate --schema=./prisma/schema.prisma

# Copy server source
COPY server ./server/

# Expose port
EXPOSE 3001

# Run database push + seed + start
CMD ["sh", "-c", "npx prisma db push --schema=./prisma/schema.prisma --skip-generate && npx tsx server/src/seed.ts && npx tsx server/src/index.ts"]

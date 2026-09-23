FROM node:22-alpine AS build

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
FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
COPY prisma ./prisma/
COPY server/package.json ./server/

# Install only production dependencies
ENV NODE_ENV=production
RUN npm install --workspace=server --omit=dev --ignore-scripts

# bcrypt is a native module and the install above runs with --ignore-scripts, so
# its binding is never fetched. Fetch it explicitly (a musl prebuilt exists) and
# fail the build loudly if it is still missing -- without it both the seed and
# /api/auth/login crash at runtime.
RUN npm rebuild bcrypt \
    && node -e "require('bcrypt').hashSync('probe', 10); console.log('bcrypt binding ok')"

RUN npx prisma generate --schema=./prisma/schema.prisma

# Copy built code
COPY --from=build /app/server/dist ./server/dist

EXPOSE 3001

CMD ["sh", "-c", "npx prisma db push --schema=./prisma/schema.prisma --skip-generate && node server/dist/seed.js && node server/dist/index.js"]

FROM node:20-alpine AS build

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
COPY client/package.json ./client/
RUN npm install --workspace=client --ignore-scripts

# Build client
COPY client/ ./client/
WORKDIR /app/client
RUN npm run build

# Stage 2: Nginx
FROM nginx:alpine
COPY --from=build /app/client/dist /usr/share/nginx/html
COPY client/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

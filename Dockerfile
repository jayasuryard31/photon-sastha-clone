# Minimal production image for the multiplayer backend
FROM node:18-alpine AS base
WORKDIR /usr/src/app
ENV NODE_ENV=production

# Install dependencies first (better layer caching)
COPY package*.json ./
RUN npm install --omit=dev

# Copy source
COPY src ./src
COPY scripts ./scripts
COPY README.md ./README.md

EXPOSE 3000
CMD ["node", "src/server.js"]

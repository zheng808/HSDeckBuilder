# syntax=docker/dockerfile:1
# Single-process image: the Hono API serves the built React client and stores
# decks in a SQLite file under /data (mount a volume there).

FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY server/package.json server/
COPY client/package.json client/
RUN npm ci
COPY . .
RUN npm run build -w client && npm prune --omit=dev

FROM node:22-alpine
ENV NODE_ENV=production \
    PORT=3001 \
    DB_PATH=/data/decks.db
WORKDIR /app
COPY --from=build /app /app
RUN mkdir -p /data && chown -R node:node /data /app
USER node
EXPOSE 3001
VOLUME ["/data"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD wget -qO- http://127.0.0.1:3001/api/health || exit 1
CMD ["node", "--disable-warning=ExperimentalWarning", "--import", "tsx", "server/src/index.ts"]

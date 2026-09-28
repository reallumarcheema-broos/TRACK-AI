# TRACK AI Coach — app + AI debrief server in one small image.
#   docker build -t track-ai .
#   docker run -p 8787:8787 -e ANTHROPIC_API_KEY=sk-ant-... track-ai
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Bundle the pose models so the app never depends on a CDN at runtime (non-fatal if offline).
RUN npm run fetch-models || echo "Model download failed; the app will use Google's CDN instead."
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=8787
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY server ./server
# The server reuses the exercise definitions to validate debrief requests.
COPY src/core ./src/core
COPY src/exercises ./src/exercises
COPY src/shared ./src/shared
USER node
EXPOSE 8787
CMD ["npx", "tsx", "server/index.ts"]

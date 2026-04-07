FROM node:22-alpine AS builder
LABEL org.opencontainers.image.source="https://github.com/VibeSmiths/mcp-yt-dlp" \
      org.opencontainers.image.description="MCP server: yt-dlp" \
      org.opencontainers.image.licenses="MIT"

WORKDIR /app
COPY package.json tsconfig.json ./
RUN npm install
COPY src/ ./src/
RUN npm run build

# ─── Runtime image ────────────────────────────────────────────────────────────
FROM node:22-alpine AS runtime

LABEL org.opencontainers.image.source="https://github.com/VibeSmiths/mcp-yt-dlp"
LABEL org.opencontainers.image.description="MCP server for yt-dlp video tools"
LABEL org.opencontainers.image.licenses="MIT"

WORKDIR /app

# Install yt-dlp, ffmpeg (for merging/audio extraction), and Python
# hadolint ignore=DL3013,DL3018
RUN apk add --no-cache python3 py3-pip ffmpeg \
    && python3 -m pip install --no-cache-dir --break-system-packages yt-dlp

COPY package.json ./
RUN npm install --omit=dev

COPY --from=builder /app/dist ./dist

# Default download output directory (mount a volume here to persist files)
RUN mkdir -p /downloads

ENV TRANSPORT=stdio
ENV DOWNLOAD_DIR=/downloads

CMD ["node", "dist/index.js"]

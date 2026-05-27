# ============================
# Stage 1: Build backend
# ============================
FROM node:24-bookworm AS backend-builder

WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci
COPY scripts/trace-processor-pin.env /app/scripts/trace-processor-pin.env
COPY backend/ ./
COPY backend/data/perfettoSqlIndex.light.json backend/data/perfettoSqlIndex.json backend/data/perfettoStdlibSymbols.json ./data/
RUN npm run build
RUN npm prune --production

# ============================
# Stage 2: Download trace_processor_shell
# ============================
FROM debian:bookworm-slim AS tp-downloader

ARG TRACE_PROCESSOR_DOWNLOAD_BASE=
ARG TRACE_PROCESSOR_DOWNLOAD_URL=

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY scripts/trace-processor-pin.env /tmp/pin.env

RUN . /tmp/pin.env && \
    ARCH=$(uname -m) && \
    case "$ARCH" in \
      x86_64)  PLAT=linux-amd64; SHA="$PERFETTO_SHELL_SHA256_LINUX_AMD64" ;; \
      aarch64) PLAT=linux-arm64; SHA="$PERFETTO_SHELL_SHA256_LINUX_ARM64" ;; \
      *) echo "Unsupported architecture: $ARCH" && exit 1 ;; \
    esac && \
    URL_BASE="${TRACE_PROCESSOR_DOWNLOAD_BASE:-$PERFETTO_LUCI_URL_BASE}" && \
    URL="${TRACE_PROCESSOR_DOWNLOAD_URL:-${URL_BASE%/}/${PERFETTO_VERSION}/${PLAT}/trace_processor_shell}" && \
    curl -fL --max-time 120 -o /tmp/trace_processor_shell \
      "$URL" && \
    echo "${SHA}  /tmp/trace_processor_shell" | sha256sum -c - && \
    chmod +x /tmp/trace_processor_shell && \
    /tmp/trace_processor_shell --version | head -n 1

# ============================
# Stage 3: Runtime
# ============================
FROM node:24-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy trace_processor_shell
COPY --from=tp-downloader /tmp/trace_processor_shell /app/perfetto/out/ui/trace_processor_shell

# Copy backend (built + node_modules)
COPY --from=backend-builder /app/backend/dist ./backend/dist
COPY --from=backend-builder /app/backend/node_modules ./backend/node_modules
COPY --from=backend-builder /app/backend/package.json ./backend/
COPY --from=backend-builder /app/backend/data/perfettoSqlIndex.light.json ./backend/data/perfettoSqlIndex.light.json
COPY --from=backend-builder /app/backend/data/perfettoSqlIndex.json ./backend/data/perfettoSqlIndex.json
COPY --from=backend-builder /app/backend/data/perfettoStdlibSymbols.json ./backend/data/perfettoStdlibSymbols.json

# Copy backend runtime files (skills, strategies, SQL packages)
COPY backend/skills ./backend/skills
COPY backend/strategies ./backend/strategies
COPY backend/sql ./backend/sql

RUN mkdir -p backend/uploads backend/logs/sessions backend/data && \
    chown -R node:node /app

ENV PORT=3000
ENV NODE_ENV=production

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

COPY scripts/docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh && chown node:node /app/docker-entrypoint.sh

USER node

ENTRYPOINT ["/app/docker-entrypoint.sh"]

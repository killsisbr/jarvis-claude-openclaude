# JARVIS Worker — Multi-stage Docker build
# Stage 1: Builder (compile dependencies)
FROM oven/bun:latest AS builder
WORKDIR /app

# Copy manifest and install frozen dependencies
COPY package.json bun.lockb* ./
RUN bun install --frozen-lockfile

# Stage 2: Runtime (minimal image)
FROM oven/bun:latest
WORKDIR /app

# Copy dependencies from builder
COPY --from=builder /app/node_modules ./node_modules

# Copy source code
COPY src ./src
COPY package.json ./

# Runtime configuration
ENV NODE_ENV=production \
    WORKER_PORT=6666

# Health check
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD curl -f http://localhost:6666/health || exit 1

# Expose port
EXPOSE 6666

# Entrypoint
CMD ["bun", "run", "src/worker/main.ts"]

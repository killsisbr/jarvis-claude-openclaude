# Build stage
FROM oven/bun:latest AS builder

WORKDIR /app

# Copiar arquivos
COPY package.json bun.lockb* ./
COPY tsconfig.json ./
COPY src ./src
COPY scripts ./scripts

# Build
RUN bun install --production
RUN bun run build

# Runtime stage
FROM oven/bun:latest

WORKDIR /app

# Criar usuário não-root
RUN useradd -m -s /bin/bash jarvis && \
    mkdir -p /home/jarvis/.jarvis && \
    chown -R jarvis:jarvis /home/jarvis

# Copiar apenas o necessário do builder
COPY --from=builder --chown=jarvis:jarvis /app/dist ./dist
COPY --from=builder --chown=jarvis:jarvis /app/node_modules ./node_modules
COPY --from=builder --chown=jarvis:jarvis /app/package.json ./

# Diretórios para dados persistentes
VOLUME ["/home/jarvis/.jarvis"]

# Rodar como usuário não-root
USER jarvis

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --retries=3 --start-period=40s \
  CMD curl -f http://localhost:3000/health || exit 1

# Start worker
CMD ["bun", "dist/cli.mjs", "--dangerously-skip-permissions"]

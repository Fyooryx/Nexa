FROM node:24-bookworm-slim

ENV NODE_ENV=production \
    AUTH_DIR=/app/runtime/auth_info \
    DATA_DIR=/app/runtime/data

RUN apt-get update \
    && apt-get install -y --no-install-recommends gosu \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

COPY src ./src
COPY start.sh ./

RUN mkdir -p /app/runtime/auth_info /app/runtime/data \
    && chown -R node:node /app/runtime \
    && chmod 755 /app/start.sh

USER node

# Persistent storage is attached as a Railway Volume at /app/runtime.
# Railway mounts volumes as root; start.sh repairs ownership and drops privileges.
# The Dockerfile VOLUME instruction is not supported by Railway.
CMD ["/app/start.sh"]

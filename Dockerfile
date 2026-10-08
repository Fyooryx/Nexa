FROM node:24-bookworm-slim

ENV NODE_ENV=production \
    AUTH_DIR=/app/runtime/auth_info \
    DATA_DIR=/app/runtime/data

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

COPY src ./src
COPY start.sh ./

RUN mkdir -p /app/runtime/auth_info /app/runtime/data \
    && chown -R node:node /app/runtime \
    && chmod 755 /app/start.sh

USER node

VOLUME ["/app/runtime"]

CMD ["npm", "start"]
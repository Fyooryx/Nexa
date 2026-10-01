FROM node:20-bookworm-slim

ENV NODE_ENV=production \
    AUTH_DIR=/app/auth_info \
    DATA_DIR=/app/data

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund

COPY src ./src
COPY start.sh ./

RUN mkdir -p /app/auth_info /app/data \
    && chmod 755 /app/start.sh

VOLUME ["/app/auth_info", "/app/data"]

CMD ["npm", "start"]
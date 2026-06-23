FROM node:20-alpine AS builder

WORKDIR /app

COPY packages/contracts ./packages/contracts
RUN cd packages/contracts && npm install --include=dev --no-audit --no-fund && npm run build

COPY services/websocket-service/package*.json ./services/websocket-service/
RUN cd services/websocket-service && npm install --include=dev --no-audit --no-fund

COPY services/websocket-service ./services/websocket-service
RUN cd services/websocket-service && npm run build

FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/packages/contracts/package*.json ./packages/contracts/
COPY --from=builder /app/packages/contracts/dist ./packages/contracts/dist
COPY services/websocket-service/package*.json ./services/websocket-service/
RUN cd services/websocket-service && npm install --omit=dev --no-audit --no-fund

COPY --from=builder /app/services/websocket-service/dist ./services/websocket-service/dist

WORKDIR /app/services/websocket-service
CMD ["node", "dist/index.js"]

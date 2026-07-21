FROM mirror.gcr.io/library/node:24-alpine AS builder
WORKDIR /app
COPY packages/contracts/package*.json ./packages/contracts/
RUN cd packages/contracts && npm ci
COPY packages/contracts ./packages/contracts
RUN cd packages/contracts && npm run build

COPY services/websocket-gateway/package*.json ./services/websocket-gateway/
RUN cd services/websocket-gateway && npm ci
COPY services/websocket-gateway ./services/websocket-gateway
RUN cd services/websocket-gateway && npm run build

FROM mirror.gcr.io/library/node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/packages/contracts ./packages/contracts
COPY --from=builder /app/services/websocket-gateway ./services/websocket-gateway
WORKDIR /app/services/websocket-gateway
RUN npm prune --omit=dev && rm -rf /usr/local/lib/node_modules/npm
EXPOSE 3009
USER node
CMD ["node", "dist/index.js"]

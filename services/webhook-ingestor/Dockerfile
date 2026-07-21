FROM mirror.gcr.io/library/node:24-alpine AS builder
WORKDIR /app
COPY packages/contracts/package*.json ./packages/contracts/
RUN cd packages/contracts && npm ci
COPY packages/contracts ./packages/contracts
RUN cd packages/contracts && npm run build

COPY services/webhook-ingestor/package*.json ./services/webhook-ingestor/
RUN cd services/webhook-ingestor && npm ci
COPY services/webhook-ingestor ./services/webhook-ingestor
RUN cd services/webhook-ingestor && npm run build

FROM mirror.gcr.io/library/node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/packages/contracts ./packages/contracts
COPY --from=builder /app/services/webhook-ingestor ./services/webhook-ingestor
WORKDIR /app/services/webhook-ingestor
RUN npm prune --omit=dev && rm -rf /usr/local/lib/node_modules/npm
EXPOSE 3013
USER node
CMD ["node", "dist/index.js"]

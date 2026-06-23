FROM node:20-alpine AS builder

WORKDIR /app

COPY packages/contracts ./packages/contracts
RUN cd packages/contracts && npm install --include=dev --no-audit --no-fund && npm run build

COPY services/api-gateway/package*.json ./services/api-gateway/
RUN cd services/api-gateway && npm install --include=dev --no-audit --no-fund

COPY services/api-gateway ./services/api-gateway
RUN cd services/api-gateway && npm run build

FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/packages/contracts/package*.json ./packages/contracts/
COPY --from=builder /app/packages/contracts/dist ./packages/contracts/dist
COPY services/api-gateway/package*.json ./services/api-gateway/
RUN cd services/api-gateway && npm install --omit=dev --no-audit --no-fund

COPY --from=builder /app/services/api-gateway/dist ./services/api-gateway/dist

WORKDIR /app/services/api-gateway
CMD ["node", "dist/index.js"]

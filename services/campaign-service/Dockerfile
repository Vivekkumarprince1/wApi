FROM node:20-alpine AS builder

WORKDIR /app

COPY packages/contracts ./packages/contracts
RUN cd packages/contracts && npm install --include=dev --no-audit --no-fund && npm run build

COPY services/campaign-service/package*.json ./services/campaign-service/
RUN cd services/campaign-service && npm install --include=dev --no-audit --no-fund

COPY services/campaign-service ./services/campaign-service
RUN cd services/campaign-service && npm run build

FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/packages/contracts/package*.json ./packages/contracts/
COPY --from=builder /app/packages/contracts/dist ./packages/contracts/dist
COPY services/campaign-service/package*.json ./services/campaign-service/
RUN cd services/campaign-service && npm install --omit=dev --no-audit --no-fund

COPY --from=builder /app/services/campaign-service/dist ./services/campaign-service/dist

WORKDIR /app/services/campaign-service
CMD ["node", "dist/index.js"]

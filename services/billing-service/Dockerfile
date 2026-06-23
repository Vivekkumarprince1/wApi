FROM node:20-alpine AS builder

WORKDIR /app

COPY packages/contracts ./packages/contracts
RUN cd packages/contracts && npm install --include=dev --no-audit --no-fund && npm run build

COPY services/billing-service/package*.json ./services/billing-service/
RUN cd services/billing-service && npm install --include=dev --no-audit --no-fund

COPY services/billing-service ./services/billing-service
RUN cd services/billing-service && npm run build

FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/packages/contracts/package*.json ./packages/contracts/
COPY --from=builder /app/packages/contracts/dist ./packages/contracts/dist
COPY services/billing-service/package*.json ./services/billing-service/
RUN cd services/billing-service && npm install --omit=dev --no-audit --no-fund

COPY --from=builder /app/services/billing-service/dist ./services/billing-service/dist

WORKDIR /app/services/billing-service
CMD ["node", "dist/index.js"]

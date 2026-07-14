FROM mirror.gcr.io/library/node:24-alpine AS builder
WORKDIR /app
COPY packages/contracts/package*.json ./packages/contracts/
RUN cd packages/contracts && npm ci
COPY packages/contracts ./packages/contracts
RUN cd packages/contracts && npm run build

COPY services/api-gateway/package*.json ./services/api-gateway/
RUN cd services/api-gateway && npm ci
COPY services/api-gateway ./services/api-gateway
RUN cd services/api-gateway && npm run build

FROM mirror.gcr.io/library/node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/packages/contracts ./packages/contracts
COPY --from=builder /app/services/api-gateway ./services/api-gateway
WORKDIR /app/services/api-gateway
EXPOSE 5001
USER node
CMD ["npm", "run", "start"]

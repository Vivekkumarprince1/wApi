FROM node:20-alpine AS builder
WORKDIR /app
COPY packages/contracts/package*.json ./packages/contracts/
RUN cd packages/contracts && npm ci --include=dev
COPY packages/contracts ./packages/contracts
RUN cd packages/contracts && npm run build

COPY services/service-provider/package*.json ./services/service-provider/
RUN cd services/service-provider && npm ci --include=dev
COPY services/service-provider ./services/service-provider
RUN cd services/service-provider && npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/packages/contracts ./packages/contracts
COPY --from=builder /app/services/service-provider ./services/service-provider
WORKDIR /app/services/service-provider
EXPOSE 3004
CMD ["npm", "run", "start"]

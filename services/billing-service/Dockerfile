FROM node:24-alpine AS builder
WORKDIR /app
COPY packages/contracts/package*.json ./packages/contracts/
RUN cd packages/contracts && npm install
COPY packages/contracts ./packages/contracts
RUN cd packages/contracts && npm run build

COPY services/billing-service/package*.json ./services/billing-service/
RUN cd services/billing-service && npm install
COPY services/billing-service ./services/billing-service
RUN cd services/billing-service && npm run build

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/packages/contracts ./packages/contracts
COPY --from=builder /app/services/billing-service ./services/billing-service
WORKDIR /app/services/billing-service
EXPOSE 3003
CMD ["npm", "run", "start"]

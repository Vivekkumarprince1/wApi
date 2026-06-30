FROM node:24-alpine AS builder
WORKDIR /app
COPY packages/contracts/package*.json ./packages/contracts/
RUN cd packages/contracts && npm install
COPY packages/contracts ./packages/contracts
RUN cd packages/contracts && npm run build

COPY services/automation-service/package*.json ./services/automation-service/
RUN cd services/automation-service && npm install
COPY services/automation-service ./services/automation-service
RUN cd services/automation-service && npm run build

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/packages/contracts ./packages/contracts
COPY --from=builder /app/services/automation-service ./services/automation-service
WORKDIR /app/services/automation-service
EXPOSE 3001
CMD ["npm", "run", "start"]

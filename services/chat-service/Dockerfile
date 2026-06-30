FROM node:24-alpine AS builder
WORKDIR /app
COPY packages/contracts/package*.json ./packages/contracts/
RUN cd packages/contracts && npm install
COPY packages/contracts ./packages/contracts
RUN cd packages/contracts && npm run build

COPY services/chat-service/package*.json ./services/chat-service/
RUN cd services/chat-service && npm install
COPY services/chat-service ./services/chat-service
RUN cd services/chat-service && npm run build

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/packages/contracts ./packages/contracts
COPY --from=builder /app/services/chat-service ./services/chat-service
WORKDIR /app/services/chat-service
EXPOSE 3008
CMD ["npm", "run", "start"]

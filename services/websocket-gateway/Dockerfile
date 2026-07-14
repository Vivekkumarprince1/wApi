FROM mirror.gcr.io/library/node:24-alpine AS builder
WORKDIR /app
COPY services/websocket-gateway/package*.json ./services/websocket-gateway/
RUN cd services/websocket-gateway && npm install
COPY services/websocket-gateway ./services/websocket-gateway
RUN cd services/websocket-gateway && npm run build

FROM mirror.gcr.io/library/node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/services/websocket-gateway ./services/websocket-gateway
WORKDIR /app/services/websocket-gateway
EXPOSE 3009
USER node
CMD ["npm", "run", "start"]

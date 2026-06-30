FROM node:24-alpine AS builder
WORKDIR /app
COPY services/webhook-ingestor/package*.json ./services/webhook-ingestor/
RUN cd services/webhook-ingestor && npm install
COPY services/webhook-ingestor ./services/webhook-ingestor
RUN cd services/webhook-ingestor && npm run build

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/services/webhook-ingestor ./services/webhook-ingestor
WORKDIR /app/services/webhook-ingestor
EXPOSE 3013
CMD ["npm", "run", "start"]

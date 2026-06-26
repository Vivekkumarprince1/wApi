FROM node:20-alpine AS builder
WORKDIR /app
COPY services/api-gateway/package*.json ./services/api-gateway/
RUN cd services/api-gateway && npm ci --include=dev
COPY services/api-gateway ./services/api-gateway
RUN cd services/api-gateway && npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/services/api-gateway ./services/api-gateway
WORKDIR /app/services/api-gateway
EXPOSE 5001
CMD ["npm", "run", "start"]

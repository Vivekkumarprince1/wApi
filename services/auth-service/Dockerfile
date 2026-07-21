FROM mirror.gcr.io/library/node:24-alpine AS builder
WORKDIR /app
COPY packages/contracts/package*.json ./packages/contracts/
RUN cd packages/contracts && npm install
COPY packages/contracts ./packages/contracts
RUN cd packages/contracts && npm run build

COPY services/auth-service/package*.json ./services/auth-service/
RUN cd services/auth-service && npm install
COPY services/auth-service ./services/auth-service
RUN cd services/auth-service && npm run build

FROM mirror.gcr.io/library/node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/packages/contracts ./packages/contracts
COPY --from=builder /app/services/auth-service ./services/auth-service
WORKDIR /app/services/auth-service
RUN npm prune --omit=dev && rm -rf /usr/local/lib/node_modules/npm
EXPOSE 3006
USER node
CMD ["node", "dist/index.js"]

FROM mirror.gcr.io/library/node:24-alpine AS builder
WORKDIR /app
COPY packages/contracts/package*.json ./packages/contracts/
RUN cd packages/contracts && npm install
COPY packages/contracts ./packages/contracts
RUN cd packages/contracts && npm run build

COPY services/contact-service/package*.json ./services/contact-service/
RUN cd services/contact-service && npm install
COPY services/contact-service ./services/contact-service
RUN cd services/contact-service && npm run build

FROM mirror.gcr.io/library/node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/packages/contracts ./packages/contracts
COPY --from=builder /app/services/contact-service ./services/contact-service
WORKDIR /app/services/contact-service
EXPOSE 3007
USER node
CMD ["npm", "run", "start"]

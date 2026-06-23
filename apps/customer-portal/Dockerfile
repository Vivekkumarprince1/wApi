FROM node:20-alpine AS builder

WORKDIR /app

COPY packages/contracts ./packages/contracts
RUN cd packages/contracts && npm install --include=dev --no-audit --no-fund && npm run build

COPY apps/customer-portal/package*.json ./apps/customer-portal/
RUN cd apps/customer-portal && npm install --include=dev --no-audit --no-fund

COPY apps/customer-portal ./apps/customer-portal
RUN cd apps/customer-portal && npm run build

FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/packages/contracts/package*.json ./packages/contracts/
COPY --from=builder /app/packages/contracts/dist ./packages/contracts/dist
COPY apps/customer-portal/package*.json ./apps/customer-portal/
RUN cd apps/customer-portal && npm install --omit=dev --no-audit --no-fund

COPY --from=builder /app/apps/customer-portal/.next ./apps/customer-portal/.next
COPY --from=builder /app/apps/customer-portal/public ./apps/customer-portal/public
COPY --from=builder /app/apps/customer-portal/next.config.ts ./apps/customer-portal/next.config.ts

WORKDIR /app/apps/customer-portal
CMD ["sh", "-c", "npx next start -p ${PORT:-3000}"]

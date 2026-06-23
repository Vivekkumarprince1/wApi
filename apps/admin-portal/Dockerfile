FROM node:20-alpine AS builder

WORKDIR /app

COPY packages/contracts ./packages/contracts
RUN cd packages/contracts && npm install --include=dev --no-audit --no-fund && npm run build

COPY apps/admin-portal/package*.json ./apps/admin-portal/
RUN cd apps/admin-portal && npm install --include=dev --no-audit --no-fund

COPY apps/admin-portal ./apps/admin-portal
RUN cd apps/admin-portal && npm run build

FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/packages/contracts/package*.json ./packages/contracts/
COPY --from=builder /app/packages/contracts/dist ./packages/contracts/dist
COPY apps/admin-portal/package*.json ./apps/admin-portal/
RUN cd apps/admin-portal && npm install --omit=dev --no-audit --no-fund

COPY --from=builder /app/apps/admin-portal/.next ./apps/admin-portal/.next
COPY --from=builder /app/apps/admin-portal/public ./apps/admin-portal/public
COPY --from=builder /app/apps/admin-portal/next.config.ts ./apps/admin-portal/next.config.ts

WORKDIR /app/apps/admin-portal
CMD ["sh", "-c", "npx next start -p ${PORT:-3100}"]

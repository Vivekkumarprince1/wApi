FROM node:20-alpine AS builder
WORKDIR /app
COPY apps/customer-portal/package*.json ./apps/customer-portal/
RUN cd apps/customer-portal && npm install
COPY apps/customer-portal ./apps/customer-portal
RUN cd apps/customer-portal && npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/apps/customer-portal ./apps/customer-portal
WORKDIR /app/apps/customer-portal
EXPOSE 3000
CMD ["npm", "run", "start"]

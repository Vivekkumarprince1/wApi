FROM node:20-alpine AS builder
WORKDIR /app
COPY apps/frontend/package*.json ./apps/frontend/
RUN cd apps/frontend && npm install
COPY apps/frontend ./apps/frontend
RUN cd apps/frontend && npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/apps/frontend ./apps/frontend
WORKDIR /app/apps/frontend
EXPOSE 3000
CMD ["npm", "run", "start"]

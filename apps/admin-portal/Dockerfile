FROM node:20-alpine AS builder
WORKDIR /app
ARG NEXT_PUBLIC_APP_NAME="wApi Super Admin"
ARG NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_APP_NAME=$NEXT_PUBLIC_APP_NAME
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
COPY packages/contracts/package*.json ./packages/contracts/
RUN cd packages/contracts && npm install
COPY packages/contracts ./packages/contracts
RUN cd packages/contracts && npm run build

COPY apps/admin-portal/package*.json ./apps/admin-portal/
RUN cd apps/admin-portal && npm install
COPY apps/admin-portal ./apps/admin-portal
RUN cd apps/admin-portal && npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ARG NEXT_PUBLIC_APP_NAME="wApi Super Admin"
ARG NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_APP_NAME=$NEXT_PUBLIC_APP_NAME
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
COPY --from=builder /app/packages/contracts ./packages/contracts
COPY --from=builder /app/apps/admin-portal ./apps/admin-portal
WORKDIR /app/apps/admin-portal
EXPOSE 3100
CMD ["npm", "run", "start"]

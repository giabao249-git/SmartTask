FROM node:22-alpine AS builder

RUN apk add --no-cache python3 make g++ openssl

WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/

COPY packages/shared ./packages/shared

RUN npm ci

COPY apps/api ./apps/api

RUN npm run shared:build \
 && npm run db:generate \
 && npm run api:build \
 && mkdir -p /app/apps/api/node_modules

FROM node:22-alpine AS runner

RUN apk add --no-cache openssl

WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared/package.json ./packages/shared/
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/apps/api/package.json ./apps/api/
COPY --from=builder /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder /app/apps/api/src ./apps/api/src
COPY --from=builder /app/apps/api/tsconfig.json ./apps/api/tsconfig.json
COPY --from=builder /app/apps/api/docker-entrypoint.sh ./apps/api/docker-entrypoint.sh

RUN chmod +x /app/apps/api/docker-entrypoint.sh \
 && mkdir -p /app/apps/api/uploads

WORKDIR /app/apps/api
EXPOSE 3000

ENTRYPOINT ["./docker-entrypoint.sh"]

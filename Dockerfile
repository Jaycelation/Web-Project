# syntax=docker/dockerfile:1.7
# Render image: one public gateway with isolated internal web and API processes.

FROM node:22-bookworm-slim AS runtime-base
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl \
 && rm -rf /var/lib/apt/lists/*

FROM runtime-base AS builder
WORKDIR /app
ENV CI=true NEXT_TELEMETRY_DISABLED=1
ARG NEXT_PUBLIC_API_URL=/api/v1
ARG NEXT_PUBLIC_SITE_URL=http://localhost:10000
ARG NEXT_PUBLIC_CRYPTO_SERVER_KEY_SHA256=
ARG NEXT_PUBLIC_CRYPTO_SIGNING_KEY_SHA256=
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_CRYPTO_SERVER_KEY_SHA256=$NEXT_PUBLIC_CRYPTO_SERVER_KEY_SHA256
ENV NEXT_PUBLIC_CRYPTO_SIGNING_KEY_SHA256=$NEXT_PUBLIC_CRYPTO_SIGNING_KEY_SHA256

COPY package.json package-lock.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/crypto-envelope/package.json packages/crypto-envelope/package.json
COPY packages/domain/package.json packages/domain/package.json
RUN --mount=type=cache,target=/root/.npm,sharing=locked npm ci

COPY packages ./packages
COPY apps/api ./apps/api
COPY apps/web ./apps/web
RUN npm run build -w @secure-commerce/contracts \
 && npm run build -w @secure-commerce/crypto-envelope \
 && npm run build -w @secure-commerce/domain \
 && npm run db:generate -w @secure-commerce/api \
 && npm run build -w @secure-commerce/api \
 && npm run build -w @secure-commerce/web

FROM builder AS production-dependencies
RUN npm prune --omit=dev

FROM runtime-base AS runner
WORKDIR /app
ENV NODE_ENV=production \
    API_PORT=4000 \
    PORT=10000 \
    NEXT_TELEMETRY_DISABLED=1 \
    API_INTERNAL_URL=http://127.0.0.1:4000/api/v1

COPY --chown=node:node --from=production-dependencies /app/node_modules ./node_modules
COPY --chown=node:node --from=production-dependencies /app/apps/api/node_modules ./apps/api/node_modules
COPY --chown=node:node --from=builder /app/package.json /app/package-lock.json ./
COPY --chown=node:node --from=builder /app/apps/api/package.json ./apps/api/package.json
COPY --chown=node:node --from=builder /app/apps/api/dist ./apps/api/dist
COPY --chown=node:node --from=builder /app/apps/api/prisma ./apps/api/prisma
COPY --chown=node:node --from=builder /app/packages ./packages
COPY --chown=node:node --from=builder /app/apps/web/.next/standalone ./web
COPY --chown=node:node --from=builder /app/apps/web/.next/static ./web/apps/web/.next/static
COPY --chown=node:node --from=builder /app/apps/web/public ./web/apps/web/public
COPY --chown=node:node scripts/render-entrypoint.mjs ./scripts/render-entrypoint.mjs
USER node
EXPOSE 10000
CMD ["node", "scripts/render-entrypoint.mjs"]

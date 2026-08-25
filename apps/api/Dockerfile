FROM node:22-bookworm-slim AS api-base
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl \
 && rm -rf /var/lib/apt/lists/*

FROM api-base AS builder
WORKDIR /app
ENV CI=true
COPY package.json package-lock.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/crypto-envelope/package.json packages/crypto-envelope/package.json
COPY packages/domain/package.json packages/domain/package.json
RUN --mount=type=cache,target=/root/.npm,sharing=locked npm ci
COPY packages ./packages
COPY apps/api ./apps/api
RUN npm run build -w @secure-commerce/contracts \
 && npm run build -w @secure-commerce/crypto-envelope \
 && npm run build -w @secure-commerce/domain \
 && npm run db:generate -w @secure-commerce/api \
 && npm run build -w @secure-commerce/api

FROM builder AS migration
CMD ["npm", "run", "db:deploy", "-w", "@secure-commerce/api"]

FROM builder AS production-dependencies
RUN npm prune --omit=dev

FROM api-base AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=production-dependencies /app/node_modules ./node_modules
COPY --from=production-dependencies /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder /app/packages ./packages
RUN mkdir -p /app/apps/api/.local/keys && chown -R node:node /app/apps/api/.local
USER node
EXPOSE 4000
CMD ["node", "apps/api/dist/main.js"]

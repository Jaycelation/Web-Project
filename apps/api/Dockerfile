FROM node:22-bookworm-slim AS builder
WORKDIR /app
ENV CI=true
COPY package.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/crypto-envelope/package.json packages/crypto-envelope/package.json
COPY packages/domain/package.json packages/domain/package.json
RUN npm install
COPY packages ./packages
COPY apps/api ./apps/api
RUN npm run build -w @secure-commerce/contracts \
 && npm run build -w @secure-commerce/crypto-envelope \
 && npm run build -w @secure-commerce/domain \
 && npm run db:generate -w @secure-commerce/api \
 && npm run build -w @secure-commerce/api

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder /app/packages ./packages
EXPOSE 4000
CMD ["sh", "-c", "npm run db:push -w @secure-commerce/api && npm run db:seed -w @secure-commerce/api && node apps/api/dist/main.js"]

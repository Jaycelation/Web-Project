# Ghi chú bàn giao

## Thành phần

- Source monorepo: `apps`, `packages`, `scripts`.
- PostgreSQL schema + seed: `apps/api/prisma`.
- Docker Compose và Dockerfile cho API/web.
- Tài liệu kiến trúc, security, scope và acceptance trong `docs`.
- Test lõi: `scripts/acceptance-core.test.mjs`.
- Smoke test API: `scripts/acceptance-api.mjs`.

## Kết quả xác minh tại thời điểm đóng gói

- `node --test scripts/acceptance-core.test.mjs`: 6/6 pass.
- Parse TypeScript/TSX bằng TypeScript compiler API: không có parse error.
- Dependency install/full build chưa thể chạy trong môi trường đóng gói do DNS tới npm registry không khả dụng.

## Việc đầu tiên bên nhận nên chạy

```bash
cp .env.example .env
npm install
npm run build
npm run typecheck
npm test
docker compose up --build
API_BASE_URL=http://localhost:4000/api/v1 npm run test:api
```

Mọi secret và credential trong repo là giá trị demo, phải thay trước khi expose.

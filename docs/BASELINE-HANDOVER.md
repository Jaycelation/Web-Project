NOTE v0.2 (2026-10-02): This is baseline documentation retained from the uploaded ZIP. Historical PASS claims were NOT revalidated. Current evidence and limitations: docs/verification/README.md and docs/UPGRADE-REVIEW-VI.md.

# Ghi chú bàn giao

## Thành phần

- Source monorepo: `apps`, `packages`, `scripts`.
- PostgreSQL schema, migration bất biến và seed: `apps/api/prisma`.
- Docker Compose với service `migrate`, `seed`, `api`, `web`, `db` và healthcheck.
- Tài liệu kiến trúc, security, scope và acceptance trong `docs`.
- Test lõi/bảo mật: `scripts/acceptance-core.test.mjs`, `scripts/acceptance-security.test.mjs`.
- Acceptance API live: `scripts/acceptance-api.mjs`.
- Lockfile npm và workflow CI trong `.github/workflows/ci.yml`.
- JOSE dual-stack: storefront dùng JWE v2; server tạm nhận legacy v1 qua `CRYPTO_ACCEPT_V1`.
- Hai RSA key pair tách biệt: encryption `RSA-OAEP-256` và response signing `PS256`.

## Kết quả xác minh ngày 2026-08-25

- Node.js `v22.23.2`; dependency cài bằng `npm ci` từ lockfile.
- Full typecheck và build monorepo: pass.
- Core + security acceptance: pass, gồm JWE/JWS tamper, signature, binding, no-downgrade, replay và production config.
- `npm audit`: 0 advisory tại thời điểm chạy.
- Docker image build: pass; migration/seed exit 0; API, web và PostgreSQL healthy.
- API acceptance: JWE v2 + signed response, legacy v1 smoke, auth/session, refresh rotation, CSRF và RBAC pass; write acceptance COD/idempotency/guest tracking đã có record riêng.
- Chromium production-container smoke: đăng nhập tới `/tai-khoan`, request/response đều `v2`, không có console/page error.

Chi tiết cập nhật nằm trong `docs/TEST-RESULTS.txt` và `docs/IMPLEMENTATION-CHECKLIST.md`.

## Việc đầu tiên bên nhận nên chạy

```bash
cp .env.example .env
nvm use
npm ci
npm run verify
docker compose up --build -d
API_BASE_URL=http://localhost:4000/api/v1 npm run test:api
```

Compose mặc định là stack local/demo và seed credential mẫu. Mọi secret/credential/khóa phải được thay trước khi expose; production phải cấp hai key pair, hai fingerprint pin, HTTPS và `CRYPTO_AUTO_GENERATE=false`. Chỉ tắt `CRYPTO_ACCEPT_V1` sau khi telemetry xác nhận không còn client cũ.

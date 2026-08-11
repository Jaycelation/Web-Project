# Secure Commerce

Monorepo TypeScript cho website thương mại điện tử MVP theo kiến trúc **modular monolith**, gồm:

- **Frontend:** Next.js App Router.
- **Backend:** NestJS.
- **Database:** PostgreSQL + Prisma.
- **Application-layer encryption:** RSA-OAEP-SHA-256 + AES-256-GCM cho request/response nghiệp vụ.
- **Luồng thanh toán MVP:** COD và chuyển khoản ngân hàng.

> Lớp mã hóa ứng dụng không thay thế TLS. Production vẫn bắt buộc HTTPS, quản lý khóa bằng secret manager/HSM/KMS và pin/verify server public key qua một kênh tin cậy.

## 1. Phạm vi đã triển khai

### Storefront

- Trang chủ, danh mục, tìm kiếm, lọc, sắp xếp và phân trang.
- Trang chi tiết sản phẩm, hình ảnh, biến thể, tồn khả dụng và chính sách.
- Giỏ hàng responsive; lưu local cho khách và API cart cho tài khoản.
- Checkout khách hoặc thành viên, quote phía server, coupon, COD/chuyển khoản.
- Idempotency chống tạo trùng đơn.
- Đăng ký, đăng nhập, đăng xuất, refresh session, quên/đặt lại mật khẩu.
- Hồ sơ, nhiều địa chỉ, đổi mật khẩu, lịch sử đơn, hủy và yêu cầu đổi trả.
- Tra cứu đơn khách bằng mã đơn + email.
- Newsletter và các trang chính sách/CMS.

### Back office

- Dashboard doanh thu, đơn hàng, AOV, khách mới, tỷ lệ hủy, best seller, low stock.
- Danh sách/tạo/cập nhật sản phẩm và biến thể.
- Điều chỉnh tồn kho có inventory movement.
- Danh sách đơn, cập nhật state machine, mã vận đơn và ghi chú.
- Danh sách khách, khóa/mở tài khoản.
- Quản lý nội dung chính sách.
- Audit log cho thao tác quản trị quan trọng.

### Kiểm soát bảo mật

- Envelope v1: **RSA-OAEP-256** bọc khóa AES; **A256GCM** mã hóa body.
- AAD ràng buộc direction, method, path, requestId, timestamp, nonce và client key.
- Response được mã hóa về public key tạm của browser và bind với requestId + request nonce.
- Replay window + nonce cache; server key ID và cơ chế refresh khi xoay khóa.
- Cookie HttpOnly, refresh token rotation, Argon2id, CSRF double-submit, Origin allow-list.
- RBAC CUSTOMER/STAFF/ADMIN, throttling, validation whitelist, Helmet và CSP.
- Server tự tính lại giá, coupon, phí vận chuyển và tồn kho.
- Checkout transaction `Serializable` + unique idempotency scope/key.
- Inventory reservation, release/restock và lịch sử trạng thái đơn.

Chi tiết: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), [docs/SECURITY.md](docs/SECURITY.md), [docs/SCOPE.md](docs/SCOPE.md).

## 2. Chạy nhanh bằng Docker Compose

Yêu cầu: Docker Engine có Compose plugin.

```bash
cp .env.example .env
# Thay JWT_ACCESS_SECRET và POSTGRES_PASSWORD trước khi dùng ngoài máy cá nhân.
docker compose up --build
```

Truy cập:

- Web: `http://localhost:3000`
- API health: `http://localhost:4000/api/v1/health`
- Server public key: `http://localhost:4000/api/v1/crypto/server-key`

Container API tự tạo RSA development key trong volume, đồng bộ schema và seed dữ liệu. Cơ chế `db push` này chỉ dành cho demo/MVP; production phải dùng migration được review và quy trình deploy riêng.

## 3. Chạy local

Yêu cầu: Node.js 22+, npm 10+, PostgreSQL 16+.

```bash
cp .env.example .env
npm install
npm run crypto:keys
npm run db:generate
npm run db:push
npm run db:seed
npm run dev
```

Nếu PostgreSQL chạy trong Docker nhưng app chạy local:

```bash
docker compose up -d db
npm run db:generate
npm run db:push
npm run db:seed
npm run dev
```

## 4. Tài khoản seed

| Vai trò | Email | Mật khẩu |
|---|---|---|
| Admin | `admin@securecommerce.local` | `Admin@12345` |
| Customer | `customer@securecommerce.local` | `Customer@12345` |

Các credential trên chỉ dùng cho môi trường demo. Hãy xóa hoặc thay đổi trước khi expose hệ thống.

Coupon demo: `WELCOME10`.

## 5. Lệnh chính

```bash
npm run dev            # API + web
npm run build          # Build toàn monorepo
npm run typecheck      # Typecheck workspace
npm test               # Core acceptance + workspace tests
npm run test:core      # Crypto, pricing, stock, order state machine
npm run test:api       # Smoke test API đang chạy
npm run db:generate
npm run db:push
npm run db:migrate
npm run db:seed
npm run crypto:keys
```

Smoke test mặc định là read-only:

```bash
API_BASE_URL=http://localhost:4000/api/v1 npm run test:api
```

Cho phép acceptance test tạo một đơn COD demo:

```bash
ACCEPTANCE_WRITE=1 API_BASE_URL=http://localhost:4000/api/v1 npm run test:api
```

Không bật `ACCEPTANCE_WRITE` trên production.

## 6. Cấu trúc source

```text
secure-commerce/
├── apps/
│   ├── api/                 # NestJS modular monolith + Prisma
│   └── web/                 # Next.js storefront/admin
├── packages/
│   ├── contracts/           # DTO/type dùng chung
│   ├── crypto-envelope/     # Protocol + SecureApiClient
│   └── domain/              # Pricing + order state machine
├── scripts/                 # Key generation và acceptance tests
├── docs/                    # Kiến trúc, threat model, scope, nghiệm thu
└── docker-compose.yml
```

Các bounded module của API: `auth`, `account`, `catalog`, `cart`, `checkout`, `orders`, `admin`, `content`, `marketing`, `notifications`, cùng `infrastructure/crypto-envelope` và `infrastructure/prisma`.

## 7. Envelope protocol v1

Request nghiệp vụ có dạng khái quát:

```json
{
  "version": 1,
  "keyId": "server-key-id",
  "algorithm": "RSA-OAEP-256",
  "contentEncryption": "A256GCM",
  "encryptedKey": "base64url(RSA-OAEP(aesKey))",
  "iv": "base64url(12-byte-iv)",
  "ciphertext": "base64url(ciphertext+gcm-tag)",
  "aad": {
    "version": 1,
    "direction": "request",
    "method": "POST",
    "path": "/api/v1/catalog/search",
    "requestId": "uuid",
    "timestamp": 0,
    "nonce": "random-base64url",
    "clientKeyId": "sha256-spki",
    "clientPublicKey": { "kty": "RSA", "n": "...", "e": "AQAB" }
  }
}
```

Luồng:

1. Browser tải public key của server qua HTTPS và kiểm tra fingerprint pin nếu được cấu hình.
2. Browser tạo RSA-OAEP key pair tạm cho response.
3. Mỗi request tạo AES-256 key + IV mới; AES key được bọc bằng server RSA key.
4. Server giải mã, kiểm tra AAD route/timestamp/fingerprint/nonce, rồi chạy validation và nghiệp vụ.
5. Server tạo AES key mới cho response, bọc key đó bằng public key tạm của browser.
6. Browser kiểm tra requestId, request nonce và HTTP status sau khi giải mã.

Endpoint plaintext duy nhất: `GET /health` và `GET /crypto/server-key`. Tất cả endpoint nghiệp vụ bị `SecureEnvelopeGuard` bắt buộc envelope.

## 8. Biến môi trường quan trọng

Xem đầy đủ trong `.env.example`.

- `DATABASE_URL`
- `JWT_ACCESS_SECRET`
- `WEB_ORIGIN`
- `COOKIE_SECURE`
- `CRYPTO_KEY_ID`
- `CRYPTO_PRIVATE_KEY_PATH`
- `CRYPTO_PUBLIC_KEY_PATH`
- `CRYPTO_AUTO_GENERATE`
- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_CRYPTO_SERVER_KEY_SHA256`
- `BASE_SHIPPING_FEE`, `FREE_SHIPPING_THRESHOLD`
- `BANK_NAME`, `BANK_ACCOUNT_NUMBER`, `BANK_ACCOUNT_NAME`

## 9. Giới hạn có chủ đích của bản MVP

- Notification dùng **outbox**; chưa có worker SMTP/SMS thật.
- CARD/EWALLET có model mở rộng nhưng checkout UI/API chỉ cho COD và chuyển khoản.
- Replay cache là in-memory, phù hợp một API instance. Scale ngang cần Redis hoặc durable store dùng chung.
- Chưa tích hợp carrier, payment gateway callback, object storage, antivirus upload hoặc ERP/WMS.
- Không lưu dữ liệu thẻ.
- Dashboard là operational dashboard cơ bản, chưa phải data warehouse/BI.
- `db push` và seed trong Docker Compose thuận tiện cho demo, không phải quy trình migration production.

## 10. Trước khi triển khai production

Tối thiểu phải thực hiện các mục trong [docs/ACCEPTANCE.md](docs/ACCEPTANCE.md), đặc biệt:

- TLS termination + HSTS; pin fingerprint hoặc ký descriptor public key.
- KMS/HSM/secret manager; key rotation có version và rollback.
- Migration bất biến, backup/restore drill và observability.
- Redis replay cache khi nhiều instance.
- SMTP/provider thật với retry worker; payment callback signature verification nếu tích hợp cổng.
- SAST, dependency audit, DAST, test race condition và penetration test độc lập.
- Thay toàn bộ secret/demo credential và rà soát pháp lý các trang chính sách.

## 11. Trạng thái kiểm thử của gói bàn giao

Trong môi trường tạo gói:

- Core acceptance: **6/6 pass**.
- Parse check: **124 tệp TypeScript/TSX, 0 parse error** trước khi thêm tài liệu/tài nguyên.
- Full `npm install/build/typecheck` không chạy được tại môi trường đóng gói vì DNS tới npm registry không khả dụng. Hãy chạy lại các lệnh ở mục 5 trong môi trường có mạng trước khi deploy.


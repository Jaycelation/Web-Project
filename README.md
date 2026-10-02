# MIRA Commerce v0.2

> Bản nâng cấp source ngày 02/10/2026. Xem [review, tính năng, hướng dẫn và giới hạn](docs/UPGRADE-REVIEW-VI.md). **80 kiểm thử cục bộ qua; chưa full build/integration.** Next 16.3.0 trong lockfile cần vá bằng `npm run security:patch-next` và verify trước khi public.

Monorepo TypeScript cho website thương mại điện tử MVP theo kiến trúc **modular monolith**, gồm:

- **Frontend:** Next.js App Router.
- **Backend:** NestJS.
- **Database:** PostgreSQL + Prisma.
- **Application-layer protection:** JWE `RSA-OAEP-256` + `A256GCM`; response được ký JWS `PS256` trước khi mã hóa.
- **Luồng thanh toán MVP:** COD và chuyển khoản ngân hàng.

> Lớp mã hóa ứng dụng không thay thế TLS. Production vẫn bắt buộc HTTPS, quản lý khóa bằng secret manager/HSM/KMS và pin/verify server public key qua một kênh tin cậy.

## 1. Phạm vi đã triển khai

### Storefront

- Trang chủ, danh mục, tìm kiếm, lọc, sắp xếp và phân trang.
- Trang chi tiết sản phẩm, hình ảnh, biến thể, tồn khả dụng và chính sách.
- Giỏ hàng responsive, lưu local; backend có API cart nhưng storefront chưa đồng bộ cart tài khoản.
- Yêu thích (20), so sánh (4), đã xem (12), lưu trình duyệt.
- Review đơn đã giao, chờ duyệt, tổng hợp sao và phân trang.
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
- Duyệt review, quản lý coupon, đối soát chuyển khoản thủ công, export CSV giới hạn 250 đơn.
- Audit log cho thao tác quản trị quan trọng và UI tra cứu ADMIN.

### Kiểm soát bảo mật

- JWE v2 Flattened JSON: **RSA-OAEP-256** + **A256GCM**, exact protected-header/algorithm allow-list.
- Metadata được mã hóa ràng buộc direction, method, path, requestId, timestamp, nonce, client key, CSRF và idempotency header.
- Response được ký bằng key `PS256` riêng rồi mã hóa về public key tạm của browser.
- Response bind với requestId, request nonce, HTTP status, timestamp và server key ID.
- Dual-stack migration: server nhận v1/v2; storefront dùng v2 và không tự downgrade.
- Replay window + nonce cache; descriptor có encryption/signing key ID, fingerprint và cơ chế refresh khi xoay khóa.
- Cookie HttpOnly, refresh token rotation, Argon2id, CSRF double-submit, Origin allow-list.
- RBAC CUSTOMER/STAFF/ADMIN, throttling, validation whitelist, Helmet và CSP.
- Server tự tính lại giá, coupon, phí vận chuyển và tồn kho.
- Checkout transaction `Serializable` + unique idempotency scope/key.
- Inventory reservation, release/restock và lịch sử trạng thái đơn.

Chi tiết: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), [docs/SECURITY.md](docs/SECURITY.md), [docs/SCOPE.md](docs/SCOPE.md) và [checklist triển khai](docs/IMPLEMENTATION-CHECKLIST.md).

## 2. Chạy nhanh bằng Docker Compose

Yêu cầu: Docker Engine có Compose plugin; npm/Node trên host để cập nhật dependency trước khi build.

```bash
cp .env.example .env
# Thay JWT_ACCESS_SECRET và POSTGRES_PASSWORD trước khi dùng ngoài máy cá nhân.
npm ci
npm run security:patch-next
docker compose up --build
```

Truy cập:

- Web: `http://localhost:3000`
- API health: `http://localhost:4000/api/v1/health`
- Server public key: `http://localhost:4000/api/v1/crypto/server-key`

Compose khởi động theo thứ tự `db → migrate → seed → api → web`. Schema được áp dụng bằng migration bất biến; seed là one-shot service idempotent. API tự tạo hai RSA development key pair (encryption/signing) trong volume. Stack Compose mặc định chỉ dành cho local/demo; production phải cung cấp khóa/secret riêng và không chạy demo seed.

## 3. Chạy local

Yêu cầu: Node.js 22+, npm 10+, PostgreSQL 16+.

```bash
cp .env.example .env
nvm use
npm ci
npm run security:patch-next
npm run local -- run crypto:keys
npm run local -- run db:generate
npm run local -- run db:deploy
npm run local -- run db:seed
npm run dev
```

Nếu PostgreSQL chạy trong Docker nhưng app chạy local:

```bash
docker compose up -d db
npm run local -- run crypto:keys
npm run local -- run db:generate
npm run local -- run db:deploy
npm run local -- run db:seed
npm run dev
```

## 4. Tài khoản seed

| Vai trò  | Email                           | Mật khẩu         |
| -------- | ------------------------------- | ---------------- |
| Admin    | `admin@securecommerce.local`    | `Admin@12345`    |
| Customer | `customer@securecommerce.local` | `Customer@12345` |

Các credential trên chỉ dùng cho môi trường demo. Hãy xóa hoặc thay đổi trước khi expose hệ thống.

Coupon demo: `WELCOME10`.

## 5. Lệnh chính

```bash
npm run dev            # API + web
npm run build          # Build toàn monorepo
npm run typecheck      # Typecheck workspace
npm test               # Core + security + workspace tests
npm run test:core      # Crypto, pricing, stock, order state machine
npm run test:security  # Replay cache, CSRF và production config
npm run test:workspaces # Test scripts riêng của API/web
npm run test:api       # Smoke/acceptance API đang chạy
npm run verify         # Typecheck + build + test + audit + Compose config
npm run db:generate
npm run db:migrate
npm run db:deploy
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

Các bounded module của API: `auth`, `account`, `catalog`, `cart`, `checkout`, `orders`, `admin`, `content`, `marketing`, `notifications`, `reviews`, `operations`, cùng `infrastructure/crypto-envelope` và `infrastructure/prisma`.

## 7. JWE protocol v2 và cửa sổ tương thích v1

Storefront gửi RFC 7516 Flattened JWE JSON:

```json
{
  "protected": "base64url({alg,enc,kid,typ,cty})",
  "encrypted_key": "base64url(RSA-OAEP-256(cek))",
  "iv": "base64url(96-bit-iv)",
  "ciphertext": "base64url(encrypted-payload)",
  "tag": "base64url(128-bit-gcm-tag)"
}
```

Luồng:

1. Browser tải encryption/signing public key qua HTTPS và kiểm tra hai fingerprint pin nếu được cấu hình.
2. Browser tạo RSA-OAEP key pair tạm cho response.
3. Request metadata/body được mã hóa bằng JWE `RSA-OAEP-256` + `A256GCM` với CEK/IV mới.
4. Server decrypt/tag-verify, kiểm tra exact JOSE profile, route/header/timestamp/key/replay rồi chạy nghiệp vụ.
5. Server ký payload response bằng signing private key `PS256`, sau đó mã hóa Compact JWS về public key browser.
6. Browser decrypt JWE, verify JWS, rồi kiểm tra requestId, request nonce, status, timestamp và key ID trước khi dùng body.

`x-secure-envelope: v2` là mặc định. Server giữ `v1` trong giai đoạn migration khi `CRYPTO_ACCEPT_V1=true`; client v2 không tự downgrade. Sau khi telemetry xác nhận không còn client cũ, đặt biến này thành `false` trước khi xóa code v1.

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
- `CRYPTO_SIGNING_KEY_ID`
- `CRYPTO_SIGNING_PRIVATE_KEY_PATH`
- `CRYPTO_SIGNING_PUBLIC_KEY_PATH`
- `CRYPTO_ACCEPT_V1`
- `CRYPTO_AUTO_GENERATE`
- `ALLOW_DEMO_SEED`
- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_CRYPTO_SERVER_KEY_SHA256`
- `NEXT_PUBLIC_CRYPTO_SIGNING_KEY_SHA256`
- `BASE_SHIPPING_FEE`, `FREE_SHIPPING_THRESHOLD`
- `BANK_NAME`, `BANK_ACCOUNT_NUMBER`, `BANK_ACCOUNT_NAME`

## 9. Giới hạn có chủ đích của bản MVP

- Notification dùng **outbox**; chưa có worker SMTP/SMS thật.
- CARD/EWALLET có model mở rộng nhưng checkout UI/API chỉ cho COD và chuyển khoản.
- Replay cache là in-memory, phù hợp một API instance. Scale ngang cần Redis hoặc durable store dùng chung.
- JWE dùng long-term RSA key nên không tạo forward secrecy; TLS 1.3 vẫn bắt buộc.
- Legacy v1 còn được giữ tạm để tương thích và phải có telemetry/deprecation window trước khi tắt.
- Chưa tích hợp carrier, payment gateway callback, object storage, antivirus upload hoặc ERP/WMS.
- Không lưu dữ liệu thẻ.
- Dashboard là operational dashboard cơ bản, chưa phải data warehouse/BI.
- Migration ban đầu đã có trong source; quy trình review/backup/rollback production vẫn phải được thiết kế theo môi trường triển khai thực tế.
- Demo seed chỉ được phép mặc định ở development; production từ chối seed nếu không bật safety latch rõ ràng.

## 10. Trước khi triển khai production

Tối thiểu phải thực hiện các mục trong [docs/ACCEPTANCE.md](docs/ACCEPTANCE.md), đặc biệt:

- TLS termination + HSTS; cấp cả encryption/signing fingerprint pin qua kênh tin cậy.
- KMS/HSM/secret manager cho hai private key; key rotation có version và rollback.
- Migration bất biến, backup/restore drill và observability.
- Redis replay cache khi nhiều instance.
- SMTP/provider thật với retry worker; payment callback signature verification nếu tích hợp cổng.
- SAST, dependency audit, DAST, test race condition và penetration test độc lập.
- Thay toàn bộ secret/demo credential và rà soát pháp lý các trang chính sách.

## 11. Kiểm thử v0.2 (02/10/2026)

Domain/contracts build qua; 50 unit + 30 isolated service tests qua; 154 file qua syntax check. npm ci bị chặn registry/DNS; full build thiếu jose. Chưa chạy DB/API/browser/Docker/audit. Xem [log thực tế](docs/verification/README.md).

```bash
npm run test:upgrade:unit
npm run test:upgrade:services
npm run check:syntax
npm run local -- run verify
npm run test:upgrade:api
```

## 12. Lịch sử bàn giao gốc - KHÔNG phải kết quả v0.2

> Phần dưới được giữ từ tài liệu trong ZIP gốc. Chưa được kiểm chứng lại; không suy diễn audit/CI của bản này từ các claim cũ.


Đã xác minh trực tiếp ngày **2026-08-25** bằng Node.js 22 và Docker Compose:

- `npm run typecheck`, full monorepo build và `npm audit`: pass; audit không có advisory tại thời điểm chạy.
- Core + security acceptance: **26/26 pass**, gồm JWE/JWS tamper, signature/binding, no-downgrade, replay/CSRF/production-config/session controls.
- Docker images `migrate`, `seed`, `api`, `web`: build thành công; migration và seed exit 0; API/web healthy.
- API acceptance pass: JWE v2 + PS256-signed response, legacy v1 smoke, auth, refresh rotation, stale-token rejection, CSRF và RBAC; write record bao gồm COD checkout, idempotency và guest tracking.
- Chromium production-container login pass tới `/tai-khoan`; request/response dùng v2 và không có console/page error.

Chi tiết lệnh và kết quả: [docs/TEST-RESULTS.txt](docs/TEST-RESULTS.txt). Kết quả này xác nhận baseline local/MVP, không thay thế production load test, DAST hoặc pentest độc lập.

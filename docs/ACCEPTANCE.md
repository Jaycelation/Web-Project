# Checklist nghiệm thu

## A. Tự động

```bash
nvm use
npm ci
npm run verify
docker compose build migrate seed api web
docker compose up -d
```

Sau khi API + DB chạy:

```bash
API_BASE_URL=http://localhost:4000/api/v1 npm run test:api
ACCEPTANCE_WRITE=1 API_BASE_URL=http://localhost:4000/api/v1 npm run test:api
```

Kỳ vọng:

- health và descriptor chứa đúng encryption/signing public key, không có private field;
- JWE v2 catalog search/detail/quote và response JWS `PS256` thành công;
- một legacy v1 smoke vẫn pass trong cửa sổ migration;
- response requestId/nonce/status/key/timestamp binding được client kiểm tra;
- login seed customer và `/auth/me` hoạt động;
- refresh token rotate, token cũ bị từ chối và refresh-only cookie vẫn bắt buộc CSRF;
- route admin từ customer bị chặn nhưng admin truy cập dashboard được;
- write acceptance chỉ tạo một đơn khi retry cùng idempotency key và tra cứu guest order được;
- core JOSE tamper/signature/binding/no-downgrade, pricing/stock/state-machine, replay cache và production config đều pass.

## B. Luồng người dùng

1. Mở trang chủ trên desktop và mobile.
2. Tìm `Aurora`, lọc danh mục, đổi sort và mở chi tiết.
3. Chọn biến thể, thêm vào giỏ, tăng/giảm/xóa.
4. Checkout guest bằng COD; bấm submit lặp lại với cùng idempotency key và xác minh chỉ có một đơn.
5. Checkout chuyển khoản và kiểm tra nội dung chuyển khoản dùng đúng mã đơn.
6. Đăng nhập customer; xem lịch sử, hủy đơn còn pending và yêu cầu trả đơn delivered.
7. Tra cứu guest order bằng mã đơn + email.

## C. Quy tắc tiền và tồn kho

- Chỉnh `unitPrice`, `subtotal`, `discount`, `shippingFee`, `total` trong client/request không làm thay đổi tổng server.
- Mua quá tồn trả lỗi.
- Hai checkout cạnh tranh SKU cuối chỉ một transaction thắng.
- Pending order tăng `reservedStock` nhưng chưa giảm `stock`.
- Confirm giảm cả `stock` và `reservedStock`.
- Cancel pending release reservation.
- Cancel confirmed/preparing restock đúng lượng.
- Mọi thay đổi có `InventoryMovement` và `OrderStatusHistory`.

## D. JWE/JWS và legacy envelope

- Request plaintext tới route nghiệp vụ bị `SECURE_ENVELOPE_REQUIRED`.
- JWE v2 wire chỉ có `protected`, `encrypted_key`, `iv`, `ciphertext`, `tag` và media type `application/jose+json`.
- Sửa từng trường JWE, protected header hoặc thuật toán bị từ chối.
- Sửa method/path, CSRF hoặc idempotency header so với metadata được mã hóa bị từ chối.
- Replay cùng client key + nonce trong TTL bị từ chối.
- Timestamp ngoài clock-skew bị từ chối.
- Client key fingerprint sai bị từ chối.
- Response không có JWS, ký sai key hoặc sai requestId/requestNonce/status/server key bị client từ chối.
- Encryption/signing fingerprint pin sai làm client dừng trước khi gửi dữ liệu nghiệp vụ.
- Client v2 không tự downgrade; v1 chỉ hoạt động khi `CRYPTO_ACCEPT_V1=true`.

## E. Auth/RBAC/CSRF

- Password hash là Argon2id, không có plaintext trong DB/log.
- Login brute-force bị throttle.
- Refresh token rotate; token cũ không còn hợp lệ sau rotation.
- Logout/change/reset password revoke session đúng quy tắc.
- CSRF cookie/header mismatch bị chặn trên mutation có session.
- Customer không gọi được admin endpoint.
- STAFF không khóa/mở customer nếu route yêu cầu ADMIN.
- Locked user không dùng session cũ.

## F. Production gate

Không go-live cho đến khi hoàn tất:

- [ ] HTTPS/HSTS và reverse proxy hardening.
- [ ] KMS/HSM/secret manager cho hai private key, key rotation drill.
- [ ] Cấp cả encryption và signing fingerprint pin trong production build.
- [ ] Redis/durable replay cache nếu có từ hai API instance.
- [ ] Migration được review; backup/restore drill.
- [ ] SMTP/SMS worker và retry/dead-letter monitoring.
- [ ] Payment callback signature/idempotency nếu thêm gateway.
- [ ] Centralized logs/metrics/traces/alerts; redaction kiểm chứng.
- [ ] SAST, dependency audit, container scan, DAST.
- [ ] Load/concurrency test checkout, coupon, stock.
- [ ] Pentest độc lập và remediation verification.
- [ ] Xóa seed credentials; rotate toàn bộ secret.
- [ ] Rà soát pháp lý privacy/terms/returns/invoice/tax.
- [ ] Incident response và rollback runbook.
- [ ] Telemetry và lịch retirement v1; sau đó đặt `CRYPTO_ACCEPT_V1=false`.

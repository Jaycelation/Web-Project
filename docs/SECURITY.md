# Security design và threat model

## Nguyên tắc nền

1. **TLS là bắt buộc.** Envelope encryption là lớp bảo vệ bổ sung, không che được metadata HTTP và không tự xác thực endpoint phân phối public key.
2. **Server là nguồn chân lý** cho giá, coupon, phí, tồn kho, trạng thái đơn và quyền.
3. **Cryptography không thay thế authorization, validation hoặc transaction safety.**
4. **Không lưu PAN/CVV.** CARD/EWALLET chỉ được tích hợp qua provider đạt chuẩn và tokenization.

## Thuật toán

- Key wrapping: RSA-OAEP với SHA-256, descriptor `RSA-OAEP-256`.
- Content encryption: AES-256-GCM, IV ngẫu nhiên 96 bit, tag 128 bit.
- Password: Argon2id.
- Refresh/reset token at rest: SHA-256 hash; raw token chỉ ở cookie/email link.
- Randomness: Web Crypto / Node `crypto` CSPRNG.

## AAD request

AAD được canonicalize và đưa vào AES-GCM additional data:

- protocol version và direction;
- HTTP method và absolute API path;
- requestId;
- timestamp;
- nonce;
- fingerprint và JWK public key tạm của client.

Server kiểm tra method/path thực, cửa sổ thời gian, key fingerprint và nonce chưa dùng. Việc sửa AAD hoặc ciphertext làm GCM authentication thất bại.

## AAD response

Response bind với:

- requestId;
- request nonce;
- HTTP status;
- server key ID;
- response timestamp.

Client chỉ chấp nhận response khi requestId, nonce và status khớp request ban đầu.

## Phân phối và xoay server key

`GET /crypto/server-key` là plaintext về mặt envelope nhưng phải đi qua HTTPS. Client có thể pin `fingerprintSha256` bằng `NEXT_PUBLIC_CRYPTO_SERVER_KEY_SHA256`.

Production nên dùng một trong các mô hình:

- pin fingerprint tại build/deploy;
- descriptor được ký bởi offline root key;
- public key lấy qua config channel tin cậy;
- KMS/HSM quản lý private key và rotation.

`keyId` phải version hóa. Khi API trả `SERVER_KEY_ROTATED`, client tải descriptor mới và retry đúng một lần.

## Threat matrix

| Mối đe dọa | Kiểm soát hiện có | Phần còn lại |
|---|---|---|
| Sửa body/giá | AES-GCM integrity; DTO không có client price; server repricing | Compromised server/DB vẫn có quyền |
| Replay request | timestamp window + client key fingerprint + nonce cache | In-memory cache không dùng chung khi scale ngang |
| Tạo trùng đơn | idempotency unique key + serializable transaction | Caller phải giữ cùng key khi retry cùng intent |
| Race tồn kho | conditional SQL update + serializable transaction | Cần load/race test trên DB production |
| CSRF | SameSite cookies + double-submit CSRF + origin allow-list | XSS cùng origin có thể đọc CSRF token |
| XSS | React escaping, CSP, validation | CMS HTML hiện là text; nếu thêm rich HTML phải sanitize |
| SQL injection | Prisma parameterization; tagged SQL | Review mọi raw query mới |
| Brute force | throttling login/reset | Nên thêm account/IP risk scoring, CAPTCHA theo ngưỡng |
| Session theft | HttpOnly access/refresh, rotation, revoke | TLS/client compromise vẫn là rủi ro |
| Broken access control | JWT session lookup + roles guard + ownership query | Bắt buộc test BOLA/BFLA mỗi endpoint mới |
| Malicious upload | MVP chưa có upload endpoint | Khi thêm: content sniffing, AV, object storage, signed URL |
| Key compromise | file permission và no auto-generate production | Cần KMS/HSM, rotation, audit và incident runbook |
| Payment forgery | MVP chỉ COD/bank transfer thủ công | Cổng online phải verify signature + amount/order mapping |

## Replay cache

`ReplayCacheService` là in-memory TTL cache. Đây là lựa chọn có chủ đích cho một API instance. Với nhiều replica, phải thay bằng Redis `SET NX PX`, database uniqueness hoặc store phân tán tương đương. Không scale ngang trước khi thay thành phần này.

## Cookie/session

- Access token: HttpOnly, SameSite=Lax, TTL ngắn.
- Refresh token: HttpOnly, SameSite=Strict, path giới hạn `/api/v1/auth`.
- CSRF token: readable cookie để gửi `X-CSRF-Token`.
- Refresh secret được rotate mỗi lần refresh; session có thể revoke.
- Đổi/reset mật khẩu revoke toàn bộ session.

## Cấu hình production bắt buộc

- `NODE_ENV=production`
- `COOKIE_SECURE=true`
- JWT secret ngẫu nhiên tối thiểu 32 bytes; tốt hơn dùng asymmetric signing/KMS.
- `CRYPTO_AUTO_GENERATE=false`
- private key mount read-only từ secret manager, permission tối thiểu.
- `WEB_ORIGIN` là allow-list chính xác, không dùng wildcard.
- Reverse proxy enforce TLS 1.2+, HSTS và request size/rate limit.
- Tách database credential theo least privilege.

## Logging và dữ liệu nhạy cảm

- Không log plaintext request/response envelope sau giải mã.
- Không log password, token, cookie, private key, reset URL hoặc full payment callback.
- Audit admin lưu actor/action/entity/before/after có chọn lọc.
- Thiết lập retention và quyền truy cập log phù hợp quy định.

## Kiểm thử bảo mật đề xuất

- Tamper ciphertext/AAD/encryptedKey/IV.
- Replay cùng nonce; timestamp quá hạn; method/path mismatch.
- Server key rotation và fingerprint pin mismatch.
- BOLA ở order/account/admin; role downgrade/locked account.
- CSRF với/không origin, cookie/header mismatch.
- Concurrent checkout cùng SKU và cùng/khác idempotency key.
- Coupon usage-limit race.
- Session rotation/reuse/revocation.
- Dependency audit, SAST, DAST và pentest độc lập trước go-live.

# Security design và threat model

## Nguyên tắc nền

1. **TLS là bắt buộc.** Envelope encryption là lớp bảo vệ bổ sung, không che được metadata HTTP và không tự xác thực endpoint phân phối public key.
2. **Server là nguồn chân lý** cho giá, coupon, phí, tồn kho, trạng thái đơn và quyền.
3. **Cryptography không thay thế authorization, validation hoặc transaction safety.**
4. **Không lưu PAN/CVV.** CARD/EWALLET chỉ được tích hợp qua provider đạt chuẩn và tokenization.

## Thuật toán

- Request v2: JWE Flattened JSON theo RFC 7516, key management `RSA-OAEP-256`, content encryption `A256GCM`.
- Response v2: Compact JWS `PS256` bằng signing key riêng, sau đó được bọc trong JWE `RSA-OAEP-256` + `A256GCM` về client.
- RSA encryption/signing key là hai key pair tách biệt, 2048–8192 bit, exponent 65537; mặc định development là 3072 bit.
- JOSE implementation dùng `jose@6.2.10`; decrypt/verify luôn truyền exact algorithm allow-list và kiểm tra protected header theo profile.
- Password: Argon2id.
- Refresh/reset token at rest: SHA-256 hash; raw token chỉ ở cookie/email link.
- Randomness: Web Crypto / Node `crypto` CSPRNG.

## JWE request v2

Wire format chỉ nhận năm trường của Flattened JWE single-recipient:

- `protected`;
- `encrypted_key`;
- `iv`;
- `ciphertext`;
- `tag`.

Protected header bắt buộc đúng `alg`, `enc`, `kid`, `typ`, `cty`; profile từ chối `aad`, unprotected header, `zip`, `crit`, multi-recipient, trường thừa và thuật toán thay thế.

Plaintext nằm **bên trong** JWE gồm body cùng metadata:

- protocol version và direction;
- HTTP method và absolute API path;
- requestId;
- timestamp;
- nonce;
- fingerprint và JWK public key tạm của client.
- CSRF token và idempotency key nếu các HTTP header đó có mặt.

Server chỉ đưa body sang validation/business layer sau khi JWE decrypt/tag verification, exact profile, route/header binding, clock window, key fingerprint/strength và replay cache đều pass.

## Signed JWE response v2

JWE mã hóa về public key client chỉ chứng minh integrity/confidentiality của ciphertext; bất kỳ bên nào biết public key client cũng có thể tự tạo một JWE mới. Vì vậy server ký trước, mã hóa sau:

1. Tạo payload gồm body và response metadata.
2. Ký payload thành Compact JWS bằng private signing key `PS256`.
3. Dùng Compact JWS làm plaintext của Flattened JWE gửi về client.
4. Client decrypt outer JWE, verify inner JWS bằng signing public key tin cậy, rồi mới parse body.

Payload đã ký bind với:

- requestId;
- request nonce;
- HTTP status;
- server key ID;
- response timestamp.

Client chỉ chấp nhận response khi chữ ký, signing `kid`, encryption `kid`, requestId, nonce, status, server key ID và cửa sổ timestamp đều khớp.

## Tương thích v1

- `x-secure-envelope: v2` là mặc định của storefront mới.
- Server tạm nhận `v1` và `v2`; `CRYPTO_ACCEPT_V1=false` là công tắc retirement sau khi có telemetry migration.
- Client v2 không tự downgrade khi descriptor/server không hỗ trợ v2.
- v1 vẫn là custom envelope cũ và chỉ tồn tại cho tương thích; mọi tính năng mới phải dùng v2.
- RSA-OAEP dùng long-term server key nên **không có forward secrecy**; TLS 1.3 vẫn là lớp transport bắt buộc và cung cấp thuộc tính này cho phiên kết nối.

## Phân phối và xoay server key

`GET /crypto/server-key` là plaintext về mặt envelope nhưng phải đi qua HTTPS. Descriptor công bố hai public key/fingerprint: encryption và response signing. Client có thể pin riêng bằng `NEXT_PUBLIC_CRYPTO_SERVER_KEY_SHA256` và `NEXT_PUBLIC_CRYPTO_SIGNING_KEY_SHA256`.

Production nên dùng một trong các mô hình:

- pin cả encryption và signing fingerprint tại build/deploy;
- descriptor được ký bởi offline root key;
- public key lấy qua config channel tin cậy;
- KMS/HSM quản lý private key và rotation.

`keyId` phải version hóa. Khi API trả `SERVER_KEY_ROTATED`, client tải descriptor mới và retry đúng một lần.

## Threat matrix

| Mối đe dọa            | Kiểm soát hiện có                                                                | Phần còn lại                                               |
| --------------------- | -------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Sửa body/giá          | JWE A256GCM integrity; DTO không có client price; server repricing               | Compromised server/DB vẫn có quyền                         |
| Giả response          | Inner JWS PS256 + request/status binding                                         | Bootstrap signing key vẫn phụ thuộc TLS/pin                |
| Replay request        | timestamp window + client key fingerprint + nonce cache                          | In-memory cache không dùng chung khi scale ngang           |
| Tạo trùng đơn         | idempotency unique key + serializable transaction                                | Caller phải giữ cùng key khi retry cùng intent             |
| Race tồn kho          | conditional SQL update + serializable transaction                                | Cần load/race test trên DB production                      |
| CSRF                  | SameSite cookies + double-submit CSRF + origin allow-list                        | XSS cùng origin có thể đọc CSRF token                      |
| XSS                   | React escaping, CSP, validation                                                  | CMS HTML hiện là text; nếu thêm rich HTML phải sanitize    |
| SQL injection         | Prisma parameterization; tagged SQL                                              | Review mọi raw query mới                                   |
| Brute force           | throttling login/reset                                                           | Nên thêm account/IP risk scoring, CAPTCHA theo ngưỡng      |
| Session theft         | HttpOnly access/refresh, rotation, revoke                                        | TLS/client compromise vẫn là rủi ro                        |
| Broken access control | JWT session lookup + roles guard + ownership query                               | Bắt buộc test BOLA/BFLA mỗi endpoint mới                   |
| Malicious upload      | MVP chưa có upload endpoint                                                      | Khi thêm: content sniffing, AV, object storage, signed URL |
| Key compromise        | Hai key pair riêng, pair self-test, file permission, no auto-generate production | Cần KMS/HSM, rotation, audit và incident runbook           |
| Payment forgery       | MVP chỉ COD/bank transfer thủ công                                               | Cổng online phải verify signature + amount/order mapping   |

## Replay cache

`ReplayCacheService` là in-memory TTL cache. TTL mặc định 300 giây và cấu hình bị từ chối nếu nhỏ hơn `2 × CRYPTO_MAX_CLOCK_SKEW_MS`, tránh request future-dated trở lại hợp lệ sau khi cache hết hạn. Đây vẫn chỉ là lựa chọn cho một API instance. Với nhiều replica, phải thay bằng Redis `SET NX PX`, database uniqueness hoặc store phân tán tương đương.

## Cookie/session

- Access token: HttpOnly, SameSite=Lax, TTL ngắn.
- Refresh token: HttpOnly, SameSite=Strict, path giới hạn `/api/v1/auth`.
- CSRF token: readable cookie để gửi `X-CSRF-Token`.
- Refresh secret được rotate bằng conditional atomic update; request đồng thời hoặc token cũ không thể cùng thắng.
- Đổi/reset mật khẩu revoke toàn bộ session.

## Cấu hình production bắt buộc

- `NODE_ENV=production`
- `COOKIE_SECURE=true`
- JWT secret ngẫu nhiên tối thiểu 32 bytes; tốt hơn dùng asymmetric signing/KMS.
- `CRYPTO_AUTO_GENERATE=false`
- encryption/signing private key mount read-only từ secret manager, permission tối thiểu và đường dẫn/key ID tách biệt.
- `WEB_ORIGIN` là allow-list chính xác, không dùng wildcard.
- Reverse proxy enforce TLS 1.2+, HSTS và request size/rate limit.
- Tách database credential theo least privilege.

API fail-fast trước khi bootstrap nếu production thiếu signing/encryption key, dùng chung key ID/path, dùng JWT/database placeholder, cookie không Secure, auto-generate RSA key, replay TTL sai hoặc `WEB_ORIGIN` không phải HTTPS origin chính xác.

## Logging và dữ liệu nhạy cảm

- Không log plaintext request/response envelope sau giải mã.
- Không log password, token, cookie, private key, reset URL hoặc full payment callback.
- Audit admin lưu actor/action/entity/before/after có chọn lọc.
- Thiết lập retention và quyền truy cập log phù hợp quy định.

## Kiểm thử bảo mật đề xuất

- Tamper từng trường `protected`, `encrypted_key`, `iv`, `ciphertext`, `tag`.
- Algorithm/header substitution, unprotected/unknown field và key quá yếu.
- Response ký bằng wrong key, sai request binding và signing fingerprint pin.
- Xác nhận client v2 không tự downgrade; smoke v1 chỉ phục vụ migration.
- Replay cùng nonce; timestamp quá hạn; method/path mismatch.
- Server key rotation và fingerprint pin mismatch.
- BOLA ở order/account/admin; role downgrade/locked account.
- CSRF với/không origin, cookie/header mismatch.
- Concurrent checkout cùng SKU và cùng/khác idempotency key.
- Coupon usage-limit race.
- Session rotation/reuse/revocation.
- Dependency audit, SAST, DAST và pentest độc lập trước go-live.

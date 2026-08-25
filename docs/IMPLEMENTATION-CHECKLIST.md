# Checklist hoàn thiện MVP

Ngày rà soát và triển khai: **2026-08-25**.

## Hạng mục đã code

### Nền tảng và dependency

- [x] Khóa runtime ở Node.js 22 và tạo `package-lock.json` để dùng `npm ci` tái lập được.
- [x] Đồng bộ Prisma CLI/Client về cùng phiên bản và loại dependency có advisory khỏi cây cài đặt.
- [x] Sửa toàn bộ lỗi TypeScript/Web Crypto phát sinh với compiler hiện tại.
- [x] Thêm lệnh `verify`, `db:deploy`, `test:security` và cập nhật chuỗi build/typecheck.

### Database và dữ liệu

- [x] Tạo initial PostgreSQL migration từ Prisma schema và `migration_lock.toml` hợp lệ.
- [x] Tách migration và seed thành one-shot service, không dùng `db push` lúc API khởi động.
- [x] Giữ seed idempotent cho local/demo.
- [x] Chặn demo seed trong production nếu không bật `ALLOW_DEMO_SEED=true` rõ ràng.

### Auth và bảo mật

- [x] Chuyển storefront sang protocol **JWE v2** theo RFC 7516 Flattened JSON với allow-list duy nhất `RSA-OAEP-256` + `A256GCM`.
- [x] Ký toàn bộ response bằng Compact JWS `PS256` rồi mới mã hóa về client; dùng cặp RSA signing riêng, không tái sử dụng encryption key.
- [x] Mở rộng key descriptor với encryption/signing public key, fingerprint và self-test hai key pair khi API bootstrap.
- [x] Giữ server dual-stack `v1|v2` qua `CRYPTO_ACCEPT_V1`; client mới mặc định v2 và không tự downgrade.
- [x] Kiểm tra exact JOSE profile, từ chối unprotected/unknown field, thuật toán thay thế, key yếu và JWE quá kích thước.
- [x] Bind method/path/requestId/nonce/timestamp, CSRF và idempotency header vào phần metadata được mã hóa.
- [x] Bind response đã ký với requestId, request nonce, HTTP status, timestamp và server key ID.
- [x] Thêm pin riêng cho encryption/signing key; production vẫn bắt buộc HTTPS và kênh bootstrap tin cậy.
- [x] Bắt buộc CSRF khi còn refresh cookie dù access cookie đã hết hạn.
- [x] Rotate refresh token bằng conditional atomic update; token cũ và refresh đồng thời chỉ có một winner.
- [x] Sửa thứ tự TTL/reinsert trong replay cache để prune không bỏ sót entry hết hạn.
- [x] Tăng replay TTL mặc định lên 300 giây và fail-fast nếu nhỏ hơn hai lần clock-skew.
- [x] Fail-closed khi không thể ký/mã hóa error response; không rơi xuống trả payload nghiệp vụ plaintext.
- [x] Thêm browser auto-refresh một lần, gộp request refresh đồng thời và retry bằng envelope mới.
- [x] Thêm production fail-fast cho JWT placeholder, insecure cookie, auto-generate RSA key, database credential mẫu và origin không phải HTTPS chính xác.
- [x] Giữ API/web container chạy bằng user `node`; khóa development nằm trong named volume.

### API, web và build

- [x] Sửa kiểu dữ liệu Express guards, JWT, Prisma JSON mapper, checkout và DTO validation.
- [x] Sửa các lỗi optional property/response typing trên trang catalog, auth, cart, checkout, account và admin.
- [x] Đóng gói đúng Prisma Client nằm trong workspace API của production image.
- [x] Tối ưu Docker build context/cache và thêm healthcheck/dependency ordering cho toàn stack.

### Storefront và trải nghiệm mua sắm

- [x] Đổi toàn bộ thương hiệu hiển thị sang **MIRA**, gồm metadata, manifest, favicon, placeholder sản phẩm và nội dung chính sách.
- [x] Thiết kế lại trang chủ theo hướng retail hiện đại: hero sản phẩm, danh mục trực quan, sản phẩm nổi bật, editorial block, quyền lợi mua sắm và newsletter.
- [x] Tinh giản header còn ba hành trình mua sắm chính, tìm kiếm, tài khoản và giỏ hàng; bỏ link quản trị, hotline, tra cứu và chi tiết vận hành khỏi public nav.
- [x] Loại toàn bộ thuật ngữ core như RSA, AES, envelope, CSRF, token, idempotency và transaction khỏi nội dung render cho khách hàng.
- [x] Tách chrome giao diện của storefront, auth và back office; trang đăng nhập không còn header/footer bán hàng hoặc nội dung kỹ thuật.
- [x] Làm mới product card, trang chi tiết, cart, checkout, account, footer và các trạng thái lỗi theo ngôn ngữ mua sắm.
- [x] Hoàn thiện responsive desktop/mobile, gồm header không tràn ngang, hero một cột, danh mục cuộn ngang và lưới sản phẩm hai cột trên mobile.

### Đăng nhập trên trình duyệt

- [x] Sửa native `window.fetch` bị gọi sai receiver gây lỗi `Illegal invocation` trong `SecureApiClient`.
- [x] Thêm regression test receiver-sensitive để lỗi trên không tái xuất hiện.
- [x] Sửa CSP `connect-src` dùng API origin thay vì path, cho phép trình duyệt tải key descriptor và gọi các endpoint con.
- [x] Chuyển lỗi kết nối/kỹ thuật thành thông báo thân thiện, không đưa chi tiết nội bộ lên form.
- [x] Smoke test đăng nhập thật bằng Chromium trên container production và xác nhận chuyển tới trang tài khoản không có console error.

### Kiểm thử và CI

- [x] Core tests cho v1/v2 round-trip, đủ năm thành phần JWE bị tamper, chữ ký giả, response binding, no-downgrade, pricing, stock và order state machine.
- [x] Security tests cho replay cache, CSRF refresh-only cookie và production environment validation.
- [x] Giữ test scripts của từng workspace trong chuỗi `npm test` để không mất coverage về sau.
- [x] Live API acceptance cho health/database, descriptor hai public key, JWE v2 + signed response, legacy v1, auth, refresh rotation, stale-token rejection, CSRF và RBAC.
- [x] Write acceptance cho COD checkout, idempotent retry và guest order tracking bằng dữ liệu giả lập.
- [x] GitHub Actions chạy `npm ci`, verify, build images, dựng integration stack, acceptance và cleanup.
- [x] `npm audit`, Compose config, migration/seed exit status và container health được đưa vào quy trình xác minh.

### Tài liệu bàn giao

- [x] Cập nhật README và handover theo quy trình migration/seed/CI thực tế.
- [x] Cập nhật acceptance checklist và verification record.
- [x] Ghi rõ ranh giới giữa MVP local đã xác minh và production go-live.

## Chưa thuộc phạm vi hoàn thiện MVP

Các mục dưới đây cần hạ tầng, nhà cung cấp hoặc quyết định vận hành thực tế; không được xem là đã hoàn tất chỉ từ source local:

- [ ] TLS/HSTS/reverse proxy và domain production.
- [ ] KMS/HSM/secret manager, cấp hai fingerprint pin production và diễn tập key rotation.
- [ ] Redis/durable replay cache trước khi chạy nhiều API replica.
- [ ] SMTP/SMS worker thật, retry/dead-letter và monitoring.
- [ ] Payment gateway/carrier callback có signature verification và reconciliation.
- [ ] Backup/restore/rollback drill, centralized observability và incident runbook.
- [ ] Load/race test quy mô production, DAST, container scan và pentest độc lập.
- [ ] Rà soát pháp lý, thuế/hóa đơn, privacy/terms/return policy và thay toàn bộ demo credential.
- [ ] Thu thập telemetry sử dụng v1, đặt thời hạn migration rồi tắt `CRYPTO_ACCEPT_V1`; không xóa v1 trước thời hạn tương thích đã công bố.

Xem thêm production gate chi tiết trong [ACCEPTANCE.md](ACCEPTANCE.md).

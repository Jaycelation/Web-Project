# MIRA Commerce v0.2 - Review và bàn giao nâng cấp

Ngày: **02/10/2026**. Nguồn đầu vào: `Web-Project-master.zip`.

> **Đây là bản nâng cấp mã nguồn, chưa được nghiệm thu production.** 80 kiểm thử cục bộ đã qua; chưa chạy Next/Nest/PostgreSQL end-to-end. `npm ci` bị lỗi DNS `EAI_AGAIN` tới npm registry; full build dừng vì chưa có `jose`. Không chuyển các kết quả kiểm thử của bản gốc thành bằng chứng cho bản này.

> **Dependency cần xử lý trước khi public:** lockfile vẫn dùng Next.js **16.3.0**. Bản stable **16.3.8**, phát hành 30/09/2026, có các bản vá bảo mật. Chạy `npm run security:patch-next` trên máy có mạng, review lockfile rồi chạy lại verify. Script được cung cấp nhưng **chưa chạy thành công trong lần bàn giao này**. Không tự bịa integrity/resolved cho dependency.

## 1. Nhận định về dự án

Đây không phải website giao diện tĩnh. Dự án có Next.js App Router, NestJS modular monolith, PostgreSQL/Prisma, các package contracts/domain/crypto-envelope, checkout tính giá phía server, phân quyền và state machine cho đơn hàng.

Hướng nâng cấp được chọn là hoàn thiện hành trình mua hàng và vận hành, không viết lại toàn bộ stack. Giữ giao diện hiện có và giao thức JWE/JWS, bổ sung module `reviews`, `operations` và các trang quản trị còn thiếu. API nghiệp vụ mới tiếp tục đi qua `browserRequest`/`SecureApiClient`; không mở đường JSON plaintext riêng.

## 2. Chức năng đã bổ sung trong source

| Nhóm | Nội dung | Giới hạn cần biết |
|---|---|---|
| Yêu thích | Nút lưu trên card/chi tiết; trang `/yeu-thich`; tối đa 20 sản phẩm | Lưu UUID trong trình duyệt; chưa đồng bộ tài khoản |
| So sánh | Trang `/so-sanh`, tối đa 4 sản phẩm; giá, hãng, danh mục, mô tả, tồn khả dụng | Chưa so sánh thông số kỹ thuật chi tiết từng biến thể |
| Đã xem | Trang `/da-xem`; 12 sản phẩm gần nhất, chống trùng, xóa danh sách | Cùng phạm vi lưu trữ trình duyệt |
| Đánh giá thật | API và UI; 1-5 sao, bình luận, phân bố sao, điểm trung bình và phân trang | Chỉ chủ đơn đã giao; một review/order item; không hỗ trợ guest/upload ảnh |
| Duyệt review | `/quan-tri/danh-gia`: tìm sản phẩm, chờ duyệt/đã duyệt/đã ẩn; duyệt hoặc ẩn | Chỉ APPROVED ra public; không sửa nội dung review của khách |
| Coupon | `/quan-tri/khuyen-mai`: tạo mã %, số tiền, freeship; trần giảm, đơn tối thiểu, thời gian, giới hạn lượt; bật/tắt | Chỉ ADMIN ghi; không âm thầm sửa điều kiện mã đã phát hành |
| Khách hàng | `/quan-tri/khach-hang`: tìm, phân trang, số đơn, giá trị đã giao, khóa/mở | Hoàn thiện UI trên API có sẵn; khóa tài khoản chỉ ADMIN |
| Nội dung | `/quan-tri/noi-dung`: sửa chính sách, tiêu đề/description SEO, bật/tắt công khai | UI cho API có sẵn; render văn bản thuần, không HTML editor |
| Nhật ký | `/quan-tri/nhat-ky`: tra cứu người thao tác, hành động, đối tượng, thời gian | ADMIN; chỉ metadata, không đẩy toàn bộ before/after ra UI |
| Đơn hàng | Lọc/tìm/phân trang; hộp thoại xác nhận; xuất CSV; đối soát chuyển khoản | CSV tối đa 250 đơn mới nhất theo bộ lọc; không kèm tên/email/địa chỉ |

Danh sách cá nhân chỉ lưu ID; giá và thông tin sản phẩm được lấy lại từ `/catalog/selection`. Sản phẩm bị ẩn/ngừng bán không được phục hồi từ snapshot local. Trình duyệt chặn lưu trữ thì danh sách/giỏ vẫn hoạt động trong bộ nhớ của phiên.

Đối soát chuyển khoản yêu cầu ADMIN nhập tham chiếu và số tiền thực nhận. API kiểm tra phương thức, trạng thái, tổng đơn, số tiền payment, tính duy nhất tham chiếu, transaction và audit. **Không có kết nối ngân hàng để xác minh tự động.** Nút REFUNDED chỉ ghi nhận trạng thái, không thực hiện chuyển tiền.

## 3. Lỗi và khoảng trống đã xử lý

| Vấn đề từ source gốc | Thay đổi | Địa chỉ source |
|---|---|---|
| Admin orders gửi pageSize=100, DTO chỉ cho 50 | Dùng 20, phân trang và hiển thị lỗi/retry | `apps/web/components/admin-orders.tsx` |
| Card chi tiết ghi cứng 4,9 và 128 review | Bỏ số mẫu; điểm tính từ review APPROVED | `product-detail-view.tsx`, `product-reviews.tsx`, `modules/reviews` |
| inStock tính stock>0, bỏ qua reservedStock | Tính còn hàng theo stock>reservedStock | `apps/api/src/modules/catalog/catalog.service.ts` |
| Lọc giá theo basePrice, hiển thị theo giá variant | Cùng dùng MIN giá biến thể đang active | Cùng catalog service; SQL tham số hóa, RepeatableRead |
| URL dùng query nhưng page đọc q; chỉ có 8 nút trang | Chuẩn q; phân trang đầu/trước/sau/cuối; URL là nguồn filter | `catalog-browser.tsx`, `pagination.tsx`, `commerce-upgrade.ts` |
| Search/quote có thể nhận response cũ sau response mới | Catalog dùng server navigation; hook list/quote bỏ response cũ | `use-paged-resource.ts`, `cart-view.tsx`, `checkout-view.tsx` |
| API lỗi thì tự hiện sản phẩm demo | Chỉ fallback khi ALLOW_DEMO_CATALOG=true và không phải production; có nhãn demo | `lib/demo.ts`, các page storefront |
| CMS bỏ nội dung ngắn và có thể fallback cả khi unpublish | Tôn trọng nội dung server; 404 không hồi sinh bản local | `app/chinh-sach/[slug]/page.tsx` |
| localStorage lỗi; cart clamp thêm 1 khi tồn 0 | Bắt lỗi storage, kiểm tra dữ liệu, loại trùng, không thêm hàng hết | `cart-provider.tsx`, `commerce-upgrade.ts` |
| Quote DomainError có thể thành 500; checkout fallback giá vẫn cho gửi | Map lỗi nghiệp vụ; checkout đợi quote server hợp lệ | `checkout.service.ts`, `checkout-view.tsx` |
| Khách tự hủy/return kiểm tra trạng thái ngoài transaction | Kiểm tra lại owner/status trong transaction | `orders.service.ts`, `canCustomerTransition` |
| DELIVERED -> RETURN_REQUESTED -> DELIVERED cộng soldCount lần nữa | Chỉ cộng lần giao đầu, giữ deliveredAt gốc | `orders.service.ts` |
| Chạy workspace có thể không đọc .env root/khóa relative | Launcher nạp .env root, chuyển path khóa thành absolute | `scripts/with-env.mjs`, script dev/build:packages |

Đây là các bản sửa theo phân tích source và kiểm thử cục bộ; những hành vi liên quan database/browser vẫn cần nghiệm thu trên stack thật.

## 4. Quyền và endpoint mới

Tất cả dưới đây là POST tại prefix `/api/v1`, bọc secure envelope. Không gửi JSON thuần bằng curl.

| Endpoint | Quyền |
|---|---|
| `/catalog/selection`, `/reviews/list` | Public; chỉ sản phẩm công khai |
| `/reviews/eligible` | Đăng nhập; chỉ order item của mình |
| `/reviews/create` | Đăng nhập + CSRF; đơn đã giao |
| `/admin/reviews`, `/admin/reviews/moderate` | STAFF/ADMIN + CSRF |
| `/admin/coupons`, `/admin/orders/export` | STAFF/ADMIN + CSRF |
| `/admin/coupons/create`, `/admin/coupons/status` | ADMIN + CSRF |
| `/admin/audit`, `/admin/payments/confirm-transfer` | ADMIN + CSRF |

Vẫn giữ kiểm tra phía server; ẩn nút UI không thay thế RBAC. Review không nhận userId/productId tự khai báo; quan hệ mua hàng lấy từ order item và user trong session. Không trả email/userId trong review public.

## 5. Tương thích dữ liệu

Không đổi Prisma schema, không sửa migration đã phát hành, không xóa dữ liệu cũ. Tái sử dụng các bảng Review/Coupon/Payment/AdminAuditLog đã có; Review.orderItemId và cặp Payment(provider,providerRef) đã có unique constraint.

Các workspace và local dependency cùng nâng version 0.2.0. Registry dependency giữ nguyên. Web thêm local package domain; Dockerfile web build domain trước Next. Trước khi đổi source trên hệ thống thật, sao lưu database và thử trên bản sao; **không chạy seed demo trên production**.

## 6. Chạy trên máy của bạn

Cần Node.js 22+, npm 10+, mạng npm registry. Ví dụ dưới dùng WSL/Linux. PowerShell có thể dùng các npm command tương tự; `Copy-Item .env.example .env` thay cho cp.

```bash
cd MIRA-Commerce-v0.2
cp .env.example .env
npm ci
npm run security:patch-next
# Review package.json/package-lock.json sau khi npm cập nhật.
npm audit --audit-level=high
```

Sửa secret và thông tin ngân hàng trong .env; dữ liệu mẫu không đại diện tài khoản ngân hàng thật. Sao lưu lockfile đã vá để CI/Docker cùng dùng.

### Cách A - Docker

```bash
docker compose up --build -d
# Web: http://localhost:3000
# API: http://localhost:4000/api/v1
npm run build:packages
npm run test:upgrade:api
```

Dockerfile web chạy bản production: fallback demo luôn tắt, kể cả khi environment có flag demo. Compose gốc là stack local/demo, không phải cấu hình triển khai Internet sẵn sàng.

### Cách B - API/Web local, PostgreSQL Docker

```bash
docker compose up -d db
npm run local -- run crypto:keys
npm run local -- run db:generate
npm run local -- run db:deploy
npm run local -- run db:seed
npm run dev
```

`npm run dev` build package dùng chung rồi nạp environment root trước khi chạy API/Web. `DATABASE_URL` phải khớp password/database của PostgreSQL; không dùng hostname db khi API chạy trên host.

Seed credential gốc: `admin@securecommerce.local` / `Admin@12345`; `customer@securecommerce.local` / `Customer@12345`. Chỉ dùng local. Không có seed STAFF mới. Seed không đảm bảo có đơn DELIVERED để review: hãy tạo đơn bằng customer rồi dùng admin chuyển qua các trạng thái hợp lệ.

## 7. Kiểm thử đã chạy và chưa chạy

| Hạng mục | Kết quả thực tế |
|---|---|
| Build/typecheck package domain | PASS, tsc |
| Build/typecheck package contracts | PASS, tsc |
| `test:upgrade:unit` | **50/50 PASS** |
| `test:upgrade:services` | **30/30 PASS**, Nest/Prisma được giả lập |
| Syntax/transpilation source TS/TSX | **154 file, 0 lỗi cú pháp**; không phải full typecheck |
| Manifest/lockfile workspace consistency | PASS, 6 package manifest |
| Launcher environment | `npm run local -- --version` PASS |
| `npm ci` | FAIL: DNS/registry EAI_AGAIN |
| `npm run build` toàn repo | BLOCKED: thiếu module jose; dừng ở crypto package |
| API/Web typecheck và full build | **Chưa xác minh** |
| PostgreSQL, Prisma queries, giao dịch đồng thời | **Chưa chạy** |
| UI desktop/mobile, Docker, audit mới | **Chưa chạy** |
| Live API smoke mới + suite crypto gốc | **Chưa chạy trong lần này** |

Unit test bao phủ giới hạn collection, MRU, tồn kho, clamp, owner/status, coupon, CSV và URL. Service test thực thi service source được transpile, giả lập persistence/exception/decorator: kiểm tra nhánh thanh toán, trùng tham chiếu, review, privacy projection, race guard và soldCount. Mock **không chứng minh** SQL chạy đúng, transaction isolation thật hay Nest guard/DTO tích hợp đúng.

Log lần chạy: `docs/verification/`. Các lệnh nghiệm thu tiếp:

```bash
npm run test:upgrade:unit
npm run test:upgrade:services
npm run check:syntax
npm run local -- run verify
npm run test:upgrade:api
# API gốc, chỉ cho phép ghi trên database demo:
ACCEPTANCE_WRITE=1 npm run test:api
```

CI được bổ sung live smoke mới, nhưng workflow **chưa được thực thi** trong môi trường bàn giao. Không bỏ qua audit/typecheck để đạt CI xanh.

## 8. Checklist nghiệm thu thực tế

1. Customer tạo đơn, admin xác nhận -> chuẩn bị -> giao -> đã giao. Review pending không xuất hiện public; duyệt thì count/average thay đổi; ẩn thì biến mất. User khác không dùng orderItemId đó để review.
2. Đơn BANK_TRANSFER chờ chuyển khoản: sai số tiền bị từ chối; cùng tham chiếu gửi lại không ghi hai lần; hai đơn khác không được nhận cùng tham chiếu MANUAL_BANK. STAFF/CUSTOMER không được gọi endpoint này.
3. Coupon thử chưa đến hạn, hết hạn, hết lượt, tạm dừng, không đủ minOrder; server phải tự tính giá checkout.
4. Catalog tạo >8 trang và sản phẩm có basePrice khác giá variant; kiểm tra sort/filter, back/forward, reservedStock=stock. Chống response cũ bằng network throttling.
5. Wishlist/compare/recent: reload, hai tab, xóa, sản phẩm bị ẩn, storage bị chặn, mobile và bàn phím. Collection không theo user/account; dùng chung browser thì dùng chung danh sách.
6. CMS nội dung ngắn được hiển thị; unpublish phải 404. Tắt API không được hiện hàng demo trong production.
7. Chạy song song checkout/confirm/cancel/return/review, kiểm tra stock, reservedStock, soldCount, unique key và 409. Kiểm tra CSV giới hạn 250, bộ lọc và không có direct customer PII.

## 9. Đề xuất thêm/bớt cho lần tiếp

**P0 trước production:** vá/audit dependency, full build và DB/API/browser acceptance; cấp TLS/secret/khóa thật; bỏ credential demo; sao lưu và restore thử. Đạt unit test không đủ để public shop.

**P1 vận hành:** SMTP outbox worker có retry; payment gateway với callback signature và reconciliation; quy trình hoàn tiền thật; xử lý đơn đã trả tiền nhưng bị hủy; tự hết hạn reservation; rà soát thời hạn đổi trả 7 ngày giữa UI/policy/API. Idempotency hiện có chống trùng theo key nhưng chưa ràng buộc fingerprint toàn bộ checkout payload.

**P2 trải nghiệm:** đồng bộ cart/wishlist theo tài khoản, merge guest khi login, phân trang lịch sử đơn customer và các màn admin cũ còn giới hạn, bộ thuộc tính chuẩn cho so sánh variant, quản lý ảnh với validation/storage thật. Browser cart hiện vẫn là local dù backend đã có API cart.

**Khi scale:** replay cache dùng chung (ví dụ Redis), hạn mức xử lý mã hóa, observability, query plan/index với catalog lớn; export CSV lớn chạy job thay vì tăng giới hạn request vô hạn.

**Nên bớt/hoãn:** review/giá mẫu, fallback lặng lẽ, thêm microservices chỉ để tăng số lượng công nghệ, chatbot AI trước khi dữ liệu bán hàng ổn định, upload review không có quy trình kiểm duyệt. Không bỏ authentication/CSRF/audit/validation hay thay lớp mã hóa trong cùng một đợt nâng cấp UI.

## 10. Nguồn kỹ thuật đối chiếu

- Next.js stable release/security notes: https://github.com/vercel/next.js/releases/tag/v16.3.8
- Next.js advisory schedule/update: https://nextjs.org/blog/upcoming-nextjs-security-release-september-2026
- Prisma 6 transactions/isolation/P2034: https://www.prisma.io/docs/orm/v6/prisma-client/queries/transactions
- OWASP CSV injection: https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/07-Injection/21-CSV_Injection

Next 16.3.8 chứa bản vá cho các advisory, không đồng nghĩa mọi advisory đều khai thác được trong cấu hình repo này. `remotePatterns: []` được giữ; bỏ AVIF chỉ là giảm bề mặt xử lý ảnh, **không thay thế cập nhật dependency**. CSV quote + tiền tố `text: ` áp dụng cho chuỗi có thể bị diễn giải là công thức; đây là định dạng để xem, không phải export/import bảo toàn nguyên vẹn mọi chuỗi.

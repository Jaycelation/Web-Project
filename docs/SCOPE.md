# Ma trận phạm vi

## Có trong bản bàn giao

| Nhóm | Trạng thái |
|---|---|
| Trang chủ, catalog, search/filter/sort/pagination | Có |
| Chi tiết sản phẩm, biến thể, tồn, chính sách, related | Có |
| Giỏ hàng responsive và persisted guest cart | Có |
| Cart API cho tài khoản | Có |
| Coupon phần trăm/fixed/free shipping ở domain/data model | Có |
| Checkout guest/member | Có |
| COD và chuyển khoản | Có |
| Idempotent order creation | Có |
| Auth, reset password, profile, address, password change | Có |
| Lịch sử/chi tiết/track/cancel/return request | Có |
| Admin dashboard | Có |
| Product/variant/inventory management | Có, theo MVP |
| Order management, tracking code, internal note | Có |
| Customer lock/unlock | Có |
| CMS chính sách | Có |
| Newsletter | Có |
| Notification outbox | Có |
| SMTP/SMS delivery worker | Chưa tích hợp provider thật |
| Review/rating UI và moderation | Data model có; UI/API chưa hoàn thiện |
| Excel/CSV import/export | Chưa triển khai |
| Payment card/e-wallet gateway | Chưa triển khai; schema mở rộng sẵn |
| Carrier integration | Chưa triển khai; tracking fields có sẵn |
| Multi-warehouse, loyalty, flash sale, marketplace | Ngoài MVP |

## Diễn giải “MVP chạy được”

Bản bàn giao là implementation mẫu có luồng nghiệp vụ và security controls cốt lõi, phù hợp để:

- chạy demo local/container;
- làm baseline cho development;
- review kiến trúc và threat model;
- viết thêm integration/E2E tests;
- tích hợp provider thật qua adapter.

Không nên coi đây là hệ thống production-certified hoặc PCI-certified. Go-live cần các hạng mục hardening, vận hành, pháp lý và kiểm thử trong `ACCEPTANCE.md`.

# MIRA Commerce v0.2 - Bàn giao 02/10/2026

Đọc `docs/UPGRADE-REVIEW-VI.md` trước khi chạy. Bản này là source upgrade, chưa nghiệm thu production.

Đã thực thi: 50 unit + 30 isolated-service tests; domain/contracts tsc; 154 TS/TSX syntax check. Chưa thực thi API/Web full build, PostgreSQL, browser, Docker và audit. npm registry không truy cập được; build thiếu jose. Log trong `docs/verification`.

Next.js lockfile còn 16.3.0. Cần `npm run security:patch-next`, review lockfile và `npm run local -- run verify` khi có mạng. Không chạy seed demo/credential mẫu trên production.

Các tính năng mới: wishlist, so sánh, lịch sử xem, review và duyệt review, coupon, UI khách hàng/CMS/audit, quản trị đơn/CSV/đối soát thủ công. Giữ nguyên schema/migration và giao thức crypto.

`docs/BASELINE-HANDOVER.md` và `docs/TEST-RESULTS.txt` là lịch sử từ ZIP gốc, không phải bằng chứng nghiệm thu v0.2.

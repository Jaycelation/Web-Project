import { LockIcon, PackageIcon, ShieldIcon } from './icons';

export function SecurityStrip() {
  return <section className="security-strip" aria-label="Cam kết dịch vụ">
    <div><ShieldIcon /><span><strong>Request/response mã hóa</strong><small>RSA‑OAEP + AES‑256‑GCM</small></span></div>
    <div><LockIcon /><span><strong>Giá do server quyết định</strong><small>Không tin tổng tiền phía client</small></span></div>
    <div><PackageIcon /><span><strong>Đơn hàng idempotent</strong><small>Ngăn tạo trùng khi bấm nhiều lần</small></span></div>
  </section>;
}

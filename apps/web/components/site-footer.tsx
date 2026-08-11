import Link from 'next/link';
import { LockIcon, ShieldIcon } from './icons';

export function SiteFooter() {
  return <footer className="site-footer">
    <div className="container footer-grid">
      <div className="footer-brand">
        <div className="brand brand-light"><span className="brand-mark"><ShieldIcon /></span><span><strong>SECURE</strong><small>COMMERCE</small></span></div>
        <p>MVP thương mại điện tử bảo mật theo nguyên tắc server-authoritative pricing, idempotency và mã hóa envelope ở lớp ứng dụng.</p>
        <div className="footer-security"><LockIcon /><span><strong>HTTPS vẫn bắt buộc</strong><small>Hybrid encryption là lớp phòng vệ bổ sung.</small></span></div>
      </div>
      <div><h3>Mua sắm</h3><Link href="/san-pham">Tất cả sản phẩm</Link><Link href="/san-pham?sort=popular">Sản phẩm bán chạy</Link><Link href="/gio-hang">Giỏ hàng</Link><Link href="/tra-cuu-don-hang">Tra cứu đơn hàng</Link></div>
      <div><h3>Hỗ trợ</h3><Link href="/chinh-sach/chinh-sach-giao-hang">Chính sách giao hàng</Link><Link href="/chinh-sach/chinh-sach-doi-tra">Chính sách đổi trả</Link><Link href="/chinh-sach/chinh-sach-bao-mat">Chính sách bảo mật</Link><Link href="/chinh-sach/dieu-khoan-su-dung">Điều khoản sử dụng</Link></div>
      <div><h3>Liên hệ</h3><p>support@securecommerce.local</p><p>1900 2026</p><p>Thứ Hai – Thứ Bảy<br />08:00 – 18:00</p></div>
    </div>
    <div className="container footer-bottom"><span>© 2026 Secure Commerce. Bản dựng MVP.</span><span>TypeScript · Next.js · NestJS · PostgreSQL</span></div>
  </footer>;
}

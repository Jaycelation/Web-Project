import Link from 'next/link';

export function SiteFooter() {
  return <footer className="site-footer">
    <div className="container footer-grid">
      <div className="footer-brand">
        <Link href="/" className="brand brand-light" aria-label="MIRA - Trang chủ"><span className="brand-mark" aria-hidden="true">M</span><span><strong>MIRA</strong><small>SMART LIVING</small></span></Link>
        <p>Thiết bị công nghệ được tuyển chọn để công việc gọn hơn, giải trí hay hơn và mỗi ngày nhẹ nhàng hơn.</p>
      </div>
      <div><h3>Khám phá</h3><Link href="/san-pham">Tất cả sản phẩm</Link><Link href="/san-pham?sort=newest">Hàng mới</Link><Link href="/san-pham?sort=popular">Bán chạy</Link></div>
      <div><h3>Chăm sóc khách hàng</h3><Link href="/tra-cuu-don-hang">Tra cứu đơn hàng</Link><Link href="/chinh-sach/chinh-sach-giao-hang">Giao hàng</Link><Link href="/chinh-sach/chinh-sach-doi-tra">Đổi trả</Link></div>
      <div><h3>Thông tin</h3><Link href="/chinh-sach/chinh-sach-bao-mat">Quyền riêng tư</Link><Link href="/chinh-sach/dieu-khoan-su-dung">Điều khoản sử dụng</Link><p>Hotline: 1900 2026</p><p>Thứ Hai – Thứ Bảy, 08:00 – 18:00</p></div>
    </div>
    <div className="container footer-bottom"><span>© 2026 MIRA. All rights reserved.</span><span>Mua sắm thông minh mỗi ngày.</span></div>
  </footer>;
}

import Link from 'next/link';
import type { CatalogSearchResult } from '@secure-commerce/contracts';
import { ArrowIcon, LockIcon } from '@/components/icons';
import { NewsletterForm } from '@/components/newsletter-form';
import { ProductCard } from '@/components/product-card';
import { SecurityStrip } from '@/components/security-strip';
import { fallbackCatalog } from '@/lib/fallback-data';
import { searchCatalog } from '@/lib/api';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  let catalog: CatalogSearchResult;
  try {
    catalog = await searchCatalog({ page: 1, pageSize: 8, sort: 'popular' });
  } catch {
    catalog = fallbackCatalog;
  }

  return <>
    <section className="hero">
      <div className="container hero-grid">
        <div className="hero-copy">
          <span className="eyebrow eyebrow-light">Commerce, hardened by design</span>
          <h1>Mua sắm tiện lợi.<br /><em>Dữ liệu được bọc kín.</em></h1>
          <p>Một storefront hiện đại với pricing do server quyết định, checkout idempotent và envelope encryption cho request/response nghiệp vụ.</p>
          <div className="hero-actions">
            <Link className="button button-accent" href="/san-pham">Khám phá sản phẩm <ArrowIcon /></Link>
            <Link className="button button-outline" style={{ color: '#fff', borderColor: 'rgba(255,255,255,.25)', background: 'transparent' }} href="/tra-cuu-don-hang">Tra cứu đơn hàng</Link>
          </div>
          <div className="hero-proof">
            <div><strong>AES‑256‑GCM</strong><span>Mã hóa nội dung + integrity</span></div>
            <div><strong>RSA‑OAEP</strong><span>Bọc khóa phiên AES</span></div>
            <div><strong>Serializable</strong><span>Transaction checkout</span></div>
          </div>
        </div>
        <div className="hero-visual" aria-hidden="true">
          <div className="crypto-orbit">
            <div className="crypto-core"><LockIcon /></div>
            <span className="crypto-chip">REQUEST</span>
            <span className="crypto-chip">A256GCM</span>
            <span className="crypto-chip">RESPONSE</span>
          </div>
        </div>
      </div>
    </section>

    <SecurityStrip />

    <section className="section">
      <div className="container">
        <div className="section-heading">
          <div><span className="eyebrow">Khám phá nhanh</span><h2>Danh mục nổi bật</h2></div>
          <p>Sản phẩm demo được seed sẵn để kiểm thử đầy đủ biến thể, tồn kho, giảm giá, giỏ hàng và checkout.</p>
        </div>
        <div className="category-grid">
          <Link className="category-card" href="/san-pham?category=am-thanh"><div><h3>Âm thanh</h3><p>Tai nghe chống ồn và thiết bị nghe nhìn cho nhịp sống linh hoạt.</p></div><span>Xem danh mục <ArrowIcon /></span></Link>
          <Link className="category-card" href="/san-pham?category=dien-thoai"><div><h3>Điện thoại</h3><p>Thiết bị 5G, màn hình đẹp và hiệu năng cân bằng.</p></div><span>Khám phá <ArrowIcon /></span></Link>
          <Link className="category-card" href="/san-pham?category=phu-kien"><div><h3>Phụ kiện</h3><p>Bàn phím, sạc nhanh và phụ kiện làm việc.</p></div><span>Mua ngay <ArrowIcon /></span></Link>
        </div>
      </div>
    </section>

    <section className="section section-white">
      <div className="container">
        <div className="section-heading">
          <div><span className="eyebrow">Được lựa chọn nhiều</span><h2>Sản phẩm bán chạy</h2></div>
          <Link className="section-heading-link" href="/san-pham?sort=popular">Xem tất cả <ArrowIcon /></Link>
        </div>
        <div className="product-grid">{catalog.items.slice(0, 8).map((product) => <ProductCard key={product.id} product={product} />)}</div>
      </div>
    </section>

    <section className="section">
      <div className="container story-grid">
        <div className="story-panel">
          <span className="eyebrow eyebrow-light">Envelope protocol v1</span>
          <h3>Mỗi request có một khóa AES riêng.</h3>
          <p>AAD gắn method, path, requestId, timestamp, nonce và khóa công khai tạm của trình duyệt vào ciphertext.</p>
          <div className="story-code">{`POST /api/v1/checkout/place-order\nX-Secure-Envelope: v1\n\n{\n  "algorithm": "RSA-OAEP-256",\n  "contentEncryption": "A256GCM",\n  "encryptedKey": "…",\n  "ciphertext": "…"\n}`}</div>
        </div>
        <div className="story-copy">
          <span className="eyebrow">An toàn theo luồng nghiệp vụ</span>
          <h2>Mã hóa không thay thế kiểm soát logic.</h2>
          <p>Website đồng thời áp dụng kiểm tra dữ liệu phía server, cookie HttpOnly, CSRF double-submit, phân quyền, replay window, idempotency và transaction tồn kho.</p>
          <div className="feature-list">
            <div className="feature-item"><span className="feature-number">01</span><div><strong>Không tin giá phía trình duyệt</strong><p>Checkout chỉ nhận variantId và quantity; API truy xuất đơn giá hiện hành rồi tự tính lại toàn bộ.</p></div></div>
            <div className="feature-item"><span className="feature-number">02</span><div><strong>Không tạo trùng đơn</strong><p>Idempotency key được ràng buộc theo user hoặc guest session bằng unique constraint.</p></div></div>
            <div className="feature-item"><span className="feature-number">03</span><div><strong>Tồn kho có reservation</strong><p>Đặt hàng giữ tồn; xác nhận mới xuất kho; hủy giải phóng hoặc nhập hoàn đúng trạng thái.</p></div></div>
          </div>
        </div>
      </div>
    </section>

    <section className="section section-white">
      <div className="container newsletter">
        <div><h2>Nhận ưu đãi có chọn lọc.</h2><p>Đăng ký email để nhận thông báo sản phẩm mới và chương trình khuyến mãi.</p></div>
        <NewsletterForm />
      </div>
    </section>
  </>;
}

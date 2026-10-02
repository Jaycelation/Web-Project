import type { CatalogSearchResult } from '@secure-commerce/contracts';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowIcon } from '@/components/icons';
import { NewsletterForm } from '@/components/newsletter-form';
import { ProductCard } from '@/components/product-card';
import { ServiceHighlights } from '@/components/service-highlights';
import { searchCatalog } from '@/lib/api';
import { isDemoCatalogEnabled } from '@/lib/demo';
import { fallbackCatalog } from '@/lib/fallback-data';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  let catalog: CatalogSearchResult;
  let notice = '';
  try {
    catalog = await searchCatalog({ page: 1, pageSize: 8, sort: 'popular' });
  } catch {
    catalog = isDemoCatalogEnabled() ? fallbackCatalog : { items: [], total: 0, page: 1, pageSize: 8, categories: [], brands: [] };
    notice = isDemoCatalogEnabled() ? 'Dữ liệu minh họa (demo).' : 'Danh mục tạm thời không khả dụng. Vui lòng thử lại sau.';
  }

  return <>
    <section className="hero">
      <div className="container hero-shell">
        <div className="hero-grid">
          <div className="hero-copy">
            <span className="eyebrow">Bộ sưu tập công nghệ mới</span>
            <h1>Công nghệ đẹp.<br /><em>Mỗi ngày dễ hơn.</em></h1>
            <p>Những thiết bị được tuyển chọn cho công việc tập trung, phút giây thư giãn và nhịp sống luôn chuyển động.</p>
            <div className="hero-actions">
              <Link className="button button-primary" href="/san-pham">Mua sắm ngay <ArrowIcon /></Link>
              <Link className="button button-quiet" href="/san-pham?sort=newest">Xem hàng mới</Link>
            </div>
            <div className="hero-note"><span>Giao hàng toàn quốc</span><span>Đổi trả trong 7 ngày</span></div>
          </div>
          <div className="hero-visual" aria-hidden="true">
            <div className="hero-shape" />
            <div className="hero-product-card hero-product-phone"><Image src="/products/phone.svg" alt="" width={720} height={560} priority /></div>
            <div className="hero-product-card hero-product-audio"><Image src="/products/headphones.svg" alt="" width={720} height={560} priority /></div>
            <div className="hero-price-pill"><small>MIRA SELECT</small><strong>Công nghệ mỗi ngày</strong></div>
          </div>
        </div>
      </div>
    </section>

    <ServiceHighlights />

    <section className="section category-section">
      <div className="container">
        <div className="section-heading">
          <div><span className="eyebrow">Mua theo danh mục</span><h2>Tìm đúng món bạn cần.</h2></div>
          <Link className="section-heading-link" href="/san-pham">Xem tất cả <ArrowIcon /></Link>
        </div>
        <div className="category-grid">
          <Link className="category-card category-audio" href="/san-pham?category=am-thanh">
            <div className="category-card-copy"><span>01</span><h3>Âm thanh</h3><p>Đắm chìm trong từng khoảnh khắc.</p></div>
            <Image className="category-card-image" src="/products/headphones.svg" alt="" width={720} height={560} />
            <span className="category-link">Khám phá <ArrowIcon /></span>
          </Link>
          <Link className="category-card category-mobile" href="/san-pham?category=dien-thoai">
            <div className="category-card-copy"><span>02</span><h3>Điện thoại</h3><p>Kết nối nhanh, lưu giữ sắc nét.</p></div>
            <Image className="category-card-image" src="/products/phone.svg" alt="" width={720} height={560} />
            <span className="category-link">Khám phá <ArrowIcon /></span>
          </Link>
          <Link className="category-card category-accessories" href="/san-pham?category=phu-kien">
            <div className="category-card-copy"><span>03</span><h3>Phụ kiện</h3><p>Hoàn thiện góc làm việc của bạn.</p></div>
            <Image className="category-card-image" src="/products/keyboard.svg" alt="" width={720} height={560} />
            <span className="category-link">Khám phá <ArrowIcon /></span>
          </Link>
        </div>
      </div>
    </section>

    <section className="section section-white">
      <div className="container">
        <div className="section-heading">
          <div><span className="eyebrow">Được yêu thích</span><h2>Sản phẩm nổi bật.</h2></div>
          <Link className="section-heading-link" href="/san-pham?sort=popular">Xem tất cả <ArrowIcon /></Link>
        </div>
        <p role="status">{notice}</p>
        <div className="product-grid">{catalog.items.slice(0, 8).map((product) => <ProductCard key={product.id} product={product} />)}</div>
      </div>
    </section>

    <section className="section editorial-section">
      <div className="container story-grid">
        <div className="story-panel">
          <span className="story-badge">ORBIT 75 · HÀNG MỚI</span>
          <div className="story-panel-copy"><h3>Góc làm việc,<br />đúng chất riêng.</h3><p>Nhỏ gọn trên bàn. Linh hoạt trong mọi nhịp làm việc.</p></div>
          <Image className="story-product-image" src="/products/keyboard.svg" alt="Bàn phím cơ Orbit 75" width={720} height={560} />
        </div>
        <div className="story-copy">
          <span className="eyebrow">MIRA SELECT</span>
          <h2>Ít lựa chọn hơn.<br />Dễ chọn đúng hơn.</h2>
          <p>Mỗi sản phẩm tại MIRA được trình bày rõ ràng, tập trung vào trải nghiệm sử dụng thực tế để bạn quyết định nhanh và tự tin hơn.</p>
          <div className="feature-list">
            <div className="feature-item"><span className="feature-number">01</span><div><strong>Thông tin vừa đủ</strong><p>Phiên bản, giá và tình trạng hàng được trình bày ở đúng nơi bạn cần.</p></div></div>
            <div className="feature-item"><span className="feature-number">02</span><div><strong>Thiết kế được tuyển chọn</strong><p>Ưu tiên sản phẩm cân bằng giữa thẩm mỹ, hiệu năng và độ bền.</p></div></div>
            <div className="feature-item"><span className="feature-number">03</span><div><strong>Đồng hành sau khi mua</strong><p>Theo dõi đơn thuận tiện, hỗ trợ giao hàng và đổi trả rõ ràng.</p></div></div>
          </div>
          <Link className="button button-dark story-action" href="/san-pham?sort=newest">Khám phá hàng mới <ArrowIcon /></Link>
        </div>
      </div>
    </section>

    <section className="section newsletter-section">
      <div className="container newsletter">
        <div><span className="eyebrow eyebrow-light">MIRA LETTER</span><h2>Ưu đãi hay,<br />gửi vừa đủ.</h2><p>Nhận tin về sản phẩm mới và chương trình đáng chú ý.</p></div>
        <NewsletterForm />
      </div>
    </section>
  </>;
}

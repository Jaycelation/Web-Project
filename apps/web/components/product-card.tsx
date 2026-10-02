import { ProductActions } from './product-actions';
import type { ProductSummaryDto } from '@secure-commerce/contracts';
import Image from 'next/image';
import Link from 'next/link';
import { formatMoney } from '@/lib/format';
import { ArrowIcon } from './icons';

export function ProductCard({ product }: { product: ProductSummaryDto }) {
  const discount = product.compareAtPrice && product.compareAtPrice > product.price
    ? Math.round((1 - product.price / product.compareAtPrice) * 100)
    : 0;
  return <article className="product-card">
    <Link href={`/san-pham/${product.slug}`} className="product-image-wrap" aria-label={product.name}>
      {discount > 0 && <span className="discount-badge">-{discount}%</span>}
      {product.featured && <span className="featured-badge">Nổi bật</span>}
      <Image src={product.imageUrl} alt={product.imageAlt} width={520} height={420} className="product-image" />
    </Link>
    <div className="product-card-body">
      <div className="product-meta"><span>{product.category.name}</span><span>{product.brand?.name ?? 'Tuyển chọn'}</span></div>
      <h3><Link href={`/san-pham/${product.slug}`}>{product.name}</Link></h3>
      <p>{product.shortDescription}</p>
      <div className="product-price-row">
        <div><strong>{formatMoney(product.price)}</strong>{product.compareAtPrice && <del>{formatMoney(product.compareAtPrice)}</del>}</div>
        <Link className="round-link" href={`/san-pham/${product.slug}`} aria-label={`Xem ${product.name}`}><ArrowIcon /></Link>
      </div>
      <ProductActions productId={product.id} />
    </div>
  </article>;
}

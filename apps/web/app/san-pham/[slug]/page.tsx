import { SecureApiError } from '@secure-commerce/crypto-envelope';
import { isDemoCatalogEnabled } from '@/lib/demo';
import { ProductReviews } from '@/components/product-reviews';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ProductDetailView } from '@/components/product-detail-view';
import { ProductCard } from '@/components/product-card';
import { productDetail } from '@/lib/api';
import { fallbackDetail } from '@/lib/fallback-data';

export const dynamic = 'force-dynamic';

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  try {
    const product = await productDetail(slug);
    return { title: product.name, description: product.shortDescription, alternates: { canonical: `/san-pham/${product.slug}` } };
  } catch {
    const fallback = isDemoCatalogEnabled() ? fallbackDetail(slug) : undefined;
    return fallback ? { title: fallback.name, description: fallback.shortDescription } : { title: 'Không tìm thấy sản phẩm' };
  }
}

export default async function ProductPage({ params }: PageProps) {
  const { slug } = await params;
  let product;
  let demo = false;
  try { product = await productDetail(slug); } catch (error) {
    if (error instanceof SecureApiError && error.status === 404) notFound();
    if (!isDemoCatalogEnabled()) throw error;
    product = fallbackDetail(slug); demo = true;
  }
  if (!product) notFound();
  const productJsonLd = {
    '@context': 'https://schema.org', '@type': 'Product', name: product.name, sku: product.skuBase,
    image: product.images.map((image) => image.url), description: product.shortDescription,
    brand: product.brand ? { '@type': 'Brand', name: product.brand.name } : undefined,
    offers: { '@type': 'AggregateOffer', priceCurrency: 'VND', lowPrice: (product.variants.length ? Math.min(...product.variants.map((item) => item.price)) : product.price), highPrice: (product.variants.length ? Math.max(...product.variants.map((item) => item.price)) : product.price), availability: product.variants.some((item) => item.availableStock > 0) ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock' },
  };

  return <>
    {demo && <div className="container alert" role="status">Dữ liệu minh họa (demo), không phải sản phẩm thật.</div>}
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd).replace(/</g, '\\u003c') }} />
    <section className="page-hero"><div className="container page-hero-inner"><div className="breadcrumbs"><Link href="/">Trang chủ</Link><span>/</span><Link href="/san-pham">Sản phẩm</Link><span>/</span><strong>{product.name}</strong></div></div></section>
    <section className="section-sm"><div className="container"><ProductDetailView product={product} /></div></section>
    <section className="section-sm"><div className="container product-description"><h2>Chi tiết sản phẩm</h2><p>{product.description}</p><div className="policy-grid"><div className="policy-card"><h3>Vận chuyển</h3><p>{product.policies.shipping}</p></div><div className="policy-card"><h3>Đổi trả</h3><p>{product.policies.returns}</p></div><div className="policy-card"><h3>Bảo hành</h3><p>{product.policies.warranty}</p></div></div></div></section>
    <ProductReviews key={product.id} productId={product.id} />
    {product.related.length > 0 && <section className="section section-white"><div className="container"><div className="section-heading"><div><span className="eyebrow">Có thể bạn quan tâm</span><h2>Sản phẩm liên quan</h2></div></div><div className="product-grid">{product.related.map((item) => <ProductCard key={item.id} product={item} />)}</div></div></section>}
  </>;
}

'use client';
import type { ProductSummaryDto } from '@secure-commerce/contracts';
import type { CollectionKind } from '@secure-commerce/domain';
import Link from 'next/link';
import Image from 'next/image';
import { useCollections } from './collections-provider';
import { ProductCard } from './product-card';
import { usePagedResource } from '@/lib/use-paged-resource';
import { formatMoney } from '@/lib/format';
import { LoadingState } from './loading-state';
const titles = { wishlist: 'Sản phẩm yêu thích', compare: 'So sánh sản phẩm', recent: 'Sản phẩm đã xem' };
export function CollectionView({ kind }: { kind: CollectionKind }) {
  const { collections, ready, persistent, clear } = useCollections();
  const ids = collections[kind];
  const { data, loading, error, reload } = usePagedResource<{ items: ProductSummaryDto[] }>('/catalog/selection', { productIds: ids }, ready && ids.length > 0);
  const products = data?.items ?? [];
  return <section className="section"><div className="container">
    <div className="section-heading"><div><span className="eyebrow">MIRA / Dành cho bạn</span><h1>{titles[kind]}</h1>
      <p>Lưu trên trình duyệt này, không đồng bộ tài khoản. Giá và sản phẩm được tải lại từ cửa hàng.</p></div>
      {ids.length > 0 && <button className="button button-outline button-sm" type="button" onClick={() => { if (confirm('Xóa danh sách này trên trình duyệt?')) clear(kind); }}>Xóa danh sách</button>}
    </div>
    {!persistent && <div className="alert" role="status">Trình duyệt chặn lưu trữ. Danh sách chỉ giữ trong phiên hiện tại.</div>}
    {error && <div className="alert alert-error" role="alert">{error} <button className="link-button" type="button" onClick={reload}>Thử lại</button></div>}
    {(!ready || loading) ? <LoadingState /> : !ids.length ? <div className="empty-state"><h2>Chưa có sản phẩm</h2><p>Thêm lựa chọn từ trang sản phẩm.</p><Link className="button button-primary" href="/san-pham">Khám phá ngay</Link></div> : <>
      {data && products.length < ids.length && <p role="status">{ids.length - products.length} sản phẩm không còn được bày bán.</p>}
      {kind === 'compare' && products.length > 0 ? <div className="table-wrap comparison-wrap"><table className="data-table comparison-table"><caption>Giá từ biến thể đang bán rẻ nhất; chọn phiên bản để xem giá cụ thể.</caption>
        <thead><tr><th scope="col">Tiêu chí</th>{products.map((p) => <th scope="col" key={p.id}><Image src={p.imageUrl} alt={p.imageAlt} width={220} height={180} /><Link href={`/san-pham/${p.slug}`}>{p.name}</Link><ProductActions productId={p.id} /></th>)}</tr></thead>
        <tbody>{[
          ['Giá từ', (p: ProductSummaryDto) => formatMoney(p.price)],
          ['Thương hiệu', (p: ProductSummaryDto) => p.brand?.name ?? '—'],
          ['Danh mục', (p: ProductSummaryDto) => p.category.name],
          ['Mô tả', (p: ProductSummaryDto) => p.shortDescription],
          ['Tồn khả dụng', (p: ProductSummaryDto) => String(p.availableStock ?? '—')],
        ].map(([label, render]) => <tr key={String(label)}><th scope="row">{String(label)}</th>{products.map((p) => <td key={p.id}>{(render as (p: ProductSummaryDto) => string)(p)}</td>)}</tr>)}</tbody>
      </table></div> : <div className="product-grid">{products.map((p) => <ProductCard key={p.id} product={p} />)}</div>}
    </>}
  </div></section>;
}
import { ProductActions } from './product-actions';

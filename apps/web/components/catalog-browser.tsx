'use client';
import type { CatalogSearchInput, CatalogSearchResult } from '@secure-commerce/contracts';
import { catalogQueryString } from '@secure-commerce/domain';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { ProductCard } from './product-card';
import { Pagination } from './pagination';
type Patch = { [Key in keyof CatalogSearchInput]?: CatalogSearchInput[Key] | undefined };
export function CatalogBrowser({ initial: result, initialFilters: filters, initialError = '' }: {
  initial: CatalogSearchResult; initialFilters: CatalogSearchInput; initialError?: string;
}) {
  const router = useRouter(); const [pending, startTransition] = useTransition();
  const [minPrice, setMinPrice] = useState(filters.minPrice?.toString() ?? '');
  const [maxPrice, setMaxPrice] = useState(filters.maxPrice?.toString() ?? '');
  const [error, setError] = useState('');
  useEffect(() => { setMinPrice(filters.minPrice?.toString() ?? ''); setMaxPrice(filters.maxPrice?.toString() ?? ''); setError(''); }, [filters]);
  const navigate = (next: CatalogSearchInput) => { const query = catalogQueryString(next); startTransition(() => router.push(`/san-pham${query ? `?${query}` : ''}`, { scroll: false })); };
  const patch = (values: Patch) => {
    const next: Record<string, unknown> = { ...filters, page: values.page ?? 1 };
    for (const [key, value] of Object.entries(values)) { if (value === undefined || value === false) delete next[key]; else next[key] = value; }
    navigate(next as CatalogSearchInput);
  };
  const applyPrice = () => {
    const min = minPrice ? Number(minPrice) : undefined, max = maxPrice ? Number(maxPrice) : undefined;
    if ([min, max].some((n) => n !== undefined && (!Number.isSafeInteger(n) || n < 0 || n > 2147483647)) || (min !== undefined && max !== undefined && min > max)) {
      setError('Khoảng giá không hợp lệ. Giá tối thiểu phải nhỏ hơn hoặc bằng giá tối đa.'); return;
    }
    setError(''); patch({ minPrice: min, maxPrice: max });
  };
  return <div className="catalog-layout" aria-busy={pending}>
    <aside className="filters"><h2>Bộ lọc sản phẩm</h2><fieldset disabled={pending} className="filter-fieldset">
      <div className="filter-group"><h3>Danh mục</h3><div className="filter-options"><label className="filter-option"><input type="radio" name="category" checked={!filters.category} onChange={() => patch({ category: undefined })}/>Tất cả</label>{result.categories.map((c) => <label className="filter-option" key={c.id}><input type="radio" name="category" checked={filters.category === c.slug} onChange={() => patch({ category: c.slug })}/>{c.name}</label>)}</div></div>
      <div className="filter-group"><h3>Thương hiệu</h3><div className="filter-options"><label className="filter-option"><input type="radio" name="brand" checked={!filters.brand} onChange={() => patch({ brand: undefined })}/>Tất cả</label>{result.brands.map((b) => <label className="filter-option" key={b.id}><input type="radio" name="brand" checked={filters.brand === b.slug} onChange={() => patch({ brand: b.slug })}/>{b.name}</label>)}</div></div>
      <div className="filter-group"><h3>Khoảng giá (VND)</h3><div className="price-inputs"><input aria-label="Giá tối thiểu" inputMode="numeric" maxLength={10} placeholder="Từ" value={minPrice} onChange={(e) => setMinPrice(e.target.value.replace(/\D/g, ''))}/><input aria-label="Giá tối đa" inputMode="numeric" maxLength={10} placeholder="Đến" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value.replace(/\D/g, ''))}/></div><button type="button" className="button button-outline button-sm button-block" onClick={applyPrice}>Áp dụng giá</button></div>
      <div className="filter-group"><label className="filter-option"><input type="checkbox" checked={Boolean(filters.inStock)} onChange={(e) => patch({ inStock: e.target.checked || undefined })}/>Chỉ hiện sản phẩm còn hàng</label></div>
      <button type="button" className="link-button" onClick={() => navigate({ page: 1, pageSize: 12, sort: 'newest' })}>Xóa bộ lọc</button>
    </fieldset></aside>
    <div className="catalog-main"><div className="catalog-toolbar"><p><strong>{result.total}</strong> sản phẩm{filters.query ? <> cho “{filters.query}”</> : null}</p><select aria-label="Sắp xếp" disabled={pending} value={filters.sort ?? 'newest'} onChange={(e) => patch({ sort: e.target.value as CatalogSearchInput['sort'] })}><option value="newest">Mới nhất</option><option value="popular">Bán chạy</option><option value="price_asc">Giá tăng dần</option><option value="price_desc">Giá giảm dần</option></select></div>
      {(error || initialError) && <div className="alert alert-error" role="alert">{error || initialError} {initialError && <button type="button" className="link-button" onClick={() => startTransition(() => router.refresh())}>Thử lại</button>}</div>}
      {pending && <p role="status">Đang cập nhật danh sách…</p>}
      {result.items.length ? <div className="product-grid catalog-grid">{result.items.map((product) => <ProductCard key={product.id} product={product}/>)}</div> : !initialError && <div className="empty-state"><h2>Chưa tìm thấy sản phẩm</h2><p>Thử đổi từ khóa hoặc xóa bớt bộ lọc.</p></div>}
      <Pagination page={result.page} pageSize={result.pageSize} total={result.total} disabled={pending} onChange={(page) => patch({ page })}/>
    </div>
  </div>;
}

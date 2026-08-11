'use client';

import type { CatalogSearchInput, CatalogSearchResult } from '@secure-commerce/contracts';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { apiErrorMessage, clientSearchCatalog } from '@/lib/api';
import { ProductCard } from './product-card';
import { LoadingState } from './loading-state';

export function CatalogBrowser({ initial, initialFilters }: { initial: CatalogSearchResult; initialFilters: CatalogSearchInput }) {
  const router = useRouter();
  const [result, setResult] = useState(initial);
  const [filters, setFilters] = useState<CatalogSearchInput>({ page: 1, pageSize: 12, sort: 'newest', ...initialFilters });
  const [minPrice, setMinPrice] = useState(initialFilters.minPrice?.toString() ?? '');
  const [maxPrice, setMaxPrice] = useState(initialFilters.maxPrice?.toString() ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const firstRender = useRef(true);

  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError('');
      try {
        const next = await clientSearchCatalog(filters);
        setResult(next);
        const params = new URLSearchParams();
        Object.entries(filters).forEach(([key, value]) => {
          if (value !== undefined && value !== '' && value !== false && !(key === 'page' && value === 1) && !(key === 'pageSize')) params.set(key, String(value));
        });
        router.replace(`/san-pham${params.size ? `?${params}` : ''}`, { scroll: false });
      } catch (requestError) {
        setError(apiErrorMessage(requestError));
      } finally {
        setLoading(false);
      }
    }, 180);
    return () => window.clearTimeout(timer);
  }, [filters, router]);

  const patch = (value: Partial<CatalogSearchInput>) => setFilters((current) => ({ ...current, ...value, page: value.page ?? 1 }));
  const applyPrice = () => patch({
    minPrice: minPrice ? Number(minPrice) : undefined,
    maxPrice: maxPrice ? Number(maxPrice) : undefined,
  });
  const pageCount = Math.max(1, Math.ceil(result.total / result.pageSize));

  return <div className="catalog-layout">
    <aside className="filters">
      <h2>Bộ lọc sản phẩm</h2>
      <div className="filter-group">
        <h3>Danh mục</h3>
        <div className="filter-options">
          <label className="filter-option"><input type="radio" name="category" checked={!filters.category} onChange={() => patch({ category: undefined })} /> Tất cả</label>
          {result.categories.map((category) => <label className="filter-option" key={category.id}><input type="radio" name="category" checked={filters.category === category.slug} onChange={() => patch({ category: category.slug })} /> {category.name}</label>)}
        </div>
      </div>
      <div className="filter-group">
        <h3>Thương hiệu</h3>
        <div className="filter-options">
          <label className="filter-option"><input type="radio" name="brand" checked={!filters.brand} onChange={() => patch({ brand: undefined })} /> Tất cả</label>
          {result.brands.map((brand) => <label className="filter-option" key={brand.id}><input type="radio" name="brand" checked={filters.brand === brand.slug} onChange={() => patch({ brand: brand.slug })} /> {brand.name}</label>)}
        </div>
      </div>
      <div className="filter-group">
        <h3>Khoảng giá</h3>
        <div className="price-inputs"><input inputMode="numeric" placeholder="Từ" value={minPrice} onChange={(event) => setMinPrice(event.target.value.replace(/\D/g, ''))} /><input inputMode="numeric" placeholder="Đến" value={maxPrice} onChange={(event) => setMaxPrice(event.target.value.replace(/\D/g, ''))} /></div>
        <button type="button" className="button button-outline button-sm button-block" style={{ marginTop: 10 }} onClick={applyPrice}>Áp dụng giá</button>
      </div>
      <div className="filter-group">
        <label className="filter-option"><input type="checkbox" checked={Boolean(filters.inStock)} onChange={(event) => patch({ inStock: event.target.checked || undefined })} /> Chỉ hiện sản phẩm còn hàng</label>
      </div>
      <button type="button" className="link-button" onClick={() => { setMinPrice(''); setMaxPrice(''); setFilters({ page: 1, pageSize: 12, sort: 'newest' }); }}>Xóa toàn bộ bộ lọc</button>
    </aside>

    <div className="catalog-main">
      <div className="catalog-toolbar">
        <p>Tìm thấy <strong>{result.total}</strong> sản phẩm{filters.query ? <> cho “{filters.query}”</> : null}</p>
        <select aria-label="Sắp xếp" value={filters.sort ?? 'newest'} onChange={(event) => patch({ sort: event.target.value as CatalogSearchInput['sort'] })}>
          <option value="newest">Mới nhất</option><option value="popular">Bán chạy</option><option value="price_asc">Giá tăng dần</option><option value="price_desc">Giá giảm dần</option>
        </select>
      </div>
      {error && <div className="alert alert-error">{error}</div>}
      {loading ? <LoadingState label="Đang cập nhật danh sách…" /> : result.items.length ? <div className="product-grid catalog-grid">{result.items.map((product) => <ProductCard key={product.id} product={product} />)}</div> : <div className="empty-state"><div className="empty-orbit" /><h2>Chưa tìm thấy sản phẩm</h2><p>Thử đổi từ khóa hoặc xóa bớt bộ lọc.</p></div>}
      {pageCount > 1 && <div className="pagination">{Array.from({ length: pageCount }, (_, index) => index + 1).slice(0, 8).map((page) => <button type="button" key={page} className={page === result.page ? 'active' : ''} onClick={() => patch({ page })}>{page}</button>)}</div>}
    </div>
  </div>;
}

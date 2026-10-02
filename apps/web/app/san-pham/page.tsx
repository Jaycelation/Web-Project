import type { Metadata } from 'next';
import type { CatalogSearchInput, CatalogSearchResult } from '@secure-commerce/contracts';
import Link from 'next/link';
import { CatalogBrowser } from '@/components/catalog-browser';
import { searchCatalog } from '@/lib/api';
import { isDemoCatalogEnabled } from '@/lib/demo';
import { fallbackCatalog } from '@/lib/fallback-data';

export const metadata: Metadata = { title: 'Sản phẩm', description: 'Khám phá danh mục sản phẩm, tìm kiếm và lọc theo giá, thương hiệu, tồn kho.' };
export const dynamic = 'force-dynamic';

export default async function ProductsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const query = single(params.q);
  const category = single(params.category);
  const brand = single(params.brand);
  const minPrice = numberValue(params.minPrice);
  const maxPrice = numberValue(params.maxPrice);
  const sort = single(params.sort);
  const filters: CatalogSearchInput = {
    ...(query ? { query: query.slice(0, 120) } : {}),
    ...(category ? { category: category.slice(0, 120) } : {}),
    ...(brand ? { brand: brand.slice(0, 120) } : {}),
    ...(minPrice !== undefined ? { minPrice } : {}),
    ...(maxPrice !== undefined ? { maxPrice } : {}),
    ...(single(params.inStock) === 'true' ? { inStock: true } : {}),
    ...(isSort(sort) ? { sort: sort as NonNullable<CatalogSearchInput['sort']> } : { sort: 'newest' }),
    page: Math.min(100000, Math.max(1, numberValue(params.page) ?? 1)),
    pageSize: 12,
  };
  let initial: CatalogSearchResult;
  let initialError = '';
  try { initial = await searchCatalog(filters); } catch {
    if (isDemoCatalogEnabled()) {
      const items = applyFallback(fallbackCatalog.items, filters);
      initial = { ...fallbackCatalog, items: items.slice(((filters.page ?? 1) - 1) * 12, (filters.page ?? 1) * 12), total: items.length, page: filters.page ?? 1, pageSize: 12 };
      initialError = 'Đang hiển thị dữ liệu minh họa (demo), không phải hàng thật.';
    } else {
      initial = { items: [], total: 0, page: filters.page ?? 1, pageSize: 12, categories: [], brands: [] };
      initialError = 'Không tải được danh mục. Kiểm tra kết nối và thử lại.';
    }
  }

  return <>
    <section className="page-hero"><div className="container page-hero-inner"><div className="breadcrumbs"><Link href="/">Trang chủ</Link><span>/</span><strong>Sản phẩm</strong></div><h1>Khám phá sản phẩm</h1><p>Tìm thiết bị phù hợp theo danh mục, thương hiệu và khoảng giá bạn mong muốn.</p></div></section>
    <section className="section"><div className="container"><CatalogBrowser initial={initial} initialFilters={filters} initialError={initialError} /></div></section>
  </>;
}

function single(value: string | string[] | undefined): string | undefined { return Array.isArray(value) ? value[0] : value; }
function numberValue(value: string | string[] | undefined): number | undefined { const parsed = Number(single(value)); return Number.isSafeInteger(parsed) && parsed >= 0 && parsed <= 2147483647 ? parsed : undefined; }
function isSort(value: string | undefined): boolean { return ['newest', 'popular', 'price_asc', 'price_desc'].includes(value ?? ''); }
function applyFallback(items: CatalogSearchResult['items'], filters: CatalogSearchInput) {
  return items.filter((item) => (!filters.query || `${item.name} ${item.shortDescription}`.toLowerCase().includes(filters.query.toLowerCase())) && (!filters.category || item.category.slug === filters.category) && (!filters.brand || item.brand?.slug === filters.brand) && (filters.minPrice === undefined || item.price >= filters.minPrice) && (filters.maxPrice === undefined || item.price <= filters.maxPrice));
}

import type { Metadata } from 'next';
import type { CatalogSearchInput, CatalogSearchResult } from '@secure-commerce/contracts';
import Link from 'next/link';
import { CatalogBrowser } from '@/components/catalog-browser';
import { searchCatalog } from '@/lib/api';
import { fallbackCatalog } from '@/lib/fallback-data';

export const metadata: Metadata = { title: 'Sản phẩm', description: 'Khám phá danh mục sản phẩm, tìm kiếm và lọc theo giá, thương hiệu, tồn kho.' };
export const dynamic = 'force-dynamic';

export default async function ProductsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const filters: CatalogSearchInput = {
    ...(single(params.q) ? { query: single(params.q) } : {}),
    ...(single(params.category) ? { category: single(params.category) } : {}),
    ...(single(params.brand) ? { brand: single(params.brand) } : {}),
    ...(numberValue(params.minPrice) !== undefined ? { minPrice: numberValue(params.minPrice) } : {}),
    ...(numberValue(params.maxPrice) !== undefined ? { maxPrice: numberValue(params.maxPrice) } : {}),
    ...(single(params.inStock) === 'true' ? { inStock: true } : {}),
    ...(isSort(single(params.sort)) ? { sort: single(params.sort) as CatalogSearchInput['sort'] } : { sort: 'newest' }),
    page: Math.max(1, numberValue(params.page) ?? 1),
    pageSize: 12,
  };
  let initial: CatalogSearchResult;
  try { initial = await searchCatalog(filters); } catch { initial = { ...fallbackCatalog, items: applyFallback(fallbackCatalog.items, filters), total: applyFallback(fallbackCatalog.items, filters).length }; }

  return <>
    <section className="page-hero"><div className="container page-hero-inner"><div className="breadcrumbs"><Link href="/">Trang chủ</Link><span>/</span><strong>Sản phẩm</strong></div><h1>Khám phá sản phẩm</h1><p>Tìm theo tên, SKU, danh mục hoặc thương hiệu. Giá và tồn kho được xác thực lại ở server khi checkout.</p></div></section>
    <section className="section"><div className="container"><CatalogBrowser initial={initial} initialFilters={filters} /></div></section>
  </>;
}

function single(value: string | string[] | undefined): string | undefined { return Array.isArray(value) ? value[0] : value; }
function numberValue(value: string | string[] | undefined): number | undefined { const parsed = Number(single(value)); return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined; }
function isSort(value: string | undefined): boolean { return ['newest', 'popular', 'price_asc', 'price_desc'].includes(value ?? ''); }
function applyFallback(items: CatalogSearchResult['items'], filters: CatalogSearchInput) {
  return items.filter((item) => (!filters.query || `${item.name} ${item.shortDescription}`.toLowerCase().includes(filters.query.toLowerCase())) && (!filters.category || item.category.slug === filters.category) && (!filters.brand || item.brand?.slug === filters.brand) && (filters.minPrice === undefined || item.price >= filters.minPrice) && (filters.maxPrice === undefined || item.price <= filters.maxPrice));
}

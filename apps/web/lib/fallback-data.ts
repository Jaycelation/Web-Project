import type { CatalogSearchResult, ProductDetailDto, ProductSummaryDto } from '@secure-commerce/contracts';

const categories = [
  { id: 'cat-audio', name: 'Âm thanh', slug: 'am-thanh' },
  { id: 'cat-mobile', name: 'Điện thoại', slug: 'dien-thoai' },
  { id: 'cat-accessories', name: 'Phụ kiện', slug: 'phu-kien' },
];
const brands = [
  { id: 'brand-aurora', name: 'Aurora', slug: 'aurora' },
  { id: 'brand-nova', name: 'Nova', slug: 'nova' },
  { id: 'brand-orbit', name: 'Orbit', slug: 'orbit' },
];

export const fallbackProducts: ProductSummaryDto[] = [
  {
    id: 'demo-headphones', slug: 'tai-nghe-aurora-pro', name: 'Tai nghe Aurora Pro',
    shortDescription: 'Chống ồn chủ động, pin 40 giờ và âm thanh không gian.',
    price: 2_490_000, compareAtPrice: 2_990_000, imageUrl: '/products/headphones.svg', imageAlt: 'Tai nghe Aurora Pro',
    category: categories[0]!, brand: brands[0]!, featured: true, soldCount: 312,
  },
  {
    id: 'demo-phone', slug: 'dien-thoai-nova-x1', name: 'Nova X1 5G',
    shortDescription: 'Màn hình OLED 120 Hz, camera 50 MP và sạc nhanh 80 W.',
    price: 12_990_000, compareAtPrice: 13_990_000, imageUrl: '/products/phone.svg', imageAlt: 'Điện thoại Nova X1 5G',
    category: categories[1]!, brand: brands[1]!, featured: true, soldCount: 184,
  },
  {
    id: 'demo-keyboard', slug: 'ban-phim-orbit-75', name: 'Bàn phím cơ Orbit 75',
    shortDescription: 'Layout 75%, hot-swap và kết nối ba chế độ.',
    price: 1_790_000, compareAtPrice: null, imageUrl: '/products/keyboard.svg', imageAlt: 'Bàn phím cơ Orbit 75',
    category: categories[2]!, brand: brands[2]!, featured: true, soldCount: 268,
  },
  {
    id: 'demo-charger', slug: 'sac-nhanh-orbit-gan-65w', name: 'Sạc nhanh Orbit GaN 65 W',
    shortDescription: 'Hai cổng USB-C, một cổng USB-A, thiết kế nhỏ gọn.',
    price: 690_000, compareAtPrice: 790_000, imageUrl: '/products/charger.svg', imageAlt: 'Sạc nhanh Orbit GaN 65 W',
    category: categories[2]!, brand: brands[2]!, featured: true, soldCount: 421,
  },
];

export const fallbackCatalog: CatalogSearchResult = {
  items: fallbackProducts,
  total: fallbackProducts.length,
  page: 1,
  pageSize: 12,
  categories,
  brands,
};

export function fallbackDetail(slug: string): ProductDetailDto | undefined {
  const product = fallbackProducts.find((item) => item.slug === slug);
  if (!product) return undefined;
  const variants = product.slug === 'dien-thoai-nova-x1'
    ? [
        { id: '00000000-0000-4000-8000-000000000201', sku: 'NOVA-X1-256-BLK', name: '256 GB · Đen', attributes: { storage: '256 GB', color: 'Đen' }, price: 12_990_000, compareAtPrice: 13_990_000, availableStock: 9, active: true },
        { id: '00000000-0000-4000-8000-000000000202', sku: 'NOVA-X1-512-BLU', name: '512 GB · Xanh', attributes: { storage: '512 GB', color: 'Xanh' }, price: 14_490_000, compareAtPrice: null, availableStock: 6, active: true },
      ]
    : [{ id: `00000000-0000-4000-8000-${slug.length.toString().padStart(12, '0')}`, sku: product.slug.toUpperCase().slice(0, 18), name: 'Phiên bản tiêu chuẩn', attributes: {}, price: product.price, compareAtPrice: product.compareAtPrice, availableStock: 12, active: true }];
  return {
    ...product,
    description: `${product.shortDescription} Thiết kế cân bằng giữa trải nghiệm sử dụng, độ bền và tính thẩm mỹ trong cuộc sống hằng ngày.`,
    skuBase: variants[0]!.sku,
    images: [{ id: `${product.id}-image`, url: product.imageUrl, alt: product.imageAlt, position: 0 }],
    variants,
    policies: {
      shipping: 'Giao hàng toàn quốc, kiểm tra hàng trước khi nhận.',
      returns: 'Đổi trả trong 7 ngày nếu sản phẩm lỗi hoặc giao sai.',
      warranty: 'Bảo hành 12 tháng theo điều kiện của nhà sản xuất.',
    },
    related: fallbackProducts.filter((item) => item.id !== product.id).slice(0, 3),
  };
}

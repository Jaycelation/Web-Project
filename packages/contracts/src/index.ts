export type Money = number;

export type UserRole = 'CUSTOMER' | 'STAFF' | 'ADMIN';
export type ProductStatus = 'DRAFT' | 'ACTIVE' | 'HIDDEN';
export type OrderStatus =
  | 'PENDING_CONFIRMATION'
  | 'CONFIRMED'
  | 'PREPARING'
  | 'SHIPPING'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'RETURN_REQUESTED'
  | 'REFUNDED';

export type PaymentMethod = 'COD' | 'BANK_TRANSFER' | 'CARD' | 'EWALLET';
export type PaymentStatus = 'PENDING' | 'AWAITING_TRANSFER' | 'PAID' | 'FAILED' | 'REFUNDED';

export interface CategoryDto {
  id: string;
  name: string;
  slug: string;
}

export interface BrandDto {
  id: string;
  name: string;
  slug: string;
}

export interface ProductVariantDto {
  id: string;
  sku: string;
  name: string;
  attributes: Record<string, string>;
  price: Money;
  compareAtPrice: Money | null;
  availableStock: number;
  active: boolean;
}

export interface ProductSummaryDto {
  id: string;
  slug: string;
  name: string;
  shortDescription: string;
  price: Money;
  compareAtPrice: Money | null;
  imageUrl: string;
  imageAlt: string;
  category: CategoryDto;
  brand: BrandDto | null;
  featured: boolean;
  soldCount: number;
}

export interface ProductDetailDto extends ProductSummaryDto {
  description: string;
  skuBase: string;
  images: Array<{ id: string; url: string; alt: string; position: number }>;
  variants: ProductVariantDto[];
  policies: {
    shipping: string;
    returns: string;
    warranty: string;
  };
  related: ProductSummaryDto[];
}

export interface CatalogSearchInput {
  query?: string;
  category?: string;
  brand?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  sort?: 'newest' | 'price_asc' | 'price_desc' | 'popular';
  page?: number;
  pageSize?: number;
}

export interface CatalogSearchResult {
  items: ProductSummaryDto[];
  total: number;
  page: number;
  pageSize: number;
  categories: CategoryDto[];
  brands: BrandDto[];
}

export interface CartLineInput {
  variantId: string;
  quantity: number;
}

export interface CartLineDto {
  variantId: string;
  productId: string;
  productSlug: string;
  productName: string;
  variantName: string;
  sku: string;
  imageUrl: string;
  unitPrice: Money;
  quantity: number;
  lineTotal: Money;
  availableStock: number;
}

export interface CartDto {
  items: CartLineDto[];
  subtotal: Money;
  itemCount: number;
}

export interface ShippingAddressInput {
  fullName: string;
  phone: string;
  email: string;
  line1: string;
  line2?: string;
  ward?: string;
  district: string;
  province: string;
  postalCode?: string;
  country?: string;
}

export interface CheckoutInput {
  items: CartLineInput[];
  shippingAddress: ShippingAddressInput;
  paymentMethod: Extract<PaymentMethod, 'COD' | 'BANK_TRANSFER'>;
  couponCode?: string;
  customerNote?: string;
  guestSessionId?: string;
}

export interface CheckoutResult {
  orderId: string;
  orderNo: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  subtotal: Money;
  discount: Money;
  shippingFee: Money;
  total: Money;
  bankTransfer?: {
    bankName: string;
    accountNumber: string;
    accountName: string;
    transferContent: string;
  };
  createdAt: string;
}

export interface OrderItemDto {
  id: string;
  productName: string;
  variantName: string;
  sku: string;
  imageUrl: string;
  unitPrice: Money;
  quantity: number;
  lineTotal: Money;
}

export interface OrderStatusHistoryDto {
  id: string;
  fromStatus: OrderStatus | null;
  toStatus: OrderStatus;
  note: string | null;
  actorName: string | null;
  createdAt: string;
}

export interface OrderDto extends CheckoutResult {
  paymentMethod: PaymentMethod;
  customerNote: string | null;
  cancellationReason: string | null;
  shippingAddress: ShippingAddressInput;
  items: OrderItemDto[];
  statusHistory: OrderStatusHistoryDto[];
  trackingCode: string | null;
  trackingUrl: string | null;
}

export interface AuthUserDto {
  id: string;
  email: string;
  phone: string | null;
  name: string;
  role: UserRole;
}

export interface AuthResult {
  user: AuthUserDto;
  csrfToken: string;
}

export interface DashboardDto {
  revenue: number;
  orderCount: number;
  averageOrderValue: number;
  newCustomers: number;
  cancellationRate: number;
  ordersByStatus: Array<{ status: OrderStatus; count: number }>;
  bestSellers: Array<{ productName: string; quantity: number; revenue: number }>;
  lowStock: Array<{ variantId: string; sku: string; productName: string; availableStock: number }>;
  dailyRevenue: Array<{ date: string; revenue: number; orders: number }>;
}

export interface ApiErrorPayload {
  statusCode: number;
  code: string;
  message: string;
  details?: unknown;
  requestId: string;
  timestamp: string;
}

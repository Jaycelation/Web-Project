export type OrderStatus =
  | 'PENDING_CONFIRMATION'
  | 'CONFIRMED'
  | 'PREPARING'
  | 'SHIPPING'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'RETURN_REQUESTED'
  | 'REFUNDED';

export type DiscountRule =
  | {
      type: 'PERCENTAGE';
      value: number;
      maxDiscount?: number | null;
      minOrder?: number;
    }
  | {
      type: 'FIXED_AMOUNT';
      value: number;
      minOrder?: number;
    }
  | {
      type: 'FREE_SHIPPING';
      value?: number;
      minOrder?: number;
    };

export interface AuthoritativeVariant {
  id: string;
  unitPrice: number;
  availableStock: number;
  active: boolean;
}

export interface RequestedLine {
  variantId: string;
  quantity: number;
}

export interface PricedLine {
  variantId: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface PriceOrderInput {
  requestedLines: RequestedLine[];
  variants: Map<string, AuthoritativeVariant>;
  coupon?: DiscountRule | null;
  baseShippingFee?: number;
  freeShippingThreshold?: number;
}

export interface PriceOrderResult {
  lines: PricedLine[];
  subtotal: number;
  discount: number;
  shippingFee: number;
  total: number;
}

export class DomainError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'DomainError';
  }
}

function assertIntegerMoney(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new DomainError('INVALID_MONEY', `${name} phải là số nguyên không âm.`);
  }
}

export function priceOrder(input: PriceOrderInput): PriceOrderResult {
  if (input.requestedLines.length === 0) {
    throw new DomainError('EMPTY_CART', 'Giỏ hàng không có sản phẩm.');
  }

  const merged = new Map<string, number>();
  for (const item of input.requestedLines) {
    if (!Number.isSafeInteger(item.quantity) || item.quantity < 1 || item.quantity > 100) {
      throw new DomainError('INVALID_QUANTITY', 'Số lượng sản phẩm không hợp lệ.');
    }
    merged.set(item.variantId, (merged.get(item.variantId) ?? 0) + item.quantity);
  }

  const lines: PricedLine[] = [];
  let subtotal = 0;

  for (const [variantId, quantity] of merged.entries()) {
    const variant = input.variants.get(variantId);
    if (!variant || !variant.active) {
      throw new DomainError('VARIANT_UNAVAILABLE', `Biến thể ${variantId} không còn kinh doanh.`);
    }
    assertIntegerMoney(variant.unitPrice, 'Đơn giá');
    if (variant.availableStock < quantity) {
      throw new DomainError('INSUFFICIENT_STOCK', `Biến thể ${variantId} không đủ tồn kho.`);
    }
    const lineTotal = variant.unitPrice * quantity;
    if (!Number.isSafeInteger(lineTotal)) {
      throw new DomainError('MONEY_OVERFLOW', 'Giá trị dòng hàng vượt giới hạn an toàn.');
    }
    lines.push({ variantId, quantity, unitPrice: variant.unitPrice, lineTotal });
    subtotal += lineTotal;
  }

  assertIntegerMoney(subtotal, 'Tạm tính');
  const baseShippingFee = input.baseShippingFee ?? 30_000;
  const freeShippingThreshold = input.freeShippingThreshold ?? 1_000_000;
  assertIntegerMoney(baseShippingFee, 'Phí vận chuyển');
  assertIntegerMoney(freeShippingThreshold, 'Ngưỡng miễn phí vận chuyển');

  let shippingFee = subtotal >= freeShippingThreshold ? 0 : baseShippingFee;
  let discount = 0;
  const coupon = input.coupon;

  if (coupon && subtotal >= (coupon.minOrder ?? 0)) {
    switch (coupon.type) {
      case 'PERCENTAGE': {
        if (coupon.value <= 0 || coupon.value > 100) {
          throw new DomainError('INVALID_COUPON', 'Phần trăm giảm giá không hợp lệ.');
        }
        discount = Math.floor((subtotal * coupon.value) / 100);
        if (coupon.maxDiscount != null) {
          assertIntegerMoney(coupon.maxDiscount, 'Mức giảm tối đa');
          discount = Math.min(discount, coupon.maxDiscount);
        }
        break;
      }
      case 'FIXED_AMOUNT':
        assertIntegerMoney(coupon.value, 'Giá trị giảm');
        discount = Math.min(coupon.value, subtotal);
        break;
      case 'FREE_SHIPPING':
        shippingFee = 0;
        break;
      default: {
        const unreachable: never = coupon;
        throw new DomainError('INVALID_COUPON', `Loại coupon không hỗ trợ: ${String(unreachable)}`);
      }
    }
  }

  const total = Math.max(0, subtotal - discount + shippingFee);
  assertIntegerMoney(total, 'Tổng tiền');

  return { lines, subtotal, discount, shippingFee, total };
}

const ORDER_TRANSITIONS: Readonly<Record<OrderStatus, readonly OrderStatus[]>> = {
  PENDING_CONFIRMATION: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PREPARING', 'CANCELLED'],
  PREPARING: ['SHIPPING', 'CANCELLED'],
  SHIPPING: ['DELIVERED', 'RETURN_REQUESTED'],
  DELIVERED: ['RETURN_REQUESTED'],
  CANCELLED: [],
  RETURN_REQUESTED: ['REFUNDED', 'DELIVERED'],
  REFUNDED: [],
};

export function canTransitionOrder(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_TRANSITIONS[from].includes(to);
}

export function assertOrderTransition(from: OrderStatus, to: OrderStatus): void {
  if (!canTransitionOrder(from, to)) {
    throw new DomainError('INVALID_ORDER_TRANSITION', `Không thể chuyển đơn từ ${from} sang ${to}.`);
  }
}

export function requiresInventoryReservationRelease(status: OrderStatus): boolean {
  return status === 'PENDING_CONFIRMATION';
}

export function requiresInventoryRestock(status: OrderStatus): boolean {
  return status === 'CONFIRMED' || status === 'PREPARING';
}

export * from './commerce-upgrade.js';

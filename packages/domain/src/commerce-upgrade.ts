/** Pure policies shared by API, browser and regression tests. No I/O. */
export const COLLECTION_LIMITS = { wishlist: 20, compare: 4, recent: 12 } as const;
export type CollectionKind = keyof typeof COLLECTION_LIMITS;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
export function normalizeProductIds(value: unknown, limit: number): string[] {
  if (!Array.isArray(value) || !Number.isInteger(limit) || limit < 1) return [];
  return [...new Set(value.filter((id): id is string => typeof id === 'string' && UUID.test(id))
    .map((id) => id.toLowerCase()))].slice(0, limit);
}
export function toggleProductId(current: string[], id: string, limit: number): string[] {
  const safe = normalizeProductIds(current, limit);
  const valid = normalizeProductIds([id], 1)[0];
  if (!valid) return safe;
  if (safe.includes(valid)) return safe.filter((item) => item !== valid);
  return safe.length < limit ? [...safe, valid] : safe;
}
export function rememberProduct(current: string[], id: string): string[] {
  return normalizeProductIds([id, ...current.filter((item) => item !== id)], COLLECTION_LIMITS.recent);
}
export function availableQuantity(stock: number, reserved: number): number {
  if (!Number.isSafeInteger(stock) || !Number.isSafeInteger(reserved) || stock < 0 || reserved < 0) return 0;
  return Math.max(0, stock - reserved);
}
export function clampCartQuantity(requested: number, available: number): number {
  if (!Number.isFinite(requested) || !Number.isSafeInteger(available) || available < 1) return 0;
  return Math.max(1, Math.min(Math.floor(requested), available, 100));
}
export function canReviewPurchase(userId: string, ownerId: string | null, status: string): boolean {
  return Boolean(userId) && userId === ownerId && status === 'DELIVERED';
}
export function canCustomerTransition(userId: string, ownerId: string | null, from: string, to: string): boolean {
  return Boolean(userId) && userId === ownerId &&
    ((from === 'PENDING_CONFIRMATION' && to === 'CANCELLED') || (from === 'DELIVERED' && to === 'RETURN_REQUESTED'));
}
export interface CouponDefinition {
  code: string; type: 'PERCENTAGE' | 'FIXED_AMOUNT' | 'FREE_SHIPPING'; value: number;
  minOrder: number; maxDiscount?: number | null; usageLimit?: number | null;
  usagePerUser: number; startsAt: string; expiresAt: string;
}
export function validateCouponDefinition(input: CouponDefinition): string | null {
  const int = (n: number) => Number.isSafeInteger(n) && n >= 0 && n <= 2_147_483_647;
  if (!/^[A-Z0-9][A-Z0-9_-]{2,39}$/u.test(input.code)) return 'COUPON_CODE_INVALID';
  if (!['PERCENTAGE','FIXED_AMOUNT','FREE_SHIPPING'].includes(input.type)) return 'COUPON_TYPE_INVALID';
  if (!int(input.value) || !int(input.minOrder)) return 'COUPON_AMOUNT_INVALID';
  if (input.type === 'PERCENTAGE' && (input.value < 1 || input.value > 100)) return 'COUPON_PERCENT_INVALID';
  if (input.type === 'FIXED_AMOUNT' && input.value < 1) return 'COUPON_AMOUNT_INVALID';
  if (input.type === 'FREE_SHIPPING' && input.value !== 0) return 'COUPON_SHIPPING_VALUE_INVALID';
  if (input.maxDiscount != null && (!int(input.maxDiscount) || input.maxDiscount < 1 || input.type !== 'PERCENTAGE')) return 'COUPON_CAP_INVALID';
  if (!int(input.usagePerUser) || input.usagePerUser < 1) return 'COUPON_USER_LIMIT_INVALID';
  if (input.usageLimit != null && (!int(input.usageLimit) || input.usageLimit < 1)) return 'COUPON_USAGE_LIMIT_INVALID';
  const start = Date.parse(input.startsAt), end = Date.parse(input.expiresAt);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end) return 'COUPON_DATES_INVALID';
  return null;
}
/** Spreadsheet-viewing export, not a lossless import format. Dangerous text is visibly prefixed. */
export function csvCell(value: unknown): string {
  let text = value == null ? '' : String(value);
  text = text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/gu, '');
  if (typeof value !== 'number' && (/^[\s\uFEFF]*[=+\-@\uFF1D\uFF0B\uFF0D\uFF20]/u.test(text) || /^[\t\r\n]/u.test(text))) {
    text = `text: ${text}`;
  }
  return `"${text.replaceAll('"', '""')}"`;
}
export function toCsv(rows: readonly (readonly unknown[])[]): string {
  return '\uFEFF' + rows.map((row) => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}
export function catalogQueryString(filters: object): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value == null || value === '' || value === false || key === 'pageSize' || (key === 'page' && value === 1)) continue;
    params.set(key === 'query' ? 'q' : key, String(value));
  }
  return params.toString();
}

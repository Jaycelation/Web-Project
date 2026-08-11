import { SecureApiClient, SecureApiError } from '@secure-commerce/crypto-envelope';
import type {
  AuthResult,
  CatalogSearchInput,
  CatalogSearchResult,
  CheckoutInput,
  CheckoutResult,
  OrderDto,
  ProductDetailDto,
} from '@secure-commerce/contracts';

let browserClient: SecureApiClient | undefined;
let serverClient: SecureApiClient | undefined;

export function browserApi(): SecureApiClient {
  browserClient ??= new SecureApiClient({
    baseUrl: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1',
    pinnedServerFingerprint: process.env.NEXT_PUBLIC_CRYPTO_SERVER_KEY_SHA256 || undefined,
    credentials: 'include',
  });
  return browserClient;
}

export function serverApi(): SecureApiClient {
  serverClient ??= new SecureApiClient({
    baseUrl: process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1',
    pinnedServerFingerprint: process.env.NEXT_PUBLIC_CRYPTO_SERVER_KEY_SHA256 || undefined,
    credentials: 'omit',
    fetchImpl: timedFetch,
  });
  return serverClient;
}

const timedFetch: typeof fetch = (input, init) => {
  const timeout = AbortSignal.timeout(4_000);
  return fetch(input, { ...init, signal: init?.signal ?? timeout });
};

export function apiErrorMessage(error: unknown): string {
  if (error instanceof SecureApiError) {
    const payload = error.payload as { message?: unknown };
    if (typeof payload?.message === 'string') return payload.message;
    if (Array.isArray(payload?.message)) return payload.message.map(String).join('; ');
  }
  return error instanceof Error ? error.message : 'Không thể kết nối hệ thống.';
}

export async function searchCatalog(input: CatalogSearchInput): Promise<CatalogSearchResult> {
  return serverApi().request<CatalogSearchResult, CatalogSearchInput>('/catalog/search', input);
}

export async function productDetail(slug: string): Promise<ProductDetailDto> {
  return serverApi().request<ProductDetailDto, { slug: string }>('/catalog/detail', { slug });
}

export async function clientSearchCatalog(input: CatalogSearchInput): Promise<CatalogSearchResult> {
  return browserApi().request<CatalogSearchResult, CatalogSearchInput>('/catalog/search', input);
}

export async function clientCheckout(
  input: CheckoutInput,
  idempotencyKey: string,
): Promise<CheckoutResult> {
  return browserApi().request<CheckoutResult, CheckoutInput>('/checkout/place-order', input, {
    headers: { 'idempotency-key': idempotencyKey },
  });
}

export async function clientOrders(): Promise<{ items: OrderDto[]; total: number }> {
  return browserApi().request('/orders/mine', { page: 1, pageSize: 30 });
}

export async function clientLogin(email: string, password: string): Promise<AuthResult> {
  return browserApi().request('/auth/login', { email, password });
}

export async function clientRegister(input: {
  name: string;
  email: string;
  phone?: string;
  password: string;
}): Promise<AuthResult> {
  return browserApi().request('/auth/register', input);
}

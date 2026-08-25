import {
  SecureApiClient,
  SecureApiError,
  SECURE_JWE_VERSION,
  type SecureApiRequestOptions,
} from "@secure-commerce/crypto-envelope";
import type {
  AuthResult,
  CatalogSearchInput,
  CatalogSearchResult,
  CheckoutInput,
  CheckoutResult,
  OrderDto,
  ProductDetailDto,
} from "@secure-commerce/contracts";

let browserClient: SecureApiClient | undefined;
let serverClient: SecureApiClient | undefined;
let refreshPromise: Promise<void> | undefined;

const NO_SESSION_REFRESH = new Set([
  "/auth/login",
  "/auth/register",
  "/auth/forgot-password",
  "/auth/reset-password",
  "/auth/refresh",
]);

const TECHNICAL_API_CODES = new Set([
  "AAD_INVALID",
  "AAD_ROUTE_MISMATCH",
  "BOUND_HEADER_MISMATCH",
  "CLIENT_KEY_ID_MISMATCH",
  "CSRF_INVALID",
  "ENVELOPE_MALFORMED",
  "ENVELOPE_VERSION_INVALID",
  "INTERNAL_ERROR",
  "ORIGIN_NOT_ALLOWED",
  "REPLAY_DETECTED",
  "REQUEST_EXPIRED",
  "SECURE_ENVELOPE_REQUIRED",
  "SERVER_KEY_ROTATED",
]);

const CONNECTION_ERROR_MESSAGE =
  "Kết nối đang gián đoạn. Vui lòng thử lại sau ít phút.";

export function browserApi(): SecureApiClient {
  const pinnedServerFingerprint =
    process.env.NEXT_PUBLIC_CRYPTO_SERVER_KEY_SHA256;
  const pinnedSigningFingerprint =
    process.env.NEXT_PUBLIC_CRYPTO_SIGNING_KEY_SHA256;
  browserClient ??= new SecureApiClient({
    baseUrl: browserApiBaseUrl(),
    ...(pinnedServerFingerprint ? { pinnedServerFingerprint } : {}),
    ...(pinnedSigningFingerprint ? { pinnedSigningFingerprint } : {}),
    protocolVersion: SECURE_JWE_VERSION,
    credentials: "include",
  });
  return browserClient;
}

function browserApiBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_API_URL;
  if (configured && /^https?:\/\//u.test(configured)) return configured;
  if (typeof window !== "undefined") {
    return new URL(configured || "/api/v1", window.location.origin).toString();
  }
  return "http://localhost:4000/api/v1";
}

export function serverApi(): SecureApiClient {
  const pinnedServerFingerprint =
    process.env.NEXT_PUBLIC_CRYPTO_SERVER_KEY_SHA256;
  const pinnedSigningFingerprint =
    process.env.NEXT_PUBLIC_CRYPTO_SIGNING_KEY_SHA256;
  serverClient ??= new SecureApiClient({
    baseUrl:
      process.env.API_INTERNAL_URL ??
      process.env.NEXT_PUBLIC_API_URL ??
      "http://localhost:4000/api/v1",
    ...(pinnedServerFingerprint ? { pinnedServerFingerprint } : {}),
    ...(pinnedSigningFingerprint ? { pinnedSigningFingerprint } : {}),
    protocolVersion: SECURE_JWE_VERSION,
    credentials: "omit",
    fetchImpl: timedFetch,
  });
  return serverClient;
}

export async function browserRequest<TResponse, TBody = unknown>(
  path: string,
  body: TBody,
  options: SecureApiRequestOptions = {},
): Promise<TResponse> {
  try {
    return await browserApi().request<TResponse, TBody>(path, body, options);
  } catch (error) {
    if (
      !(error instanceof SecureApiError) ||
      error.status !== 401 ||
      NO_SESSION_REFRESH.has(path) ||
      !hasBrowserSessionHint()
    ) {
      throw error;
    }

    try {
      refreshPromise ??= browserApi()
        .request<unknown, Record<string, never>>("/auth/refresh", {})
        .then(() => undefined)
        .finally(() => {
          refreshPromise = undefined;
        });
      await refreshPromise;
    } catch {
      throw error;
    }
    return browserApi().request<TResponse, TBody>(path, body, options);
  }
}

const timedFetch: typeof fetch = (input, init) => {
  const timeout = AbortSignal.timeout(4_000);
  return fetch(input, { ...init, signal: init?.signal ?? timeout });
};

export function apiErrorMessage(error: unknown): string {
  if (error instanceof SecureApiError) {
    const payload = error.payload as { code?: unknown; message?: unknown };
    if (
      error.status >= 500 ||
      (typeof payload?.code === "string" &&
        TECHNICAL_API_CODES.has(payload.code))
    ) {
      return CONNECTION_ERROR_MESSAGE;
    }
    if (typeof payload?.message === "string") return payload.message;
    if (Array.isArray(payload?.message))
      return payload.message.map(String).join("; ");
  }
  return CONNECTION_ERROR_MESSAGE;
}

export async function searchCatalog(
  input: CatalogSearchInput,
): Promise<CatalogSearchResult> {
  return serverApi().request<CatalogSearchResult, CatalogSearchInput>(
    "/catalog/search",
    input,
  );
}

export async function productDetail(slug: string): Promise<ProductDetailDto> {
  return serverApi().request<ProductDetailDto, { slug: string }>(
    "/catalog/detail",
    { slug },
  );
}

export async function clientSearchCatalog(
  input: CatalogSearchInput,
): Promise<CatalogSearchResult> {
  return browserRequest<CatalogSearchResult, CatalogSearchInput>(
    "/catalog/search",
    input,
  );
}

export async function clientCheckout(
  input: CheckoutInput,
  idempotencyKey: string,
): Promise<CheckoutResult> {
  return browserRequest<CheckoutResult, CheckoutInput>(
    "/checkout/place-order",
    input,
    {
      headers: { "idempotency-key": idempotencyKey },
    },
  );
}

export async function clientOrders(): Promise<{
  items: OrderDto[];
  total: number;
}> {
  return browserRequest("/orders/mine", { page: 1, pageSize: 30 });
}

export async function clientLogin(
  email: string,
  password: string,
): Promise<AuthResult> {
  return browserRequest("/auth/login", { email, password });
}

export async function clientRegister(input: {
  name: string;
  email: string;
  phone?: string;
  password: string;
}): Promise<AuthResult> {
  return browserRequest("/auth/register", input);
}

function hasBrowserSessionHint(): boolean {
  if (typeof document === "undefined") return false;
  return document.cookie
    .split(";")
    .some((item) => item.trim().startsWith("csrf_token="));
}

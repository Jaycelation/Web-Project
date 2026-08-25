import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  SECURE_ENVELOPE_VERSION,
  SECURE_JWE_VERSION,
  SecureApiClient,
  SecureApiError,
} from "../packages/crypto-envelope/dist/index.js";

const baseUrl = (
  process.env.API_BASE_URL ?? "http://localhost:4000/api/v1"
).replace(/\/+$/u, "");
const allowWrite = process.env.ACCEPTANCE_WRITE === "1";

class CookieJar {
  #values = new Map();

  absorb(response) {
    const values =
      typeof response.headers.getSetCookie === "function"
        ? response.headers.getSetCookie()
        : splitSetCookie(response.headers.get("set-cookie"));
    for (const line of values) {
      const first = line.split(";", 1)[0];
      if (!first) continue;
      const separator = first.indexOf("=");
      if (separator <= 0) continue;
      const name = first.slice(0, separator).trim();
      const value = first.slice(separator + 1).trim();
      if (!value) this.#values.delete(name);
      else this.#values.set(name, value);
    }
  }

  header() {
    return [...this.#values]
      .map(([name, value]) => `${name}=${value}`)
      .join("; ");
  }

  get(name) {
    return this.#values.get(name);
  }

  set(name, value) {
    if (value) this.#values.set(name, value);
    else this.#values.delete(name);
    return this;
  }
}

function splitSetCookie(value) {
  if (!value) return [];
  return value
    .split(/,(?=\s*[^;,=]+=[^;,]*)/u)
    .map((item) => item.trim())
    .filter(Boolean);
}

function fetchWithJar(jar) {
  return async (input, init = {}) => {
    const headers = new Headers(init.headers);
    const cookie = jar.header();
    if (cookie) headers.set("cookie", cookie);
    const response = await fetch(input, { ...init, headers });
    jar.absorb(response);
    return response;
  };
}

function clientWithJar(jar, protocolVersion = SECURE_JWE_VERSION) {
  return new SecureApiClient({
    baseUrl,
    fetchImpl: fetchWithJar(jar),
    credentials: "include",
    csrfTokenProvider: () => jar.get("csrf_token"),
    protocolVersion,
  });
}

async function expectSecureError(promise, status) {
  try {
    await promise;
    assert.fail(`Kỳ vọng HTTP ${status} nhưng request thành công.`);
  } catch (error) {
    assert.ok(
      error instanceof SecureApiError,
      `Kỳ vọng SecureApiError, nhận ${String(error)}`,
    );
    assert.equal(error.status, status);
    return error;
  }
}

async function main() {
  console.log(`Acceptance API: ${baseUrl}`);

  const healthResponse = await fetch(`${baseUrl}/health`, {
    headers: { accept: "application/json" },
  });
  assert.equal(
    healthResponse.status,
    200,
    `Health HTTP ${healthResponse.status}`,
  );
  const health = await healthResponse.json();
  assert.equal(health.ok, true);
  console.log("✓ health + database");

  const keyResponse = await fetch(`${baseUrl}/crypto/server-key`, {
    headers: { accept: "application/json" },
  });
  assert.equal(
    keyResponse.status,
    200,
    `Server key HTTP ${keyResponse.status}`,
  );
  const descriptor = await keyResponse.json();
  assert.equal(descriptor.algorithm, "RSA-OAEP-256");
  assert.equal(descriptor.contentEncryption, "A256GCM");
  assert.equal(typeof descriptor.fingerprintSha256, "string");
  assert.ok(descriptor.fingerprintSha256.length >= 40);
  assert.deepEqual(descriptor.supportedVersions, [
    SECURE_ENVELOPE_VERSION,
    SECURE_JWE_VERSION,
  ]);
  assert.equal(descriptor.signatureAlgorithm, "PS256");
  assert.equal(descriptor.signingPublicKey.kty, "RSA");
  assert.equal(typeof descriptor.signingFingerprintSha256, "string");
  for (const privateField of ["d", "p", "q", "dp", "dq", "qi"]) {
    assert.equal(descriptor.signingPublicKey[privateField], undefined);
  }
  console.log("✓ encryption + signing key descriptor");

  const guestJar = new CookieJar();
  const guest = clientWithJar(guestJar);
  const catalog = await guest.request("/catalog/search", {
    page: 1,
    pageSize: 4,
    sort: "popular",
  });
  assert.ok(
    Array.isArray(catalog.items) && catalog.items.length > 0,
    "Catalog seed trống.",
  );
  const product = catalog.items[0];
  const detail = await guest.request("/catalog/detail", { slug: product.slug });
  assert.ok(
    Array.isArray(detail.variants) && detail.variants.length > 0,
    "Sản phẩm không có variant.",
  );
  const variant = detail.variants.find(
    (item) => item.availableStock > 0 && item.active,
  );
  assert.ok(variant, "Không có variant còn hàng để quote.");
  const quote = await guest.request("/checkout/quote", {
    items: [{ variantId: variant.id, quantity: 1 }],
  });
  assert.ok(Number.isSafeInteger(quote.subtotal) && quote.subtotal > 0);
  assert.ok(
    Number.isSafeInteger(quote.total) &&
      quote.total >= quote.subtotal - quote.discount,
  );
  console.log("✓ JWE v2 catalog/detail/checkout quote + signed responses");

  const legacyCatalog = await clientWithJar(
    new CookieJar(),
    SECURE_ENVELOPE_VERSION,
  ).request("/catalog/search", { page: 1, pageSize: 1, sort: "popular" });
  assert.equal(legacyCatalog.items.length, 1);
  console.log(
    "✓ legacy envelope v1 vẫn tương thích trong giai đoạn chuyển đổi",
  );

  const customerJar = new CookieJar();
  const customer = clientWithJar(customerJar);
  const login = await customer.request("/auth/login", {
    email:
      process.env.ACCEPTANCE_CUSTOMER_EMAIL ?? "customer@securecommerce.local",
    password: process.env.ACCEPTANCE_CUSTOMER_PASSWORD ?? "Customer@12345",
  });
  assert.equal(login.user.role, "CUSTOMER");
  assert.ok(customerJar.get("access_token"));
  assert.ok(customerJar.get("csrf_token"));
  const firstRefreshToken = customerJar.get("refresh_token");
  const firstCsrfToken = customerJar.get("csrf_token");
  assert.ok(firstRefreshToken, "Login không cấp refresh token.");
  assert.ok(firstCsrfToken, "Login không cấp CSRF token.");
  const me = await customer.request("/auth/me", {});
  assert.equal(me.user.email, login.user.email);
  await customer.request("/auth/refresh", {});
  const rotatedRefreshToken = customerJar.get("refresh_token");
  assert.ok(rotatedRefreshToken, "Refresh không cấp token mới.");
  assert.notEqual(
    rotatedRefreshToken,
    firstRefreshToken,
    "Refresh token không được rotate.",
  );

  const staleJar = new CookieJar()
    .set("refresh_token", firstRefreshToken)
    .set("csrf_token", firstCsrfToken);
  await expectSecureError(
    clientWithJar(staleJar).request("/auth/refresh", {}),
    401,
  );

  const noCsrfJar = new CookieJar().set("refresh_token", rotatedRefreshToken);
  await expectSecureError(
    clientWithJar(noCsrfJar).request("/auth/refresh", {}),
    403,
  );
  const forbidden = await expectSecureError(
    customer.request("/admin/dashboard", { days: 30 }),
    403,
  );
  assert.notEqual(
    forbidden.payload?.code,
    "CSRF_INVALID",
    "Test RBAC bị chặn bởi CSRF thay vì role guard.",
  );
  console.log(
    "✓ auth cookies/session + refresh rotation/CSRF + customer RBAC denial",
  );

  const adminJar = new CookieJar();
  const admin = clientWithJar(adminJar);
  const adminLogin = await admin.request("/auth/login", {
    email: process.env.ACCEPTANCE_ADMIN_EMAIL ?? "admin@securecommerce.local",
    password: process.env.ACCEPTANCE_ADMIN_PASSWORD ?? "Admin@12345",
  });
  assert.equal(adminLogin.user.role, "ADMIN");
  const dashboard = await admin.request("/admin/dashboard", { days: 30 });
  assert.ok(Number.isSafeInteger(dashboard.orderCount));
  assert.ok(Array.isArray(dashboard.ordersByStatus));
  console.log("✓ admin RBAC + dashboard");

  if (allowWrite) {
    const email = `acceptance-${Date.now()}@example.test`;
    const idempotencyKey = `acceptance:${randomUUID()}`;
    const input = {
      items: [{ variantId: variant.id, quantity: 1 }],
      shippingAddress: {
        fullName: "Acceptance Test",
        phone: "0900000000",
        email,
        line1: "1 Test Street",
        district: "Quận 1",
        province: "TP. Hồ Chí Minh",
        country: "VN",
      },
      paymentMethod: "COD",
      guestSessionId: randomUUID(),
    };
    const first = await guest.request("/checkout/place-order", input, {
      headers: { "idempotency-key": idempotencyKey },
    });
    const retry = await guest.request("/checkout/place-order", input, {
      headers: { "idempotency-key": idempotencyKey },
    });
    assert.equal(
      retry.orderId,
      first.orderId,
      "Idempotent retry tạo order khác.",
    );
    const tracked = await guest.request("/orders/track", {
      orderNo: first.orderNo,
      email,
    });
    assert.equal(tracked.orderNo, first.orderNo);
    console.log(
      `✓ write acceptance + idempotency + guest tracking (${first.orderNo})`,
    );
  } else {
    console.log(
      "• bỏ qua write acceptance; bật ACCEPTANCE_WRITE=1 để tạo một đơn COD demo",
    );
  }

  console.log("Acceptance API hoàn tất.");
}

main().catch((error) => {
  console.error("Acceptance API thất bại.");
  if (error instanceof SecureApiError) {
    console.error(`HTTP ${error.status}`, error.payload);
  } else {
    console.error(error);
  }
  process.exitCode = 1;
});

import assert from "node:assert/strict";
import test from "node:test";
import { ConflictException, ForbiddenException } from "@nestjs/common";
import { CsrfGuard } from "../apps/api/dist/common/guards/csrf.guard.js";
import { validateEnvironment } from "../apps/api/dist/config/environment.js";
import { ReplayCacheService } from "../apps/api/dist/infrastructure/crypto-envelope/replay-cache.service.js";

function config(values = {}) {
  return {
    get(name, fallback) {
      return values[name] ?? fallback;
    },
  };
}

function httpContext(request) {
  return {
    switchToHttp() {
      return { getRequest: () => request };
    },
  };
}

test("replay cache từ chối nonce được dùng lại trong TTL", () => {
  const cache = new ReplayCacheService(
    config({ CRYPTO_REPLAY_TTL_MS: "1000" }),
  );
  cache.consume("client-a", "nonce-a", 1_000);
  assert.throws(
    () => cache.consume("client-a", "nonce-a", 1_999),
    (error) =>
      error instanceof ConflictException &&
      error.getResponse().code === "REPLAY_DETECTED",
  );
});

test("replay cache cho phép nonce hết hạn và giữ đúng thứ tự prune", () => {
  const cache = new ReplayCacheService(config({ CRYPTO_REPLAY_TTL_MS: "10" }));
  cache.consume("client-a", "nonce-a", 0);
  cache.consume("client-b", "nonce-b", 5);
  cache.consume("client-a", "nonce-a", 11);
  cache.consume("client-c", "nonce-c", 16);

  assert.equal(cache.entries.size, 2);
  assert.equal(cache.entries.has("client-b:nonce-b"), false);
});

test("CSRF bỏ qua request guest không có session cookie", () => {
  const guard = new CsrfGuard();
  const allowed = guard.canActivate(
    httpContext({ cookies: {}, header: () => undefined }),
  );
  assert.equal(allowed, true);
});

test("CSRF bảo vệ refresh cookie kể cả khi access cookie đã hết hạn", () => {
  const guard = new CsrfGuard();
  assert.throws(
    () =>
      guard.canActivate(
        httpContext({
          cookies: {
            refresh_token: "session.secret",
            csrf_token: "csrf-value",
          },
          header: () => undefined,
        }),
      ),
    (error) =>
      error instanceof ForbiddenException &&
      error.getResponse().code === "CSRF_INVALID",
  );

  const allowed = guard.canActivate(
    httpContext({
      cookies: { refresh_token: "session.secret", csrf_token: "csrf-value" },
      header: (name) => (name === "x-csrf-token" ? "csrf-value" : undefined),
    }),
  );
  assert.equal(allowed, true);
});

const validProductionEnvironment = {
  NODE_ENV: "production",
  DATABASE_URL: "postgresql://app:a-real-password@db:5432/commerce",
  JWT_ACCESS_SECRET: "8cxGyxcPgq6ZD3tHweQnBfYMTGchRr8Aq6zV5Hk92xM",
  WEB_ORIGIN: "https://shop.example.com",
  COOKIE_SECURE: "true",
  CRYPTO_KEY_ID: "rsa-2026-08",
  CRYPTO_PRIVATE_KEY_PATH: "/run/secrets/server-private.pem",
  CRYPTO_PUBLIC_KEY_PATH: "/run/secrets/server-public.pem",
  CRYPTO_SIGNING_KEY_ID: "signing-2026-08",
  CRYPTO_SIGNING_PRIVATE_KEY_PATH: "/run/secrets/server-signing-private.pem",
  CRYPTO_SIGNING_PUBLIC_KEY_PATH: "/run/secrets/server-signing-public.pem",
  CRYPTO_AUTO_GENERATE: "false",
};

test("production từ chối secret mẫu dù đủ dài", () => {
  assert.throws(
    () =>
      validateEnvironment({
        ...validProductionEnvironment,
        JWT_ACCESS_SECRET: "replace-with-at-least-32-random-bytes",
      }),
    /không phải giá trị mẫu/u,
  );
});

test("production từ chối tự sinh khóa và origin không phải HTTPS", () => {
  assert.throws(
    () =>
      validateEnvironment({
        ...validProductionEnvironment,
        CRYPTO_AUTO_GENERATE: "true",
      }),
    /CRYPTO_AUTO_GENERATE=false/u,
  );
  assert.throws(
    () =>
      validateEnvironment({
        ...validProductionEnvironment,
        WEB_ORIGIN: "http://shop.example.com",
      }),
    /HTTPS origin chính xác/u,
  );
});

test("production chấp nhận cấu hình tối thiểu đã harden", () => {
  assert.doesNotThrow(() => validateEnvironment(validProductionEnvironment));
});

test("production bắt buộc signing key riêng cho JWE v2", () => {
  const withoutSigningKey = { ...validProductionEnvironment };
  delete withoutSigningKey.CRYPTO_SIGNING_PRIVATE_KEY_PATH;
  assert.throws(
    () => validateEnvironment(withoutSigningKey),
    /CRYPTO_SIGNING_PRIVATE_KEY_PATH/u,
  );
  assert.throws(
    () =>
      validateEnvironment({
        ...validProductionEnvironment,
        CRYPTO_SIGNING_KEY_ID: validProductionEnvironment.CRYPTO_KEY_ID,
      }),
    /key ID riêng/u,
  );
});

test("cấu hình crypto từ chối số không hợp lệ và replay TTL quá ngắn", () => {
  assert.throws(
    () =>
      validateEnvironment({
        NODE_ENV: "development",
        DATABASE_URL: "postgresql://local:test@localhost:5432/test",
        JWT_ACCESS_SECRET: "development-only",
        CRYPTO_MAX_CLOCK_SKEW_MS: "NaN",
      }),
    /CRYPTO_MAX_CLOCK_SKEW_MS/u,
  );
  assert.throws(
    () =>
      validateEnvironment({
        NODE_ENV: "development",
        DATABASE_URL: "postgresql://local:test@localhost:5432/test",
        JWT_ACCESS_SECRET: "development-only",
        CRYPTO_MAX_CLOCK_SKEW_MS: "120000",
        CRYPTO_REPLAY_TTL_MS: "239999",
      }),
    /gấp đôi clock skew/u,
  );
});

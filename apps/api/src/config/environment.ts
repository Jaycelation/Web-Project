export function validateEnvironment(
  environment: NodeJS.ProcessEnv = process.env,
): void {
  const production = environment.NODE_ENV === "production";
  const required = [
    "DATABASE_URL",
    "JWT_ACCESS_SECRET",
    ...(production
      ? [
          "WEB_ORIGIN",
          "CRYPTO_KEY_ID",
          "CRYPTO_PRIVATE_KEY_PATH",
          "CRYPTO_PUBLIC_KEY_PATH",
          "CRYPTO_SIGNING_KEY_ID",
          "CRYPTO_SIGNING_PRIVATE_KEY_PATH",
          "CRYPTO_SIGNING_PUBLIC_KEY_PATH",
        ]
      : []),
  ];
  const missing = required.filter((name) => !environment[name]?.trim());
  if (missing.length)
    throw new Error(`Thiếu biến môi trường: ${missing.join(", ")}`);

  const port = Number(environment.API_PORT ?? "4000");
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("API_PORT phải là số nguyên từ 1 đến 65535.");
  }

  const maxClockSkewMs = Number(
    environment.CRYPTO_MAX_CLOCK_SKEW_MS ?? "120000",
  );
  const replayTtlMs = Number(environment.CRYPTO_REPLAY_TTL_MS ?? "300000");
  const rsaBits = Number(environment.CRYPTO_RSA_BITS ?? "3072");
  if (!Number.isSafeInteger(maxClockSkewMs) || maxClockSkewMs <= 0) {
    throw new Error("CRYPTO_MAX_CLOCK_SKEW_MS phải là số nguyên dương.");
  }
  if (!Number.isSafeInteger(replayTtlMs) || replayTtlMs < maxClockSkewMs * 2) {
    throw new Error(
      "CRYPTO_REPLAY_TTL_MS phải là số nguyên và ít nhất gấp đôi clock skew.",
    );
  }
  if (!Number.isSafeInteger(rsaBits) || rsaBits < 2_048 || rsaBits > 8_192) {
    throw new Error("CRYPTO_RSA_BITS phải là số nguyên từ 2048 đến 8192.");
  }
  if (
    environment.CRYPTO_ACCEPT_V1 !== undefined &&
    !["true", "false"].includes(environment.CRYPTO_ACCEPT_V1)
  ) {
    throw new Error("CRYPTO_ACCEPT_V1 chỉ nhận true hoặc false.");
  }

  const encryptionKeyId = environment.CRYPTO_KEY_ID ?? "dev-rsa-2026-01";
  const signingKeyId =
    environment.CRYPTO_SIGNING_KEY_ID ?? "dev-signing-rsa-2026-01";
  if (encryptionKeyId === signingKeyId) {
    throw new Error("Encryption key và signing key phải có key ID riêng.");
  }

  if (!production) return;

  const jwtSecret = environment.JWT_ACCESS_SECRET ?? "";
  const insecureJwtSecrets = new Set([
    "replace-with-at-least-32-random-bytes",
    "dev-only-replace-this-secret-before-production",
  ]);
  if (
    jwtSecret.length < 32 ||
    jwtSecret.trim() !== jwtSecret ||
    insecureJwtSecrets.has(jwtSecret)
  ) {
    throw new Error(
      "JWT_ACCESS_SECRET production phải là secret ngẫu nhiên, không phải giá trị mẫu, và có ít nhất 32 ký tự.",
    );
  }
  if (environment.COOKIE_SECURE !== "true") {
    throw new Error("Production yêu cầu COOKIE_SECURE=true.");
  }
  if (environment.CRYPTO_AUTO_GENERATE !== "false") {
    throw new Error("Production yêu cầu CRYPTO_AUTO_GENERATE=false.");
  }
  if (
    environment.CRYPTO_PRIVATE_KEY_PATH ===
      environment.CRYPTO_SIGNING_PRIVATE_KEY_PATH ||
    environment.CRYPTO_PUBLIC_KEY_PATH ===
      environment.CRYPTO_SIGNING_PUBLIC_KEY_PATH
  ) {
    throw new Error("Encryption key và signing key phải dùng file riêng.");
  }
  if (
    /change-me-in-production|secure_commerce_dev/u.test(
      environment.DATABASE_URL ?? "",
    )
  ) {
    throw new Error("DATABASE_URL production vẫn chứa credential mẫu.");
  }

  const origins = (environment.WEB_ORIGIN ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (!origins.length)
    throw new Error("WEB_ORIGIN production phải có ít nhất một origin.");
  for (const origin of origins) {
    let parsed: URL;
    try {
      parsed = new URL(origin);
    } catch {
      throw new Error(`WEB_ORIGIN không hợp lệ: ${origin}`);
    }
    if (parsed.protocol !== "https:" || parsed.origin !== origin) {
      throw new Error(
        `WEB_ORIGIN production phải là HTTPS origin chính xác, không có path hoặc dấu / cuối: ${origin}`,
      );
    }
  }
}

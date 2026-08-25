import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import {
  base64UrlToBytes,
  bytesToBase64Url,
  decryptRequestEnvelope,
  decryptJweRequest,
  decryptJweResponse,
  decryptResponseEnvelope,
  encryptJweRequest,
  encryptJweResponse,
  encryptRequestEnvelope,
  encryptResponseEnvelope,
  exportRsaPublicJwk,
  exportRsaSigningPublicJwk,
  fingerprintPublicKey,
  generateClientKeyMaterial,
  importRsaPrivateKeyPem,
  importRsaPublicJwk,
  importRsaPublicKeyPem,
  importRsaSigningPrivateKeyPem,
  importRsaSigningPublicKeyPem,
  readUnverifiedJweProtectedHeader,
  SecureApiClient,
  SecureEnvelopeError,
} from "../packages/crypto-envelope/dist/index.js";
import {
  DomainError,
  assertOrderTransition,
  canTransitionOrder,
  priceOrder,
} from "../packages/domain/dist/index.js";

async function serverKeys() {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicExponent: 0x10001,
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
    publicKeyEncoding: { type: "spki", format: "pem" },
  });
  const privateCryptoKey = await importRsaPrivateKeyPem(privateKey);
  const publicCryptoKey = await importRsaPublicKeyPem(publicKey);
  const publicJwk = await exportRsaPublicJwk(publicCryptoKey);
  const keyId = await fingerprintPublicKey(publicCryptoKey);
  return { privateCryptoKey, publicCryptoKey, publicJwk, keyId };
}

async function signingKeys() {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicExponent: 0x10001,
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
    publicKeyEncoding: { type: "spki", format: "pem" },
  });
  return {
    privateCryptoKey: await importRsaSigningPrivateKeyPem(privateKey),
    publicCryptoKey: await importRsaSigningPublicKeyPem(publicKey),
    keyId: `sig-${crypto.randomUUID()}`,
  };
}

test("hybrid envelope round-trip request và response", async () => {
  const server = await serverKeys();
  const client = await generateClientKeyMaterial(2048);
  const request = await encryptRequestEnvelope({
    serverPublicKey: server.publicCryptoKey,
    serverKeyId: server.keyId,
    clientPublicKey: client.publicJwk,
    clientKeyId: client.keyId,
    method: "POST",
    path: "/catalog/search",
    body: { query: "tai nghe", page: 1 },
  });

  const decryptedRequest = await decryptRequestEnvelope(
    request,
    server.privateCryptoKey,
  );
  assert.deepEqual(decryptedRequest.body, { query: "tai nghe", page: 1 });

  const clientPublicKey = await importRsaPublicJwk(
    decryptedRequest.aad.clientPublicKey,
  );
  const response = await encryptResponseEnvelope({
    clientPublicKey,
    serverKeyId: server.keyId,
    requestId: decryptedRequest.aad.requestId,
    requestNonce: decryptedRequest.aad.nonce,
    statusCode: 200,
    body: { items: [{ id: "p1" }], total: 1 },
  });
  const decryptedResponse = await decryptResponseEnvelope(
    response,
    client.privateKey,
  );
  assert.deepEqual(decryptedResponse.body, { items: [{ id: "p1" }], total: 1 });
  assert.equal(decryptedResponse.aad.requestId, request.aad.requestId);
  assert.equal(decryptedResponse.aad.requestNonce, request.aad.nonce);
});

test("JWE v2 dùng Flattened JSON chuẩn và response JWS ký trước khi mã hóa", async () => {
  const server = await serverKeys();
  const signing = await signingKeys();
  const client = await generateClientKeyMaterial(2048);
  const encryptedRequest = await encryptJweRequest({
    serverPublicKey: server.publicCryptoKey,
    serverKeyId: server.keyId,
    clientPublicKey: client.publicJwk,
    clientKeyId: client.keyId,
    method: "POST",
    path: "/catalog/search",
    body: { query: "tai nghe", page: 1 },
  });

  assert.deepEqual(Object.keys(encryptedRequest.envelope).sort(), [
    "ciphertext",
    "encrypted_key",
    "iv",
    "protected",
    "tag",
  ]);
  assert.deepEqual(
    readUnverifiedJweProtectedHeader(encryptedRequest.envelope),
    {
      alg: "RSA-OAEP-256",
      enc: "A256GCM",
      kid: server.keyId,
      typ: "application/mira-api-request+jwe",
      cty: "application/json",
    },
  );

  const decryptedRequest = await decryptJweRequest(
    encryptedRequest.envelope,
    server.privateCryptoKey,
    server.keyId,
  );
  assert.deepEqual(decryptedRequest.body, { query: "tai nghe", page: 1 });
  const clientPublicKey = await importRsaPublicJwk(
    decryptedRequest.metadata.clientPublicKey,
  );
  const encryptedResponse = await encryptJweResponse({
    clientPublicKey,
    clientKeyId: client.keyId,
    serverKeyId: server.keyId,
    signingPrivateKey: signing.privateCryptoKey,
    signingKeyId: signing.keyId,
    requestId: decryptedRequest.metadata.requestId,
    requestNonce: decryptedRequest.metadata.nonce,
    statusCode: 200,
    body: { items: [{ id: "p1" }], total: 1 },
  });
  const decryptedResponse = await decryptJweResponse(encryptedResponse, {
    clientPrivateKey: client.privateKey,
    clientKeyId: client.keyId,
    signingPublicKey: signing.publicCryptoKey,
    signingKeyId: signing.keyId,
    serverKeyId: server.keyId,
  });
  assert.deepEqual(decryptedResponse.body, { items: [{ id: "p1" }], total: 1 });
  assert.equal(
    decryptedResponse.metadata.requestId,
    decryptedRequest.metadata.requestId,
  );
  assert.equal(
    decryptedResponse.metadata.requestNonce,
    decryptedRequest.metadata.nonce,
  );
});

test("JWE v2 từ chối mọi thành phần wire bị sửa", async (t) => {
  const server = await serverKeys();
  const client = await generateClientKeyMaterial(2048);
  const encrypted = await encryptJweRequest({
    serverPublicKey: server.publicCryptoKey,
    serverKeyId: server.keyId,
    clientPublicKey: client.publicJwk,
    clientKeyId: client.keyId,
    method: "POST",
    path: "/checkout/place-order",
    body: { lines: [{ variantId: "v1", quantity: 1 }] },
  });

  for (const field of [
    "protected",
    "encrypted_key",
    "iv",
    "ciphertext",
    "tag",
  ]) {
    await t.test(field, async () => {
      const tampered = structuredClone(encrypted.envelope);
      const value = tampered[field];
      tampered[field] = `${value.startsWith("A") ? "B" : "A"}${value.slice(1)}`;
      await assert.rejects(
        () =>
          decryptJweRequest(tampered, server.privateCryptoKey, server.keyId),
        (error) => error instanceof SecureEnvelopeError,
      );
    });
  }
});

test("JWS v2 chặn response do bên chỉ biết public key client giả mạo", async () => {
  const server = await serverKeys();
  const trustedSigning = await signingKeys();
  const rogueSigning = await signingKeys();
  const client = await generateClientKeyMaterial(2048);
  const forged = await encryptJweResponse({
    clientPublicKey: client.publicKey,
    clientKeyId: client.keyId,
    serverKeyId: server.keyId,
    signingPrivateKey: rogueSigning.privateCryptoKey,
    signingKeyId: trustedSigning.keyId,
    requestId: crypto.randomUUID(),
    requestNonce: "0123456789abcdef",
    statusCode: 200,
    body: { admin: true },
  });

  await assert.rejects(
    () =>
      decryptJweResponse(forged, {
        clientPrivateKey: client.privateKey,
        clientKeyId: client.keyId,
        signingPublicKey: trustedSigning.publicCryptoKey,
        signingKeyId: trustedSigning.keyId,
        serverKeyId: server.keyId,
      }),
    (error) =>
      error instanceof SecureEnvelopeError &&
      error.code === "JWS_RESPONSE_VERIFY_FAILED",
  );
});

test("SecureApiClient v2 từ chối response đã ký nhưng bind sai request", async () => {
  const server = await serverKeys();
  const signing = await signingKeys();
  const descriptor = {
    version: 1,
    keyId: server.keyId,
    publicKey: server.publicJwk,
    fingerprintSha256: server.keyId,
    algorithm: "RSA-OAEP-256",
    contentEncryption: "A256GCM",
    expiresAt: null,
    supportedVersions: [1, 2],
    signingKeyId: signing.keyId,
    signingPublicKey: await exportRsaSigningPublicJwk(signing.publicCryptoKey),
    signingFingerprintSha256: await fingerprintPublicKey(
      signing.publicCryptoKey,
    ),
    signatureAlgorithm: "PS256",
  };

  const client = new SecureApiClient({
    baseUrl: "https://mira.test/api/v1",
    rsaModulusLength: 2048,
    fetchImpl: async (input, init = {}) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith("/crypto/server-key")) {
        return Response.json(descriptor);
      }
      const request = await decryptJweRequest(
        JSON.parse(String(init.body)),
        server.privateCryptoKey,
        server.keyId,
      );
      const clientPublicKey = await importRsaPublicJwk(
        request.metadata.clientPublicKey,
      );
      const response = await encryptJweResponse({
        clientPublicKey,
        clientKeyId: request.metadata.clientKeyId,
        serverKeyId: server.keyId,
        signingPrivateKey: signing.privateCryptoKey,
        signingKeyId: signing.keyId,
        requestId: `${request.metadata.requestId}-wrong`,
        requestNonce: request.metadata.nonce,
        statusCode: 200,
        body: { ok: true },
      });
      return Response.json(response, {
        headers: {
          "content-type": "application/jose+json",
          "x-secure-envelope": "v2",
        },
      });
    },
  });

  await assert.rejects(
    () => client.request("/catalog/search", { page: 1 }),
    (error) =>
      error instanceof SecureEnvelopeError &&
      error.code === "RESPONSE_BINDING_FAILED",
  );
});

test("SecureApiClient v2 không tự downgrade khi server chỉ công bố v1", async () => {
  const server = await serverKeys();
  let businessRequests = 0;
  const client = new SecureApiClient({
    baseUrl: "https://legacy.test/api/v1",
    rsaModulusLength: 2048,
    fetchImpl: async (input) => {
      const url = new URL(String(input));
      if (!url.pathname.endsWith("/crypto/server-key")) businessRequests += 1;
      return Response.json({
        version: 1,
        keyId: server.keyId,
        publicKey: server.publicJwk,
        fingerprintSha256: server.keyId,
        algorithm: "RSA-OAEP-256",
        contentEncryption: "A256GCM",
        expiresAt: null,
        supportedVersions: [1],
      });
    },
  });

  await assert.rejects(
    () => client.request("/catalog/search", { page: 1 }),
    (error) =>
      error instanceof SecureEnvelopeError &&
      error.code === "SERVER_JWE_V2_UNSUPPORTED",
  );
  assert.equal(businessRequests, 0);
});

test("SecureApiClient gọi native fetch với đúng global receiver", async (t) => {
  const originalFetch = globalThis.fetch;
  let receiver;
  globalThis.fetch = function receiverSensitiveFetch() {
    receiver = this;
    return Promise.resolve(new Response(null, { status: 503 }));
  };
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const client = new SecureApiClient({ baseUrl: "https://mira.test/api/v1" });
  await assert.rejects(
    () => client.refreshServerKey(),
    (error) =>
      error instanceof SecureEnvelopeError &&
      error.code === "SERVER_KEY_FETCH_FAILED",
  );
  assert.equal(receiver, globalThis);
});

test("AES-GCM phát hiện ciphertext bị sửa", async () => {
  const server = await serverKeys();
  const client = await generateClientKeyMaterial(2048);
  const request = await encryptRequestEnvelope({
    serverPublicKey: server.publicCryptoKey,
    serverKeyId: server.keyId,
    clientPublicKey: client.publicJwk,
    clientKeyId: client.keyId,
    method: "POST",
    path: "/checkout",
    body: { totalFromClient: 1 },
  });
  const tampered = base64UrlToBytes(request.ciphertext);
  tampered[Math.floor(tampered.length / 2)] ^= 0x01;
  request.ciphertext = bytesToBase64Url(tampered);
  await assert.rejects(
    () => decryptRequestEnvelope(request, server.privateCryptoKey),
    /giải mã|toàn vẹn/u,
  );
});

test("AAD bị sửa làm envelope không xác thực được", async () => {
  const server = await serverKeys();
  const client = await generateClientKeyMaterial(2048);
  const request = await encryptRequestEnvelope({
    serverPublicKey: server.publicCryptoKey,
    serverKeyId: server.keyId,
    clientPublicKey: client.publicJwk,
    clientKeyId: client.keyId,
    method: "POST",
    path: "/orders/create",
    body: { item: "v1" },
  });
  request.aad.path = "/admin/orders/update";
  await assert.rejects(() =>
    decryptRequestEnvelope(request, server.privateCryptoKey),
  );
});

test("server tính giá từ catalogue tin cậy, bỏ qua giá giả do client chèn", () => {
  const variants = new Map([
    ["v1", { id: "v1", unitPrice: 250_000, availableStock: 5, active: true }],
    ["v2", { id: "v2", unitPrice: 100_000, availableStock: 10, active: true }],
  ]);
  const result = priceOrder({
    requestedLines: [
      { variantId: "v1", quantity: 2, clientPrice: 1 },
      { variantId: "v2", quantity: 1, clientPrice: 1 },
    ],
    variants,
    coupon: { type: "PERCENTAGE", value: 10, maxDiscount: 50_000 },
    baseShippingFee: 30_000,
    freeShippingThreshold: 1_000_000,
  });
  assert.equal(result.subtotal, 600_000);
  assert.equal(result.discount, 50_000);
  assert.equal(result.shippingFee, 30_000);
  assert.equal(result.total, 580_000);
});

test("không cho mua vượt tồn kho", () => {
  const variants = new Map([
    ["v1", { id: "v1", unitPrice: 250_000, availableStock: 1, active: true }],
  ]);
  assert.throws(
    () =>
      priceOrder({
        requestedLines: [{ variantId: "v1", quantity: 2 }],
        variants,
      }),
    (error) =>
      error instanceof DomainError && error.code === "INSUFFICIENT_STOCK",
  );
});

test("state machine đơn hàng chặn chuyển trạng thái trái phép", () => {
  assert.equal(canTransitionOrder("PENDING_CONFIRMATION", "CONFIRMED"), true);
  assert.equal(canTransitionOrder("PENDING_CONFIRMATION", "DELIVERED"), false);
  assert.throws(
    () => assertOrderTransition("PENDING_CONFIRMATION", "DELIVERED"),
    /Không thể chuyển/u,
  );
});

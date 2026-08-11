import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import {
  base64UrlToBytes,
  bytesToBase64Url,
  decryptRequestEnvelope,
  decryptResponseEnvelope,
  encryptRequestEnvelope,
  encryptResponseEnvelope,
  exportRsaPublicJwk,
  fingerprintPublicKey,
  generateClientKeyMaterial,
  importRsaPrivateKeyPem,
  importRsaPublicJwk,
  importRsaPublicKeyPem,
} from '../packages/crypto-envelope/dist/index.js';
import {
  DomainError,
  assertOrderTransition,
  canTransitionOrder,
  priceOrder,
} from '../packages/domain/dist/index.js';

async function serverKeys() {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicExponent: 0x10001,
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  });
  const privateCryptoKey = await importRsaPrivateKeyPem(privateKey);
  const publicCryptoKey = await importRsaPublicKeyPem(publicKey);
  const publicJwk = await exportRsaPublicJwk(publicCryptoKey);
  const keyId = await fingerprintPublicKey(publicCryptoKey);
  return { privateCryptoKey, publicCryptoKey, publicJwk, keyId };
}

test('hybrid envelope round-trip request và response', async () => {
  const server = await serverKeys();
  const client = await generateClientKeyMaterial(2048);
  const request = await encryptRequestEnvelope({
    serverPublicKey: server.publicCryptoKey,
    serverKeyId: server.keyId,
    clientPublicKey: client.publicJwk,
    clientKeyId: client.keyId,
    method: 'POST',
    path: '/catalog/search',
    body: { query: 'tai nghe', page: 1 },
  });

  const decryptedRequest = await decryptRequestEnvelope(request, server.privateCryptoKey);
  assert.deepEqual(decryptedRequest.body, { query: 'tai nghe', page: 1 });

  const clientPublicKey = await importRsaPublicJwk(decryptedRequest.aad.clientPublicKey);
  const response = await encryptResponseEnvelope({
    clientPublicKey,
    serverKeyId: server.keyId,
    requestId: decryptedRequest.aad.requestId,
    requestNonce: decryptedRequest.aad.nonce,
    statusCode: 200,
    body: { items: [{ id: 'p1' }], total: 1 },
  });
  const decryptedResponse = await decryptResponseEnvelope(response, client.privateKey);
  assert.deepEqual(decryptedResponse.body, { items: [{ id: 'p1' }], total: 1 });
  assert.equal(decryptedResponse.aad.requestId, request.aad.requestId);
  assert.equal(decryptedResponse.aad.requestNonce, request.aad.nonce);
});

test('AES-GCM phát hiện ciphertext bị sửa', async () => {
  const server = await serverKeys();
  const client = await generateClientKeyMaterial(2048);
  const request = await encryptRequestEnvelope({
    serverPublicKey: server.publicCryptoKey,
    serverKeyId: server.keyId,
    clientPublicKey: client.publicJwk,
    clientKeyId: client.keyId,
    method: 'POST',
    path: '/checkout',
    body: { totalFromClient: 1 },
  });
  const tampered = base64UrlToBytes(request.ciphertext);
  tampered[Math.floor(tampered.length / 2)] ^= 0x01;
  request.ciphertext = bytesToBase64Url(tampered);
  await assert.rejects(() => decryptRequestEnvelope(request, server.privateCryptoKey), /giải mã|toàn vẹn/u);
});

test('AAD bị sửa làm envelope không xác thực được', async () => {
  const server = await serverKeys();
  const client = await generateClientKeyMaterial(2048);
  const request = await encryptRequestEnvelope({
    serverPublicKey: server.publicCryptoKey,
    serverKeyId: server.keyId,
    clientPublicKey: client.publicJwk,
    clientKeyId: client.keyId,
    method: 'POST',
    path: '/orders/create',
    body: { item: 'v1' },
  });
  request.aad.path = '/admin/orders/update';
  await assert.rejects(() => decryptRequestEnvelope(request, server.privateCryptoKey));
});

test('server tính giá từ catalogue tin cậy, bỏ qua giá giả do client chèn', () => {
  const variants = new Map([
    ['v1', { id: 'v1', unitPrice: 250_000, availableStock: 5, active: true }],
    ['v2', { id: 'v2', unitPrice: 100_000, availableStock: 10, active: true }],
  ]);
  const result = priceOrder({
    requestedLines: [
      { variantId: 'v1', quantity: 2, clientPrice: 1 },
      { variantId: 'v2', quantity: 1, clientPrice: 1 },
    ],
    variants,
    coupon: { type: 'PERCENTAGE', value: 10, maxDiscount: 50_000 },
    baseShippingFee: 30_000,
    freeShippingThreshold: 1_000_000,
  });
  assert.equal(result.subtotal, 600_000);
  assert.equal(result.discount, 50_000);
  assert.equal(result.shippingFee, 30_000);
  assert.equal(result.total, 580_000);
});

test('không cho mua vượt tồn kho', () => {
  const variants = new Map([
    ['v1', { id: 'v1', unitPrice: 250_000, availableStock: 1, active: true }],
  ]);
  assert.throws(
    () => priceOrder({ requestedLines: [{ variantId: 'v1', quantity: 2 }], variants }),
    (error) => error instanceof DomainError && error.code === 'INSUFFICIENT_STOCK',
  );
});

test('state machine đơn hàng chặn chuyển trạng thái trái phép', () => {
  assert.equal(canTransitionOrder('PENDING_CONFIRMATION', 'CONFIRMED'), true);
  assert.equal(canTransitionOrder('PENDING_CONFIRMATION', 'DELIVERED'), false);
  assert.throws(() => assertOrderTransition('PENDING_CONFIRMATION', 'DELIVERED'), /Không thể chuyển/u);
});

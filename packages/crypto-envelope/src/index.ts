import {
  CompactSign,
  FlattenedEncrypt,
  compactVerify,
  decodeProtectedHeader,
  flattenedDecrypt,
  importJWK,
  importPKCS8,
  importSPKI,
} from "jose";
import type {
  FlattenedJWE,
  JWEHeaderParameters,
  JWSHeaderParameters,
} from "jose";

export const SECURE_ENVELOPE_VERSION = 1 as const;
export const SECURE_JWE_VERSION = 2 as const;
export const SECURE_ENVELOPE_HEADER = "x-secure-envelope";
export const SECURE_ENVELOPE_V1_HEADER_VALUE = "v1" as const;
export const SECURE_ENVELOPE_V2_HEADER_VALUE = "v2" as const;
// Legacy alias kept so existing v1 integrations continue to compile.
export const SECURE_ENVELOPE_HEADER_VALUE = SECURE_ENVELOPE_V1_HEADER_VALUE;
export const RSA_ALGORITHM = "RSA-OAEP-256" as const;
export const CONTENT_ENCRYPTION = "A256GCM" as const;
export const RESPONSE_SIGNATURE_ALGORITHM = "PS256" as const;
export const JWE_REQUEST_TYPE = "application/mira-api-request+jwe" as const;
export const JWE_RESPONSE_TYPE = "application/mira-api-response+jwe" as const;
export const JWS_RESPONSE_TYPE = "application/mira-api-response+jws" as const;
export const AES_GCM_IV_BYTES = 12;
export const AES_GCM_TAG_BITS = 128;

export type SecureEnvelopeProtocol =
  | typeof SECURE_ENVELOPE_V1_HEADER_VALUE
  | typeof SECURE_ENVELOPE_V2_HEADER_VALUE;

export interface RsaPublicJwk {
  kty: "RSA";
  n: string;
  e: string;
  alg?: string;
  ext?: boolean;
  key_ops?: string[];
}

export interface CryptoServerKeyDescriptor {
  version: typeof SECURE_ENVELOPE_VERSION;
  keyId: string;
  publicKey: RsaPublicJwk;
  fingerprintSha256: string;
  algorithm: typeof RSA_ALGORITHM;
  contentEncryption: typeof CONTENT_ENCRYPTION;
  expiresAt: string | null;
  supportedVersions?: Array<
    typeof SECURE_ENVELOPE_VERSION | typeof SECURE_JWE_VERSION
  >;
  signingKeyId?: string;
  signingPublicKey?: RsaPublicJwk;
  signingFingerprintSha256?: string;
  signatureAlgorithm?: typeof RESPONSE_SIGNATURE_ALGORITHM;
}

export type FlattenedJweEnvelope = FlattenedJWE;

export interface JweRequestMetadata {
  version: typeof SECURE_JWE_VERSION;
  direction: "request";
  method: string;
  path: string;
  requestId: string;
  timestamp: number;
  nonce: string;
  clientKeyId: string;
  clientPublicKey: RsaPublicJwk;
  boundHeaders: ProtectedRequestHeaders;
}

export interface ProtectedRequestHeaders {
  csrfToken?: string;
  idempotencyKey?: string;
}

export interface JweResponseMetadata {
  version: typeof SECURE_JWE_VERSION;
  direction: "response";
  requestId: string;
  requestNonce: string;
  timestamp: number;
  statusCode: number;
  serverKeyId: string;
}

export interface JweRequestPayload<TBody> {
  metadata: JweRequestMetadata;
  body: TBody;
}

export interface JweResponsePayload<TBody> {
  metadata: JweResponseMetadata;
  body: TBody;
}

export interface EncryptedJweRequest {
  envelope: FlattenedJweEnvelope;
  metadata: JweRequestMetadata;
}

export interface RequestAad {
  version: typeof SECURE_ENVELOPE_VERSION;
  direction: "request";
  method: string;
  path: string;
  requestId: string;
  timestamp: number;
  nonce: string;
  clientKeyId: string;
  clientPublicKey: RsaPublicJwk;
}

export interface ResponseAad {
  version: typeof SECURE_ENVELOPE_VERSION;
  direction: "response";
  requestId: string;
  requestNonce: string;
  timestamp: number;
  statusCode: number;
  serverKeyId: string;
}

export interface EncryptedEnvelope<TAad extends RequestAad | ResponseAad> {
  version: typeof SECURE_ENVELOPE_VERSION;
  keyId: string;
  algorithm: typeof RSA_ALGORITHM;
  contentEncryption: typeof CONTENT_ENCRYPTION;
  encryptedKey: string;
  iv: string;
  ciphertext: string;
  aad: TAad;
}

export interface ClientKeyMaterial {
  publicKey: CryptoKey;
  privateKey: CryptoKey;
  publicJwk: RsaPublicJwk;
  keyId: string;
}

export interface EncryptRequestOptions<TBody> {
  serverPublicKey: CryptoKey;
  serverKeyId: string;
  clientPublicKey: RsaPublicJwk;
  clientKeyId: string;
  method: string;
  path: string;
  body: TBody;
  requestId?: string;
  timestamp?: number;
  nonce?: string;
}

export interface EncryptResponseOptions<TBody> {
  clientPublicKey: CryptoKey;
  serverKeyId: string;
  requestId: string;
  requestNonce: string;
  statusCode: number;
  body: TBody;
  timestamp?: number;
}

export interface EncryptJweRequestOptions<
  TBody,
> extends EncryptRequestOptions<TBody> {
  boundHeaders?: ProtectedRequestHeaders;
}

export interface EncryptJweResponseOptions<TBody> {
  clientPublicKey: CryptoKey;
  clientKeyId: string;
  serverKeyId: string;
  signingPrivateKey: CryptoKey;
  signingKeyId: string;
  requestId: string;
  requestNonce: string;
  statusCode: number;
  body: TBody;
  timestamp?: number;
}

export interface DecryptJweResponseOptions {
  clientPrivateKey: CryptoKey;
  clientKeyId: string;
  signingPublicKey: CryptoKey;
  signingKeyId: string;
  serverKeyId: string;
}

export interface DecryptedRequest<TBody> {
  body: TBody;
  aad: RequestAad;
}

export interface DecryptedResponse<TBody> {
  body: TBody;
  aad: ResponseAad;
}

export interface DecryptedJweRequest<TBody> {
  body: TBody;
  metadata: JweRequestMetadata;
}

export interface DecryptedJweResponse<TBody> {
  body: TBody;
  metadata: JweResponseMetadata;
}

export class SecureEnvelopeError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly causeValue?: unknown,
  ) {
    super(message);
    this.name = "SecureEnvelopeError";
  }
}

export class SecureApiError<T = unknown> extends Error {
  constructor(
    public readonly status: number,
    public readonly payload: T,
  ) {
    super(extractErrorMessage(payload, `API trả về HTTP ${status}.`));
    this.name = "SecureApiError";
  }
}

function extractErrorMessage(payload: unknown, fallback: string): string {
  if (payload && typeof payload === "object" && "message" in payload) {
    const value = (payload as { message?: unknown }).message;
    if (typeof value === "string") return value;
    if (Array.isArray(value)) return value.map(String).join(", ");
  }
  return fallback;
}

function webCrypto(): Crypto {
  if (!globalThis.crypto?.subtle) {
    throw new SecureEnvelopeError(
      "WEB_CRYPTO_UNAVAILABLE",
      "Môi trường không hỗ trợ Web Crypto API.",
    );
  }
  return globalThis.crypto;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function canonicalizeJson(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new SecureEnvelopeError(
        "NON_FINITE_NUMBER",
        "JSON canonical không chấp nhận NaN hoặc Infinity.",
      );
    }
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalizeJson(item)).join(",")}]`;
  }
  if (typeof value === "object") {
    const object = value as Record<string, unknown>;
    const keys = Object.keys(object)
      .filter((key) => object[key] !== undefined)
      .sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalizeJson(object[key])}`).join(",")}}`;
  }
  throw new SecureEnvelopeError(
    "UNSUPPORTED_JSON_VALUE",
    `Không thể canonicalize kiểu ${typeof value}.`,
  );
}

export function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(
      offset,
      Math.min(offset + chunkSize, bytes.length),
    );
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/u, "");
}

export function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  let binary: string;
  try {
    binary = atob(padded);
  } catch (error) {
    throw new SecureEnvelopeError(
      "INVALID_BASE64URL",
      "Dữ liệu base64url không hợp lệ.",
      error,
    );
  }
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

export function randomBase64Url(byteLength = 18): string {
  const bytes = new Uint8Array(byteLength);
  webCrypto().getRandomValues(bytes);
  return bytesToBase64Url(bytes);
}

export function normalizeApiPath(path: string): string {
  const withoutQuery = path.split("?")[0] ?? path;
  if (!withoutQuery.startsWith("/")) return `/${withoutQuery}`;
  return withoutQuery;
}

export async function sha256Base64Url(
  input: string | Uint8Array,
): Promise<string> {
  // TypeScript 5.9 distinguishes ArrayBuffer-backed views from views that may
  // reference SharedArrayBuffer. Web Crypto only accepts the former, so copy
  // caller-owned bytes into an ArrayBuffer-backed view before hashing.
  const bytes =
    typeof input === "string" ? encoder.encode(input) : arrayBufferBytes(input);
  const digest = await webCrypto().subtle.digest("SHA-256", bytes);
  return bytesToBase64Url(new Uint8Array(digest));
}

function arrayBufferBytes(input: Uint8Array): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(input.byteLength);
  bytes.set(input);
  return bytes;
}

export async function generateClientKeyMaterial(
  modulusLength = 3072,
): Promise<ClientKeyMaterial> {
  if (
    !Number.isInteger(modulusLength) ||
    modulusLength < 2_048 ||
    modulusLength > 8_192
  ) {
    throw new SecureEnvelopeError(
      "CLIENT_RSA_KEY_SIZE_INVALID",
      "Client RSA key phải là số nguyên từ 2048 đến 8192 bit.",
    );
  }
  const pair = (await webCrypto().subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["encrypt", "decrypt"],
  )) as CryptoKeyPair;

  const publicJwk = toRsaPublicJwk(
    await webCrypto().subtle.exportKey("jwk", pair.publicKey),
  );
  const keyId = await fingerprintPublicKey(pair.publicKey);
  return {
    publicKey: pair.publicKey,
    privateKey: pair.privateKey,
    publicJwk,
    keyId,
  };
}

export async function importRsaPublicJwk(
  jwk: RsaPublicJwk,
): Promise<CryptoKey> {
  return webCrypto().subtle.importKey(
    "jwk",
    { ...jwk, alg: "RSA-OAEP-256", ext: true, key_ops: ["encrypt"] },
    { name: "RSA-OAEP", hash: "SHA-256" },
    true,
    ["encrypt"],
  );
}

export async function importRsaPrivateKeyPem(pem: string): Promise<CryptoKey> {
  const bytes = pemToDer(pem, "PRIVATE KEY");
  return webCrypto().subtle.importKey(
    "pkcs8",
    bytes,
    { name: "RSA-OAEP", hash: "SHA-256" },
    false,
    ["decrypt"],
  );
}

export async function importRsaPublicKeyPem(pem: string): Promise<CryptoKey> {
  const bytes = pemToDer(pem, "PUBLIC KEY");
  return webCrypto().subtle.importKey(
    "spki",
    bytes,
    { name: "RSA-OAEP", hash: "SHA-256" },
    true,
    ["encrypt"],
  );
}

export async function importRsaSigningPrivateKeyPem(
  pem: string,
): Promise<CryptoKey> {
  try {
    return await importPKCS8(pem, RESPONSE_SIGNATURE_ALGORITHM);
  } catch (error) {
    throw new SecureEnvelopeError(
      "INVALID_SIGNING_PRIVATE_KEY",
      "Private key ký response không hợp lệ.",
      error,
    );
  }
}

export async function importRsaSigningPublicKeyPem(
  pem: string,
): Promise<CryptoKey> {
  try {
    return await importSPKI(pem, RESPONSE_SIGNATURE_ALGORITHM);
  } catch (error) {
    throw new SecureEnvelopeError(
      "INVALID_SIGNING_PUBLIC_KEY",
      "Public key xác minh response không hợp lệ.",
      error,
    );
  }
}

export async function importRsaSigningPublicJwk(
  jwk: RsaPublicJwk,
): Promise<CryptoKey> {
  try {
    return await importJWK(
      {
        ...jwk,
        alg: RESPONSE_SIGNATURE_ALGORITHM,
        ext: true,
        key_ops: ["verify"],
      },
      RESPONSE_SIGNATURE_ALGORITHM,
    );
  } catch (error) {
    throw new SecureEnvelopeError(
      "INVALID_SIGNING_JWK",
      "JWK ký response không hợp lệ.",
      error,
    );
  }
}

export async function exportRsaPublicJwk(
  key: CryptoKey,
): Promise<RsaPublicJwk> {
  return toRsaPublicJwk(await webCrypto().subtle.exportKey("jwk", key));
}

export async function exportRsaSigningPublicJwk(
  key: CryptoKey,
): Promise<RsaPublicJwk> {
  const jwk = toRsaPublicJwk(await webCrypto().subtle.exportKey("jwk", key));
  return {
    ...jwk,
    alg: RESPONSE_SIGNATURE_ALGORITHM,
    ext: true,
    key_ops: ["verify"],
  };
}

export async function fingerprintPublicKey(key: CryptoKey): Promise<string> {
  const spki = await webCrypto().subtle.exportKey("spki", key);
  const digest = await webCrypto().subtle.digest("SHA-256", spki);
  return bytesToBase64Url(new Uint8Array(digest));
}

export async function assertRsaEncryptionKeyPair(
  publicKey: CryptoKey,
  privateKey: CryptoKey,
): Promise<void> {
  const challenge = new Uint8Array(32);
  webCrypto().getRandomValues(challenge);
  try {
    const encrypted = await webCrypto().subtle.encrypt(
      { name: "RSA-OAEP" },
      publicKey,
      challenge,
    );
    const decrypted = new Uint8Array(
      await webCrypto().subtle.decrypt(
        { name: "RSA-OAEP" },
        privateKey,
        encrypted,
      ),
    );
    if (!constantTimeEqual(challenge, decrypted))
      throw new Error("RSA OAEP key pair mismatch");
  } catch (error) {
    throw new SecureEnvelopeError(
      "ENCRYPTION_KEY_PAIR_MISMATCH",
      "Encryption key pair không khớp.",
      error,
    );
  }
}

export async function assertRsaSigningKeyPair(
  privateKey: CryptoKey,
  publicKey: CryptoKey,
): Promise<void> {
  const challenge = new Uint8Array(32);
  webCrypto().getRandomValues(challenge);
  try {
    const compact = await new CompactSign(challenge)
      .setProtectedHeader({ alg: RESPONSE_SIGNATURE_ALGORITHM })
      .sign(privateKey);
    const verified = await compactVerify(compact, publicKey, {
      algorithms: [RESPONSE_SIGNATURE_ALGORITHM],
    });
    if (!constantTimeEqual(challenge, verified.payload))
      throw new Error("RSA PSS key pair mismatch");
  } catch (error) {
    throw new SecureEnvelopeError(
      "SIGNING_KEY_PAIR_MISMATCH",
      "Signing key pair không khớp.",
      error,
    );
  }
}

export async function encryptRequestEnvelope<TBody>(
  options: EncryptRequestOptions<TBody>,
): Promise<EncryptedEnvelope<RequestAad>> {
  const aad: RequestAad = {
    version: SECURE_ENVELOPE_VERSION,
    direction: "request",
    method: options.method.toUpperCase(),
    path: normalizeApiPath(options.path),
    requestId: options.requestId ?? webCrypto().randomUUID(),
    timestamp: options.timestamp ?? Date.now(),
    nonce: options.nonce ?? randomBase64Url(18),
    clientKeyId: options.clientKeyId,
    clientPublicKey: options.clientPublicKey,
  };

  return encryptEnvelope({
    recipientPublicKey: options.serverPublicKey,
    recipientKeyId: options.serverKeyId,
    aad,
    body: options.body,
  });
}

export async function decryptRequestEnvelope<TBody>(
  envelope: EncryptedEnvelope<RequestAad>,
  serverPrivateKey: CryptoKey,
): Promise<DecryptedRequest<TBody>> {
  assertEnvelopeMetadata(envelope);
  if (envelope.aad.direction !== "request") {
    throw new SecureEnvelopeError(
      "INVALID_DIRECTION",
      "Envelope không phải request.",
    );
  }
  const body = await decryptEnvelope<TBody, RequestAad>(
    envelope,
    serverPrivateKey,
  );
  return { body, aad: envelope.aad };
}

export async function encryptResponseEnvelope<TBody>(
  options: EncryptResponseOptions<TBody>,
): Promise<EncryptedEnvelope<ResponseAad>> {
  const aad: ResponseAad = {
    version: SECURE_ENVELOPE_VERSION,
    direction: "response",
    requestId: options.requestId,
    requestNonce: options.requestNonce,
    timestamp: options.timestamp ?? Date.now(),
    statusCode: options.statusCode,
    serverKeyId: options.serverKeyId,
  };

  return encryptEnvelope({
    recipientPublicKey: options.clientPublicKey,
    recipientKeyId: options.serverKeyId,
    aad,
    body: options.body,
  });
}

export async function decryptResponseEnvelope<TBody>(
  envelope: EncryptedEnvelope<ResponseAad>,
  clientPrivateKey: CryptoKey,
): Promise<DecryptedResponse<TBody>> {
  assertEnvelopeMetadata(envelope);
  if (envelope.aad.direction !== "response") {
    throw new SecureEnvelopeError(
      "INVALID_DIRECTION",
      "Envelope không phải response.",
    );
  }
  const body = await decryptEnvelope<TBody, ResponseAad>(
    envelope,
    clientPrivateKey,
  );
  return { body, aad: envelope.aad };
}

export async function encryptJweRequest<TBody>(
  options: EncryptJweRequestOptions<TBody>,
): Promise<EncryptedJweRequest> {
  const metadata: JweRequestMetadata = {
    version: SECURE_JWE_VERSION,
    direction: "request",
    method: options.method.toUpperCase(),
    path: normalizeApiPath(options.path),
    requestId: options.requestId ?? webCrypto().randomUUID(),
    timestamp: options.timestamp ?? Date.now(),
    nonce: options.nonce ?? randomBase64Url(18),
    clientKeyId: options.clientKeyId,
    clientPublicKey: options.clientPublicKey,
    boundHeaders: normalizeProtectedRequestHeaders(options.boundHeaders),
  };
  const payload: JweRequestPayload<TBody> = { metadata, body: options.body };

  try {
    const envelope = await new FlattenedEncrypt(
      encoder.encode(JSON.stringify(payload)),
    )
      .setProtectedHeader({
        alg: RSA_ALGORITHM,
        enc: CONTENT_ENCRYPTION,
        kid: options.serverKeyId,
        typ: JWE_REQUEST_TYPE,
        cty: "application/json",
      })
      .encrypt(options.serverPublicKey);
    return { envelope, metadata };
  } catch (error) {
    throw new SecureEnvelopeError(
      "JWE_ENCRYPT_FAILED",
      "Không thể mã hóa JWE request.",
      error,
    );
  }
}

export async function decryptJweRequest<TBody>(
  envelope: FlattenedJweEnvelope,
  serverPrivateKey: CryptoKey,
  expectedServerKeyId: string,
): Promise<DecryptedJweRequest<TBody>> {
  assertFlattenedJweEnvelope(envelope);
  try {
    const decrypted = await flattenedDecrypt(envelope, serverPrivateKey, {
      keyManagementAlgorithms: [RSA_ALGORITHM],
      contentEncryptionAlgorithms: [CONTENT_ENCRYPTION],
    });
    assertJweProtectedHeader(decrypted.protectedHeader, {
      expectedKeyId: expectedServerKeyId,
      expectedType: JWE_REQUEST_TYPE,
      expectedContentType: "application/json",
    });
    const payload = parseJsonRecord(
      decrypted.plaintext,
      "JWE_REQUEST_PAYLOAD_INVALID",
    );
    assertExactKeys(
      payload,
      ["metadata", "body"],
      "JWE_REQUEST_PAYLOAD_INVALID",
    );
    assertJweRequestMetadata(payload.metadata);
    return {
      body: payload.body as TBody,
      metadata: payload.metadata,
    };
  } catch (error) {
    if (error instanceof SecureEnvelopeError) throw error;
    throw new SecureEnvelopeError(
      "JWE_DECRYPT_FAILED",
      "Không thể giải mã hoặc xác thực JWE request.",
      error,
    );
  }
}

export function readUnverifiedJweProtectedHeader(
  envelope: FlattenedJweEnvelope,
): JWEHeaderParameters {
  assertFlattenedJweEnvelope(envelope);
  try {
    return decodeProtectedHeader(envelope) as JWEHeaderParameters;
  } catch (error) {
    throw new SecureEnvelopeError(
      "JWE_PROTECTED_HEADER_INVALID",
      "Không đọc được protected header JWE.",
      error,
    );
  }
}

export async function encryptJweResponse<TBody>(
  options: EncryptJweResponseOptions<TBody>,
): Promise<FlattenedJweEnvelope> {
  const metadata: JweResponseMetadata = {
    version: SECURE_JWE_VERSION,
    direction: "response",
    requestId: options.requestId,
    requestNonce: options.requestNonce,
    timestamp: options.timestamp ?? Date.now(),
    statusCode: options.statusCode,
    serverKeyId: options.serverKeyId,
  };
  const payload: JweResponsePayload<TBody> = { metadata, body: options.body };

  try {
    const signedResponse = await new CompactSign(
      encoder.encode(JSON.stringify(payload)),
    )
      .setProtectedHeader({
        alg: RESPONSE_SIGNATURE_ALGORITHM,
        kid: options.signingKeyId,
        typ: JWS_RESPONSE_TYPE,
        cty: "application/json",
      })
      .sign(options.signingPrivateKey);

    return await new FlattenedEncrypt(encoder.encode(signedResponse))
      .setProtectedHeader({
        alg: RSA_ALGORITHM,
        enc: CONTENT_ENCRYPTION,
        kid: options.clientKeyId,
        typ: JWE_RESPONSE_TYPE,
        cty: "application/jose",
      })
      .encrypt(options.clientPublicKey);
  } catch (error) {
    throw new SecureEnvelopeError(
      "JWE_RESPONSE_ENCRYPT_FAILED",
      "Không thể ký và mã hóa JWE response.",
      error,
    );
  }
}

export async function decryptJweResponse<TBody>(
  envelope: FlattenedJweEnvelope,
  options: DecryptJweResponseOptions,
): Promise<DecryptedJweResponse<TBody>> {
  assertFlattenedJweEnvelope(envelope);
  let compactJws: string;
  try {
    const decrypted = await flattenedDecrypt(
      envelope,
      options.clientPrivateKey,
      {
        keyManagementAlgorithms: [RSA_ALGORITHM],
        contentEncryptionAlgorithms: [CONTENT_ENCRYPTION],
      },
    );
    assertJweProtectedHeader(decrypted.protectedHeader, {
      expectedKeyId: options.clientKeyId,
      expectedType: JWE_RESPONSE_TYPE,
      expectedContentType: "application/jose",
    });
    compactJws = decoder.decode(decrypted.plaintext);
    if (compactJws.length > 1_500_000 || compactJws.split(".").length !== 3) {
      throw new SecureEnvelopeError(
        "JWS_RESPONSE_MALFORMED",
        "Response không chứa Compact JWS hợp lệ.",
      );
    }
  } catch (error) {
    if (error instanceof SecureEnvelopeError) throw error;
    throw new SecureEnvelopeError(
      "JWE_RESPONSE_DECRYPT_FAILED",
      "Không thể giải mã JWE response.",
      error,
    );
  }

  try {
    const verified = await compactVerify(compactJws, options.signingPublicKey, {
      algorithms: [RESPONSE_SIGNATURE_ALGORITHM],
    });
    assertJwsProtectedHeader(verified.protectedHeader, options.signingKeyId);
    const payload = parseJsonRecord(
      verified.payload,
      "JWS_RESPONSE_PAYLOAD_INVALID",
    );
    assertExactKeys(
      payload,
      ["metadata", "body"],
      "JWS_RESPONSE_PAYLOAD_INVALID",
    );
    assertJweResponseMetadata(payload.metadata);
    if (payload.metadata.serverKeyId !== options.serverKeyId) {
      throw new SecureEnvelopeError(
        "JWS_SERVER_KEY_MISMATCH",
        "Response không khớp encryption key của server.",
      );
    }
    return {
      body: payload.body as TBody,
      metadata: payload.metadata,
    };
  } catch (error) {
    if (error instanceof SecureEnvelopeError) throw error;
    throw new SecureEnvelopeError(
      "JWS_RESPONSE_VERIFY_FAILED",
      "Không thể xác minh chữ ký response.",
      error,
    );
  }
}

async function encryptEnvelope<
  TBody,
  TAad extends RequestAad | ResponseAad,
>(options: {
  recipientPublicKey: CryptoKey;
  recipientKeyId: string;
  aad: TAad;
  body: TBody;
}): Promise<EncryptedEnvelope<TAad>> {
  const crypto = webCrypto();
  const aesKey = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"],
  );
  const rawAesKey = new Uint8Array(
    await crypto.subtle.exportKey("raw", aesKey),
  );
  const encryptedKey = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "RSA-OAEP" },
      options.recipientPublicKey,
      rawAesKey,
    ),
  );
  const iv = new Uint8Array(AES_GCM_IV_BYTES);
  crypto.getRandomValues(iv);
  const additionalData = encoder.encode(canonicalizeJson(options.aad));
  const plaintext = encoder.encode(JSON.stringify(options.body));
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv, additionalData, tagLength: AES_GCM_TAG_BITS },
      aesKey,
      plaintext,
    ),
  );

  return {
    version: SECURE_ENVELOPE_VERSION,
    keyId: options.recipientKeyId,
    algorithm: RSA_ALGORITHM,
    contentEncryption: CONTENT_ENCRYPTION,
    encryptedKey: bytesToBase64Url(encryptedKey),
    iv: bytesToBase64Url(iv),
    ciphertext: bytesToBase64Url(ciphertext),
    aad: options.aad,
  };
}

async function decryptEnvelope<TBody, TAad extends RequestAad | ResponseAad>(
  envelope: EncryptedEnvelope<TAad>,
  recipientPrivateKey: CryptoKey,
): Promise<TBody> {
  const crypto = webCrypto();
  try {
    const rawAesKey = await crypto.subtle.decrypt(
      { name: "RSA-OAEP" },
      recipientPrivateKey,
      base64UrlToBytes(envelope.encryptedKey),
    );
    const aesKey = await crypto.subtle.importKey(
      "raw",
      rawAesKey,
      { name: "AES-GCM", length: 256 },
      false,
      ["decrypt"],
    );
    const plaintext = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: base64UrlToBytes(envelope.iv),
        additionalData: encoder.encode(canonicalizeJson(envelope.aad)),
        tagLength: AES_GCM_TAG_BITS,
      },
      aesKey,
      base64UrlToBytes(envelope.ciphertext),
    );
    return JSON.parse(decoder.decode(plaintext)) as TBody;
  } catch (error) {
    throw new SecureEnvelopeError(
      "ENVELOPE_DECRYPT_FAILED",
      "Không thể giải mã hoặc xác thực tính toàn vẹn của envelope.",
      error,
    );
  }
}

function assertEnvelopeMetadata(
  envelope: EncryptedEnvelope<RequestAad> | EncryptedEnvelope<ResponseAad>,
): void {
  if (
    envelope.version !== SECURE_ENVELOPE_VERSION ||
    envelope.algorithm !== RSA_ALGORITHM ||
    envelope.contentEncryption !== CONTENT_ENCRYPTION
  ) {
    throw new SecureEnvelopeError(
      "UNSUPPORTED_ENVELOPE",
      "Phiên bản hoặc thuật toán envelope không hỗ trợ.",
    );
  }
  if (
    !envelope.keyId ||
    !envelope.encryptedKey ||
    !envelope.iv ||
    !envelope.ciphertext
  ) {
    throw new SecureEnvelopeError(
      "MALFORMED_ENVELOPE",
      "Envelope thiếu trường bắt buộc.",
    );
  }
}

function assertFlattenedJweEnvelope(envelope: FlattenedJweEnvelope): void {
  if (!isRecord(envelope)) {
    throw new SecureEnvelopeError("JWE_MALFORMED", "JWE phải là JSON object.");
  }
  assertExactKeys(
    envelope,
    ["protected", "encrypted_key", "iv", "ciphertext", "tag"],
    "JWE_PROFILE_INVALID",
  );
  assertBase64UrlField(envelope, "protected", 4_096);
  assertBase64UrlField(envelope, "encrypted_key", 2_048);
  assertBase64UrlField(envelope, "iv", 64);
  assertBase64UrlField(envelope, "ciphertext", 1_500_000);
  assertBase64UrlField(envelope, "tag", 64);
}

function assertJweProtectedHeader(
  header: JWEHeaderParameters | undefined,
  expected: {
    expectedKeyId: string;
    expectedType: typeof JWE_REQUEST_TYPE | typeof JWE_RESPONSE_TYPE;
    expectedContentType: "application/json" | "application/jose";
  },
): void {
  if (!isRecord(header)) {
    throw new SecureEnvelopeError(
      "JWE_PROTECTED_HEADER_INVALID",
      "JWE thiếu protected header.",
    );
  }
  assertExactKeys(
    header,
    ["alg", "enc", "kid", "typ", "cty"],
    "JWE_PROTECTED_HEADER_INVALID",
  );
  if (
    header.alg !== RSA_ALGORITHM ||
    header.enc !== CONTENT_ENCRYPTION ||
    header.kid !== expected.expectedKeyId ||
    header.typ !== expected.expectedType ||
    header.cty !== expected.expectedContentType
  ) {
    throw new SecureEnvelopeError(
      "JWE_PROTECTED_HEADER_INVALID",
      "Protected header JWE không khớp profile được hỗ trợ.",
    );
  }
}

function assertJwsProtectedHeader(
  header: JWSHeaderParameters,
  expectedSigningKeyId: string,
): void {
  if (!isRecord(header)) {
    throw new SecureEnvelopeError(
      "JWS_PROTECTED_HEADER_INVALID",
      "JWS thiếu protected header.",
    );
  }
  assertExactKeys(
    header,
    ["alg", "kid", "typ", "cty"],
    "JWS_PROTECTED_HEADER_INVALID",
  );
  if (
    header.alg !== RESPONSE_SIGNATURE_ALGORITHM ||
    header.kid !== expectedSigningKeyId ||
    header.typ !== JWS_RESPONSE_TYPE ||
    header.cty !== "application/json"
  ) {
    throw new SecureEnvelopeError(
      "JWS_PROTECTED_HEADER_INVALID",
      "Protected header JWS không khớp profile được hỗ trợ.",
    );
  }
}

function assertJweRequestMetadata(
  value: unknown,
): asserts value is JweRequestMetadata {
  if (!isRecord(value)) {
    throw new SecureEnvelopeError(
      "JWE_REQUEST_METADATA_INVALID",
      "Metadata request không hợp lệ.",
    );
  }
  assertExactKeys(
    value,
    [
      "version",
      "direction",
      "method",
      "path",
      "requestId",
      "timestamp",
      "nonce",
      "clientKeyId",
      "clientPublicKey",
      "boundHeaders",
    ],
    "JWE_REQUEST_METADATA_INVALID",
  );
  if (
    value.version !== SECURE_JWE_VERSION ||
    value.direction !== "request" ||
    typeof value.method !== "string" ||
    !/^[A-Z]{3,10}$/u.test(value.method) ||
    typeof value.path !== "string" ||
    !value.path.startsWith("/") ||
    value.path.length > 2_048 ||
    !isBoundedString(value.requestId, 1, 256) ||
    !Number.isSafeInteger(value.timestamp) ||
    !isBoundedString(value.nonce, 16, 256) ||
    !isBoundedString(value.clientKeyId, 16, 256) ||
    !isRsaPublicJwk(value.clientPublicKey) ||
    !isProtectedRequestHeaders(value.boundHeaders)
  ) {
    throw new SecureEnvelopeError(
      "JWE_REQUEST_METADATA_INVALID",
      "Metadata request không khớp profile v2.",
    );
  }
}

function assertJweResponseMetadata(
  value: unknown,
): asserts value is JweResponseMetadata {
  if (!isRecord(value)) {
    throw new SecureEnvelopeError(
      "JWE_RESPONSE_METADATA_INVALID",
      "Metadata response không hợp lệ.",
    );
  }
  assertExactKeys(
    value,
    [
      "version",
      "direction",
      "requestId",
      "requestNonce",
      "timestamp",
      "statusCode",
      "serverKeyId",
    ],
    "JWE_RESPONSE_METADATA_INVALID",
  );
  if (
    value.version !== SECURE_JWE_VERSION ||
    value.direction !== "response" ||
    !isBoundedString(value.requestId, 1, 256) ||
    !isBoundedString(value.requestNonce, 16, 256) ||
    !Number.isSafeInteger(value.timestamp) ||
    typeof value.statusCode !== "number" ||
    !Number.isInteger(value.statusCode) ||
    value.statusCode < 100 ||
    value.statusCode > 599 ||
    !isBoundedString(value.serverKeyId, 1, 256)
  ) {
    throw new SecureEnvelopeError(
      "JWE_RESPONSE_METADATA_INVALID",
      "Metadata response không khớp profile v2.",
    );
  }
}

function parseJsonRecord(
  bytes: Uint8Array,
  code: string,
): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(decoder.decode(bytes));
  } catch (error) {
    throw new SecureEnvelopeError(
      code,
      "Payload JOSE không phải JSON hợp lệ.",
      error,
    );
  }
  if (!isRecord(parsed)) {
    throw new SecureEnvelopeError(code, "Payload JOSE phải là JSON object.");
  }
  return parsed;
}

function assertExactKeys(
  record: Record<string, unknown>,
  expected: string[],
  code: string,
): void {
  const actual = Object.keys(record).sort();
  const wanted = [...expected].sort();
  if (
    actual.length !== wanted.length ||
    actual.some((key, index) => key !== wanted[index])
  ) {
    throw new SecureEnvelopeError(
      code,
      "JOSE object chứa trường thiếu, thừa hoặc không được bảo vệ.",
    );
  }
}

function assertBase64UrlField(
  record: Record<string, unknown>,
  field: string,
  maxLength: number,
): void {
  const value = record[field];
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > maxLength ||
    !/^[A-Za-z0-9_-]+$/u.test(value)
  ) {
    throw new SecureEnvelopeError(
      "JWE_MALFORMED",
      `Trường ${field} của JWE không hợp lệ.`,
    );
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isBoundedString(
  value: unknown,
  minLength: number,
  maxLength: number,
): value is string {
  return (
    typeof value === "string" &&
    value.length >= minLength &&
    value.length <= maxLength
  );
}

function constantTimeEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left[index]! ^ right[index]!;
  }
  return difference === 0;
}

function assertRsaPublicKeyStrength(key: CryptoKey, code: string): void {
  const algorithm = key.algorithm as RsaHashedKeyAlgorithm;
  const exponent = Array.from(algorithm.publicExponent ?? []);
  if (
    !["RSA-OAEP", "RSA-PSS"].includes(algorithm.name) ||
    algorithm.modulusLength < 2_048 ||
    algorithm.modulusLength > 8_192 ||
    exponent.length !== 3 ||
    exponent[0] !== 1 ||
    exponent[1] !== 0 ||
    exponent[2] !== 1
  ) {
    throw new SecureEnvelopeError(
      code,
      "RSA public key phải từ 2048 đến 8192 bit và dùng public exponent 65537.",
    );
  }
}

function isRsaPublicJwk(value: unknown): value is RsaPublicJwk {
  if (!isRecord(value)) return false;
  const allowed = new Set(["kty", "n", "e", "alg", "ext", "key_ops"]);
  if (Object.keys(value).some((key) => !allowed.has(key))) return false;
  return (
    value.kty === "RSA" &&
    isBoundedString(value.n, 128, 2_048) &&
    isBoundedString(value.e, 1, 16) &&
    /^[A-Za-z0-9_-]+$/u.test(value.n) &&
    /^[A-Za-z0-9_-]+$/u.test(value.e) &&
    (value.alg === undefined || value.alg === RSA_ALGORITHM) &&
    (value.ext === undefined || value.ext === true) &&
    (value.key_ops === undefined ||
      (Array.isArray(value.key_ops) &&
        value.key_ops.length === 1 &&
        value.key_ops[0] === "encrypt"))
  );
}

function isRsaSigningPublicJwk(value: unknown): value is RsaPublicJwk {
  if (!isRecord(value)) return false;
  const allowed = new Set(["kty", "n", "e", "alg", "ext", "key_ops"]);
  if (Object.keys(value).some((key) => !allowed.has(key))) return false;
  return (
    value.kty === "RSA" &&
    isBoundedString(value.n, 128, 2_048) &&
    isBoundedString(value.e, 1, 16) &&
    /^[A-Za-z0-9_-]+$/u.test(value.n) &&
    /^[A-Za-z0-9_-]+$/u.test(value.e) &&
    value.alg === RESPONSE_SIGNATURE_ALGORITHM &&
    value.ext === true &&
    Array.isArray(value.key_ops) &&
    value.key_ops.length === 1 &&
    value.key_ops[0] === "verify"
  );
}

function normalizeProtectedRequestHeaders(
  value: ProtectedRequestHeaders | undefined,
): ProtectedRequestHeaders {
  const normalized: ProtectedRequestHeaders = {};
  if (value?.csrfToken) normalized.csrfToken = value.csrfToken;
  if (value?.idempotencyKey) normalized.idempotencyKey = value.idempotencyKey;
  if (!isProtectedRequestHeaders(normalized)) {
    throw new SecureEnvelopeError(
      "BOUND_HEADERS_INVALID",
      "Header cần bind không hợp lệ.",
    );
  }
  return normalized;
}

function isProtectedRequestHeaders(
  value: unknown,
): value is ProtectedRequestHeaders {
  if (!isRecord(value)) return false;
  const allowed = new Set(["csrfToken", "idempotencyKey"]);
  if (Object.keys(value).some((key) => !allowed.has(key))) return false;
  return (
    (value.csrfToken === undefined ||
      isBoundedString(value.csrfToken, 1, 512)) &&
    (value.idempotencyKey === undefined ||
      isBoundedString(value.idempotencyKey, 1, 256))
  );
}

function pemToDer(
  pem: string,
  label: "PRIVATE KEY" | "PUBLIC KEY",
): Uint8Array<ArrayBuffer> {
  const begin = `-----BEGIN ${label}-----`;
  const end = `-----END ${label}-----`;
  const startIndex = pem.indexOf(begin);
  const endIndex = pem.indexOf(end);
  if (startIndex < 0 || endIndex < 0 || endIndex <= startIndex) {
    throw new SecureEnvelopeError(
      "INVALID_PEM",
      `Không tìm thấy PEM ${label}.`,
    );
  }
  const base64 = pem
    .slice(startIndex + begin.length, endIndex)
    .replace(/\s+/gu, "");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function toRsaPublicJwk(jwk: JsonWebKey): RsaPublicJwk {
  if (
    jwk.kty !== "RSA" ||
    typeof jwk.n !== "string" ||
    typeof jwk.e !== "string"
  ) {
    throw new SecureEnvelopeError(
      "INVALID_RSA_JWK",
      "JWK không phải public key RSA hợp lệ.",
    );
  }
  const result: RsaPublicJwk = { kty: "RSA", n: jwk.n, e: jwk.e };
  if (typeof jwk.alg === "string") result.alg = jwk.alg;
  if (typeof jwk.ext === "boolean") result.ext = jwk.ext;
  if (Array.isArray(jwk.key_ops)) result.key_ops = [...jwk.key_ops];
  return result;
}

export interface SecureApiClientOptions {
  baseUrl: string;
  pinnedServerFingerprint?: string;
  pinnedSigningFingerprint?: string;
  protocolVersion?: typeof SECURE_ENVELOPE_VERSION | typeof SECURE_JWE_VERSION;
  rsaModulusLength?: number;
  credentials?: RequestCredentials;
  fetchImpl?: typeof fetch;
  csrfTokenProvider?: () => string | undefined;
  extraHeadersProvider?: () => HeadersInit | Promise<HeadersInit>;
}

export interface SecureApiRequestOptions {
  method?: string;
  headers?: HeadersInit;
  signal?: AbortSignal;
}

interface LoadedServerKeys {
  descriptor: CryptoServerKeyDescriptor;
  key: CryptoKey;
  signingKey?: CryptoKey;
}

export class SecureApiClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly credentials: RequestCredentials;
  private readonly pinnedServerFingerprint: string | undefined;
  private readonly pinnedSigningFingerprint: string | undefined;
  private readonly protocolVersion:
    typeof SECURE_ENVELOPE_VERSION | typeof SECURE_JWE_VERSION;
  private readonly rsaModulusLength: number;
  private readonly csrfTokenProvider: () => string | undefined;
  private readonly extraHeadersProvider:
    (() => HeadersInit | Promise<HeadersInit>) | undefined;
  private clientKeysPromise: Promise<ClientKeyMaterial> | undefined;
  private serverKeyPromise: Promise<LoadedServerKeys> | undefined;

  constructor(options: SecureApiClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/u, "");
    this.fetchImpl =
      options.fetchImpl ?? ((input, init) => globalThis.fetch(input, init));
    this.credentials = options.credentials ?? "include";
    this.pinnedServerFingerprint = options.pinnedServerFingerprint || undefined;
    this.pinnedSigningFingerprint =
      options.pinnedSigningFingerprint || undefined;
    this.protocolVersion = options.protocolVersion ?? SECURE_JWE_VERSION;
    this.rsaModulusLength = options.rsaModulusLength ?? 3072;
    if (
      !Number.isInteger(this.rsaModulusLength) ||
      this.rsaModulusLength < 2_048 ||
      this.rsaModulusLength > 8_192
    ) {
      throw new SecureEnvelopeError(
        "CLIENT_RSA_KEY_SIZE_INVALID",
        "Client RSA key phải là số nguyên từ 2048 đến 8192 bit.",
      );
    }
    this.csrfTokenProvider =
      options.csrfTokenProvider ?? defaultCsrfTokenProvider;
    this.extraHeadersProvider = options.extraHeadersProvider;
  }

  async refreshServerKey(): Promise<void> {
    this.serverKeyPromise = undefined;
    await this.getServerKey();
  }

  async request<TResponse, TBody = unknown>(
    path: string,
    body: TBody,
    options: SecureApiRequestOptions = {},
  ): Promise<TResponse> {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const normalizedPath = normalizeApiPath(path);
      const method = (options.method ?? "POST").toUpperCase();
      const endpointUrl = new URL(`${this.baseUrl}${normalizedPath}`);
      const [clientKeys, server] = await Promise.all([
        this.getClientKeys(),
        this.getServerKey(),
      ]);
      const headers = new Headers(options.headers);
      headers.set(
        "content-type",
        this.protocolVersion === SECURE_JWE_VERSION
          ? "application/jose+json"
          : "application/json",
      );
      const csrfToken = this.csrfTokenProvider();
      if (csrfToken) headers.set("x-csrf-token", csrfToken);
      if (this.extraHeadersProvider) {
        const extra = new Headers(await this.extraHeadersProvider());
        extra.forEach((value, key) => headers.set(key, value));
      }
      const encryptedRequest =
        this.protocolVersion === SECURE_JWE_VERSION
          ? await encryptJweRequest({
              serverPublicKey: server.key,
              serverKeyId: server.descriptor.keyId,
              clientPublicKey: clientKeys.publicJwk,
              clientKeyId: clientKeys.keyId,
              method,
              path: endpointUrl.pathname,
              body,
              boundHeaders: {
                ...(headers.get("x-csrf-token")
                  ? { csrfToken: headers.get("x-csrf-token")! }
                  : {}),
                ...(headers.get("idempotency-key")
                  ? { idempotencyKey: headers.get("idempotency-key")! }
                  : {}),
              },
            })
          : await encryptRequestEnvelope({
              serverPublicKey: server.key,
              serverKeyId: server.descriptor.keyId,
              clientPublicKey: clientKeys.publicJwk,
              clientKeyId: clientKeys.keyId,
              method,
              path: endpointUrl.pathname,
              body,
            });
      const requestMetadata =
        this.protocolVersion === SECURE_JWE_VERSION
          ? (encryptedRequest as EncryptedJweRequest).metadata
          : (encryptedRequest as EncryptedEnvelope<RequestAad>).aad;
      const wireEnvelope =
        this.protocolVersion === SECURE_JWE_VERSION
          ? (encryptedRequest as EncryptedJweRequest).envelope
          : encryptedRequest;
      const protocolHeader =
        this.protocolVersion === SECURE_JWE_VERSION
          ? SECURE_ENVELOPE_V2_HEADER_VALUE
          : SECURE_ENVELOPE_V1_HEADER_VALUE;

      headers.set(SECURE_ENVELOPE_HEADER, protocolHeader);
      headers.set("x-request-id", requestMetadata.requestId);

      const requestInit: RequestInit = {
        method,
        headers,
        body: JSON.stringify(wireEnvelope),
        credentials: this.credentials,
        cache: "no-store",
      };
      if (options.signal) requestInit.signal = options.signal;
      const response = await this.fetchImpl(
        endpointUrl.toString(),
        requestInit,
      );
      const raw = (await response.json()) as unknown;

      if (response.headers.get(SECURE_ENVELOPE_HEADER) !== protocolHeader) {
        const code = extractErrorCode(raw);
        if (
          attempt === 0 &&
          response.status === 409 &&
          code === "SERVER_KEY_ROTATED"
        ) {
          await this.refreshServerKey();
          continue;
        }
        throw new SecureApiError(response.status, raw);
      }

      const decrypted =
        this.protocolVersion === SECURE_JWE_VERSION
          ? await decryptJweResponse<TResponse>(raw as FlattenedJweEnvelope, {
              clientPrivateKey: clientKeys.privateKey,
              clientKeyId: clientKeys.keyId,
              signingPublicKey: requireSigningKey(server),
              signingKeyId: server.descriptor.signingKeyId!,
              serverKeyId: server.descriptor.keyId,
            })
          : await decryptResponseEnvelope<TResponse>(
              raw as EncryptedEnvelope<ResponseAad>,
              clientKeys.privateKey,
            );
      const responseMetadata =
        this.protocolVersion === SECURE_JWE_VERSION
          ? (decrypted as DecryptedJweResponse<TResponse>).metadata
          : (decrypted as DecryptedResponse<TResponse>).aad;
      if (
        responseMetadata.requestId !== requestMetadata.requestId ||
        responseMetadata.requestNonce !== requestMetadata.nonce ||
        responseMetadata.statusCode !== response.status ||
        (this.protocolVersion === SECURE_JWE_VERSION &&
          Math.abs(Date.now() - responseMetadata.timestamp) > 300_000)
      ) {
        throw new SecureEnvelopeError(
          "RESPONSE_BINDING_FAILED",
          "Response không khớp requestId, nonce hoặc HTTP status của request ban đầu.",
        );
      }
      if (!response.ok) {
        throw new SecureApiError(response.status, decrypted.body);
      }
      return decrypted.body;
    }
    throw new SecureEnvelopeError(
      "SERVER_KEY_ROTATION_FAILED",
      "Không đồng bộ được public key mới của server.",
    );
  }

  private getClientKeys(): Promise<ClientKeyMaterial> {
    this.clientKeysPromise ??= generateClientKeyMaterial(this.rsaModulusLength);
    return this.clientKeysPromise;
  }

  private getServerKey(): Promise<LoadedServerKeys> {
    this.serverKeyPromise ??= this.loadServerKey();
    return this.serverKeyPromise;
  }

  private async loadServerKey(): Promise<LoadedServerKeys> {
    const response = await this.fetchImpl(`${this.baseUrl}/crypto/server-key`, {
      method: "GET",
      credentials: this.credentials,
      cache: "no-store",
      headers: { accept: "application/json" },
    });
    if (!response.ok) {
      throw new SecureEnvelopeError(
        "SERVER_KEY_FETCH_FAILED",
        `Không tải được server key: HTTP ${response.status}.`,
      );
    }
    const descriptor = (await response.json()) as CryptoServerKeyDescriptor;
    if (
      descriptor.version !== SECURE_ENVELOPE_VERSION ||
      descriptor.algorithm !== RSA_ALGORITHM ||
      descriptor.contentEncryption !== CONTENT_ENCRYPTION ||
      !isRsaPublicJwk(descriptor.publicKey)
    ) {
      throw new SecureEnvelopeError(
        "SERVER_KEY_UNSUPPORTED",
        "Server key descriptor không tương thích.",
      );
    }
    const key = await importRsaPublicJwk(descriptor.publicKey);
    assertRsaPublicKeyStrength(key, "SERVER_KEY_UNSUPPORTED");
    const calculatedFingerprint = await fingerprintPublicKey(key);
    if (calculatedFingerprint !== descriptor.fingerprintSha256) {
      throw new SecureEnvelopeError(
        "SERVER_KEY_FINGERPRINT_MISMATCH",
        "Fingerprint public key từ server không khớp.",
      );
    }
    if (
      this.pinnedServerFingerprint &&
      calculatedFingerprint !== this.pinnedServerFingerprint
    ) {
      throw new SecureEnvelopeError(
        "SERVER_KEY_PIN_MISMATCH",
        "Public key server không khớp pin của bản build.",
      );
    }
    if (this.protocolVersion === SECURE_ENVELOPE_VERSION) {
      return { descriptor, key };
    }
    if (
      !descriptor.supportedVersions?.includes(SECURE_JWE_VERSION) ||
      descriptor.signatureAlgorithm !== RESPONSE_SIGNATURE_ALGORITHM ||
      !descriptor.signingKeyId ||
      !isRsaSigningPublicJwk(descriptor.signingPublicKey) ||
      !descriptor.signingFingerprintSha256
    ) {
      throw new SecureEnvelopeError(
        "SERVER_JWE_V2_UNSUPPORTED",
        "Server chưa công bố đầy đủ profile JWE v2 và signing key.",
      );
    }
    const signingKey = await importRsaSigningPublicJwk(
      descriptor.signingPublicKey,
    );
    assertRsaPublicKeyStrength(signingKey, "SERVER_SIGNING_KEY_UNSUPPORTED");
    const signingFingerprint = await fingerprintPublicKey(signingKey);
    if (signingFingerprint !== descriptor.signingFingerprintSha256) {
      throw new SecureEnvelopeError(
        "SIGNING_KEY_FINGERPRINT_MISMATCH",
        "Fingerprint signing key từ server không khớp.",
      );
    }
    if (
      this.pinnedSigningFingerprint &&
      signingFingerprint !== this.pinnedSigningFingerprint
    ) {
      throw new SecureEnvelopeError(
        "SIGNING_KEY_PIN_MISMATCH",
        "Signing key server không khớp pin của bản build.",
      );
    }
    return { descriptor, key, signingKey };
  }
}

function requireSigningKey(server: LoadedServerKeys): CryptoKey {
  if (!server.signingKey) {
    throw new SecureEnvelopeError(
      "SIGNING_KEY_UNAVAILABLE",
      "Client chưa tải signing key của server.",
    );
  }
  return server.signingKey;
}

function extractErrorCode(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object") return undefined;
  const code = (payload as { code?: unknown }).code;
  return typeof code === "string" ? code : undefined;
}

function defaultCsrfTokenProvider(): string | undefined {
  if (typeof document === "undefined") return undefined;
  const match = document.cookie
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith("csrf_token="));
  if (!match) return undefined;
  return decodeURIComponent(match.slice("csrf_token=".length));
}

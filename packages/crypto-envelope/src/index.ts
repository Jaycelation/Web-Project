export const SECURE_ENVELOPE_VERSION = 1 as const;
export const SECURE_ENVELOPE_HEADER = 'x-secure-envelope';
export const SECURE_ENVELOPE_HEADER_VALUE = 'v1';
export const RSA_ALGORITHM = 'RSA-OAEP-256' as const;
export const CONTENT_ENCRYPTION = 'A256GCM' as const;
export const AES_GCM_IV_BYTES = 12;
export const AES_GCM_TAG_BITS = 128;

export interface RsaPublicJwk {
  kty: 'RSA';
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
}

export interface RequestAad {
  version: typeof SECURE_ENVELOPE_VERSION;
  direction: 'request';
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
  direction: 'response';
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

export interface DecryptedRequest<TBody> {
  body: TBody;
  aad: RequestAad;
}

export interface DecryptedResponse<TBody> {
  body: TBody;
  aad: ResponseAad;
}

export class SecureEnvelopeError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly causeValue?: unknown,
  ) {
    super(message);
    this.name = 'SecureEnvelopeError';
  }
}

export class SecureApiError<T = unknown> extends Error {
  constructor(
    public readonly status: number,
    public readonly payload: T,
  ) {
    super(extractErrorMessage(payload, `API trả về HTTP ${status}.`));
    this.name = 'SecureApiError';
  }
}

function extractErrorMessage(payload: unknown, fallback: string): string {
  if (payload && typeof payload === 'object' && 'message' in payload) {
    const value = (payload as { message?: unknown }).message;
    if (typeof value === 'string') return value;
    if (Array.isArray(value)) return value.map(String).join(', ');
  }
  return fallback;
}

function webCrypto(): Crypto {
  if (!globalThis.crypto?.subtle) {
    throw new SecureEnvelopeError('WEB_CRYPTO_UNAVAILABLE', 'Môi trường không hỗ trợ Web Crypto API.');
  }
  return globalThis.crypto;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function canonicalizeJson(value: unknown): string {
  if (value === null) return 'null';
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new SecureEnvelopeError('NON_FINITE_NUMBER', 'JSON canonical không chấp nhận NaN hoặc Infinity.');
    }
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalizeJson(item)).join(',')}]`;
  }
  if (typeof value === 'object') {
    const object = value as Record<string, unknown>;
    const keys = Object.keys(object)
      .filter((key) => object[key] !== undefined)
      .sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalizeJson(object[key])}`).join(',')}}`;
  }
  throw new SecureEnvelopeError('UNSUPPORTED_JSON_VALUE', `Không thể canonicalize kiểu ${typeof value}.`);
}

export function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, Math.min(offset + chunkSize, bytes.length));
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/u, '');
}

export function base64UrlToBytes(value: string): Uint8Array {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  let binary: string;
  try {
    binary = atob(padded);
  } catch (error) {
    throw new SecureEnvelopeError('INVALID_BASE64URL', 'Dữ liệu base64url không hợp lệ.', error);
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
  const withoutQuery = path.split('?')[0] ?? path;
  if (!withoutQuery.startsWith('/')) return `/${withoutQuery}`;
  return withoutQuery;
}

export async function sha256Base64Url(input: string | Uint8Array): Promise<string> {
  const bytes = typeof input === 'string' ? encoder.encode(input) : input;
  const digest = await webCrypto().subtle.digest('SHA-256', bytes);
  return bytesToBase64Url(new Uint8Array(digest));
}

export async function generateClientKeyMaterial(modulusLength = 3072): Promise<ClientKeyMaterial> {
  const pair = (await webCrypto().subtle.generateKey(
    {
      name: 'RSA-OAEP',
      modulusLength,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['encrypt', 'decrypt'],
  )) as CryptoKeyPair;

  const publicJwk = toRsaPublicJwk(await webCrypto().subtle.exportKey('jwk', pair.publicKey));
  const keyId = await fingerprintPublicKey(pair.publicKey);
  return { publicKey: pair.publicKey, privateKey: pair.privateKey, publicJwk, keyId };
}

export async function importRsaPublicJwk(jwk: RsaPublicJwk): Promise<CryptoKey> {
  return webCrypto().subtle.importKey(
    'jwk',
    { ...jwk, alg: 'RSA-OAEP-256', ext: true, key_ops: ['encrypt'] },
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    true,
    ['encrypt'],
  );
}

export async function importRsaPrivateKeyPem(pem: string): Promise<CryptoKey> {
  const bytes = pemToDer(pem, 'PRIVATE KEY');
  return webCrypto().subtle.importKey(
    'pkcs8',
    bytes,
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    false,
    ['decrypt'],
  );
}

export async function importRsaPublicKeyPem(pem: string): Promise<CryptoKey> {
  const bytes = pemToDer(pem, 'PUBLIC KEY');
  return webCrypto().subtle.importKey(
    'spki',
    bytes,
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    true,
    ['encrypt'],
  );
}

export async function exportRsaPublicJwk(key: CryptoKey): Promise<RsaPublicJwk> {
  return toRsaPublicJwk(await webCrypto().subtle.exportKey('jwk', key));
}

export async function fingerprintPublicKey(key: CryptoKey): Promise<string> {
  const spki = await webCrypto().subtle.exportKey('spki', key);
  const digest = await webCrypto().subtle.digest('SHA-256', spki);
  return bytesToBase64Url(new Uint8Array(digest));
}

export async function encryptRequestEnvelope<TBody>(
  options: EncryptRequestOptions<TBody>,
): Promise<EncryptedEnvelope<RequestAad>> {
  const aad: RequestAad = {
    version: SECURE_ENVELOPE_VERSION,
    direction: 'request',
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
  if (envelope.aad.direction !== 'request') {
    throw new SecureEnvelopeError('INVALID_DIRECTION', 'Envelope không phải request.');
  }
  const body = await decryptEnvelope<TBody, RequestAad>(envelope, serverPrivateKey);
  return { body, aad: envelope.aad };
}

export async function encryptResponseEnvelope<TBody>(
  options: EncryptResponseOptions<TBody>,
): Promise<EncryptedEnvelope<ResponseAad>> {
  const aad: ResponseAad = {
    version: SECURE_ENVELOPE_VERSION,
    direction: 'response',
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
  if (envelope.aad.direction !== 'response') {
    throw new SecureEnvelopeError('INVALID_DIRECTION', 'Envelope không phải response.');
  }
  const body = await decryptEnvelope<TBody, ResponseAad>(envelope, clientPrivateKey);
  return { body, aad: envelope.aad };
}

async function encryptEnvelope<TBody, TAad extends RequestAad | ResponseAad>(options: {
  recipientPublicKey: CryptoKey;
  recipientKeyId: string;
  aad: TAad;
  body: TBody;
}): Promise<EncryptedEnvelope<TAad>> {
  const crypto = webCrypto();
  const aesKey = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, [
    'encrypt',
    'decrypt',
  ]);
  const rawAesKey = new Uint8Array(await crypto.subtle.exportKey('raw', aesKey));
  const encryptedKey = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, options.recipientPublicKey, rawAesKey),
  );
  const iv = new Uint8Array(AES_GCM_IV_BYTES);
  crypto.getRandomValues(iv);
  const additionalData = encoder.encode(canonicalizeJson(options.aad));
  const plaintext = encoder.encode(JSON.stringify(options.body));
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv, additionalData, tagLength: AES_GCM_TAG_BITS },
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
      { name: 'RSA-OAEP' },
      recipientPrivateKey,
      base64UrlToBytes(envelope.encryptedKey),
    );
    const aesKey = await crypto.subtle.importKey(
      'raw',
      rawAesKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt'],
    );
    const plaintext = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
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
      'ENVELOPE_DECRYPT_FAILED',
      'Không thể giải mã hoặc xác thực tính toàn vẹn của envelope.',
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
    throw new SecureEnvelopeError('UNSUPPORTED_ENVELOPE', 'Phiên bản hoặc thuật toán envelope không hỗ trợ.');
  }
  if (!envelope.keyId || !envelope.encryptedKey || !envelope.iv || !envelope.ciphertext) {
    throw new SecureEnvelopeError('MALFORMED_ENVELOPE', 'Envelope thiếu trường bắt buộc.');
  }
}

function pemToDer(pem: string, label: 'PRIVATE KEY' | 'PUBLIC KEY'): Uint8Array {
  const begin = `-----BEGIN ${label}-----`;
  const end = `-----END ${label}-----`;
  const startIndex = pem.indexOf(begin);
  const endIndex = pem.indexOf(end);
  if (startIndex < 0 || endIndex < 0 || endIndex <= startIndex) {
    throw new SecureEnvelopeError('INVALID_PEM', `Không tìm thấy PEM ${label}.`);
  }
  const base64 = pem
    .slice(startIndex + begin.length, endIndex)
    .replace(/\s+/gu, '');
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function toRsaPublicJwk(jwk: JsonWebKey): RsaPublicJwk {
  if (jwk.kty !== 'RSA' || typeof jwk.n !== 'string' || typeof jwk.e !== 'string') {
    throw new SecureEnvelopeError('INVALID_RSA_JWK', 'JWK không phải public key RSA hợp lệ.');
  }
  const result: RsaPublicJwk = { kty: 'RSA', n: jwk.n, e: jwk.e };
  if (typeof jwk.alg === 'string') result.alg = jwk.alg;
  if (typeof jwk.ext === 'boolean') result.ext = jwk.ext;
  if (Array.isArray(jwk.key_ops)) result.key_ops = [...jwk.key_ops];
  return result;
}

export interface SecureApiClientOptions {
  baseUrl: string;
  pinnedServerFingerprint?: string;
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

export class SecureApiClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly credentials: RequestCredentials;
  private readonly pinnedServerFingerprint: string | undefined;
  private readonly rsaModulusLength: number;
  private readonly csrfTokenProvider: () => string | undefined;
  private readonly extraHeadersProvider: (() => HeadersInit | Promise<HeadersInit>) | undefined;
  private clientKeysPromise: Promise<ClientKeyMaterial> | undefined;
  private serverKeyPromise: Promise<{ descriptor: CryptoServerKeyDescriptor; key: CryptoKey }> | undefined;

  constructor(options: SecureApiClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/u, '');
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.credentials = options.credentials ?? 'include';
    this.pinnedServerFingerprint = options.pinnedServerFingerprint || undefined;
    this.rsaModulusLength = options.rsaModulusLength ?? 3072;
    this.csrfTokenProvider = options.csrfTokenProvider ?? defaultCsrfTokenProvider;
    this.extraHeadersProvider = options.extraHeadersProvider;
  }

  async refreshServerKey(): Promise<void> {
    this.serverKeyPromise = undefined;
    await this.getServerKey();
  }

  async request<TResponse, TBody = Record<string, never>>(
    path: string,
    body: TBody,
    options: SecureApiRequestOptions = {},
  ): Promise<TResponse> {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const normalizedPath = normalizeApiPath(path);
      const method = (options.method ?? 'POST').toUpperCase();
      const endpointUrl = new URL(`${this.baseUrl}${normalizedPath}`);
      const [clientKeys, server] = await Promise.all([this.getClientKeys(), this.getServerKey()]);
      const envelope = await encryptRequestEnvelope({
        serverPublicKey: server.key,
        serverKeyId: server.descriptor.keyId,
        clientPublicKey: clientKeys.publicJwk,
        clientKeyId: clientKeys.keyId,
        method,
        path: endpointUrl.pathname,
        body,
      });

      const headers = new Headers(options.headers);
      headers.set('content-type', 'application/json');
      headers.set(SECURE_ENVELOPE_HEADER, SECURE_ENVELOPE_HEADER_VALUE);
      headers.set('x-request-id', envelope.aad.requestId);
      const csrfToken = this.csrfTokenProvider();
      if (csrfToken) headers.set('x-csrf-token', csrfToken);
      if (this.extraHeadersProvider) {
        const extra = new Headers(await this.extraHeadersProvider());
        extra.forEach((value, key) => headers.set(key, value));
      }

      const requestInit: RequestInit = {
        method,
        headers,
        body: JSON.stringify(envelope),
        credentials: this.credentials,
        cache: 'no-store',
      };
      if (options.signal) requestInit.signal = options.signal;
      const response = await this.fetchImpl(endpointUrl.toString(), requestInit);
      const raw = (await response.json()) as unknown;

      if (response.headers.get(SECURE_ENVELOPE_HEADER) !== SECURE_ENVELOPE_HEADER_VALUE) {
        const code = extractErrorCode(raw);
        if (attempt === 0 && response.status === 409 && code === 'SERVER_KEY_ROTATED') {
          await this.refreshServerKey();
          continue;
        }
        throw new SecureApiError(response.status, raw);
      }

      const decrypted = await decryptResponseEnvelope<TResponse>(
        raw as EncryptedEnvelope<ResponseAad>,
        clientKeys.privateKey,
      );
      if (
        decrypted.aad.requestId !== envelope.aad.requestId ||
        decrypted.aad.requestNonce !== envelope.aad.nonce ||
        decrypted.aad.statusCode !== response.status
      ) {
        throw new SecureEnvelopeError(
          'RESPONSE_BINDING_FAILED',
          'Response không khớp requestId, nonce hoặc HTTP status của request ban đầu.',
        );
      }
      if (!response.ok) {
        throw new SecureApiError(response.status, decrypted.body);
      }
      return decrypted.body;
    }
    throw new SecureEnvelopeError('SERVER_KEY_ROTATION_FAILED', 'Không đồng bộ được public key mới của server.');
  }

  private getClientKeys(): Promise<ClientKeyMaterial> {
    this.clientKeysPromise ??= generateClientKeyMaterial(this.rsaModulusLength);
    return this.clientKeysPromise;
  }

  private getServerKey(): Promise<{ descriptor: CryptoServerKeyDescriptor; key: CryptoKey }> {
    this.serverKeyPromise ??= this.loadServerKey();
    return this.serverKeyPromise;
  }

  private async loadServerKey(): Promise<{ descriptor: CryptoServerKeyDescriptor; key: CryptoKey }> {
    const response = await this.fetchImpl(`${this.baseUrl}/crypto/server-key`, {
      method: 'GET',
      credentials: this.credentials,
      cache: 'no-store',
      headers: { accept: 'application/json' },
    });
    if (!response.ok) {
      throw new SecureEnvelopeError('SERVER_KEY_FETCH_FAILED', `Không tải được server key: HTTP ${response.status}.`);
    }
    const descriptor = (await response.json()) as CryptoServerKeyDescriptor;
    if (
      descriptor.version !== SECURE_ENVELOPE_VERSION ||
      descriptor.algorithm !== RSA_ALGORITHM ||
      descriptor.contentEncryption !== CONTENT_ENCRYPTION
    ) {
      throw new SecureEnvelopeError('SERVER_KEY_UNSUPPORTED', 'Server key descriptor không tương thích.');
    }
    const key = await importRsaPublicJwk(descriptor.publicKey);
    const calculatedFingerprint = await fingerprintPublicKey(key);
    if (calculatedFingerprint !== descriptor.fingerprintSha256) {
      throw new SecureEnvelopeError('SERVER_KEY_FINGERPRINT_MISMATCH', 'Fingerprint public key từ server không khớp.');
    }
    if (
      this.pinnedServerFingerprint &&
      calculatedFingerprint !== this.pinnedServerFingerprint
    ) {
      throw new SecureEnvelopeError('SERVER_KEY_PIN_MISMATCH', 'Public key server không khớp pin của bản build.');
    }
    return { descriptor, key };
  }
}

function extractErrorCode(payload: unknown): string | undefined {
  if (!payload || typeof payload !== 'object') return undefined;
  const code = (payload as { code?: unknown }).code;
  return typeof code === 'string' ? code : undefined;
}

function defaultCsrfTokenProvider(): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const match = document.cookie
    .split(';')
    .map((item) => item.trim())
    .find((item) => item.startsWith('csrf_token='));
  if (!match) return undefined;
  return decodeURIComponent(match.slice('csrf_token='.length));
}

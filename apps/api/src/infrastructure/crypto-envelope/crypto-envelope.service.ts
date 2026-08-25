import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  OnModuleInit,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  CONTENT_ENCRYPTION,
  CryptoServerKeyDescriptor,
  EncryptedEnvelope,
  FlattenedJweEnvelope,
  JweRequestMetadata,
  ProtectedRequestHeaders,
  RequestAad,
  RESPONSE_SIGNATURE_ALGORITHM,
  ResponseAad,
  RSA_ALGORITHM,
  SECURE_ENVELOPE_V1_HEADER_VALUE,
  SECURE_ENVELOPE_V2_HEADER_VALUE,
  SECURE_ENVELOPE_VERSION,
  SECURE_JWE_VERSION,
  SecureEnvelopeProtocol,
  assertRsaEncryptionKeyPair,
  assertRsaSigningKeyPair,
  decryptJweRequest,
  decryptRequestEnvelope,
  encryptJweResponse,
  encryptResponseEnvelope,
  exportRsaPublicJwk,
  exportRsaSigningPublicJwk,
  fingerprintPublicKey,
  importRsaPrivateKeyPem,
  importRsaPublicJwk,
  importRsaPublicKeyPem,
  importRsaSigningPrivateKeyPem,
  importRsaSigningPublicKeyPem,
  normalizeApiPath,
  readUnverifiedJweProtectedHeader,
} from "@secure-commerce/crypto-envelope";
import { generateKeyPairSync } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { ReplayCacheService } from "./replay-cache.service.js";
import type { SecureRequestContext } from "./crypto-envelope.types.js";

@Injectable()
export class CryptoEnvelopeService implements OnModuleInit {
  private readonly logger = new Logger(CryptoEnvelopeService.name);
  private readonly keyId: string;
  private readonly privateKeyPath: string;
  private readonly publicKeyPath: string;
  private readonly signingKeyId: string;
  private readonly signingPrivateKeyPath: string;
  private readonly signingPublicKeyPath: string;
  private readonly acceptV1: boolean;
  private readonly autoGenerate: boolean;
  private readonly rsaBits: number;
  private readonly maxClockSkewMs: number;
  private privateKey: CryptoKey | undefined;
  private publicKey: CryptoKey | undefined;
  private signingPrivateKey: CryptoKey | undefined;
  private signingPublicKey: CryptoKey | undefined;
  private descriptor: CryptoServerKeyDescriptor | undefined;

  constructor(
    private readonly config: ConfigService,
    private readonly replayCache: ReplayCacheService,
  ) {
    this.keyId = config.get<string>("CRYPTO_KEY_ID", "dev-rsa-2026-01");
    this.privateKeyPath = absolutePath(
      config.get<string>(
        "CRYPTO_PRIVATE_KEY_PATH",
        "apps/api/.local/keys/server-private.pem",
      ),
    );
    this.publicKeyPath = absolutePath(
      config.get<string>(
        "CRYPTO_PUBLIC_KEY_PATH",
        "apps/api/.local/keys/server-public.pem",
      ),
    );
    this.signingKeyId = config.get<string>(
      "CRYPTO_SIGNING_KEY_ID",
      "dev-signing-rsa-2026-01",
    );
    this.signingPrivateKeyPath = absolutePath(
      config.get<string>(
        "CRYPTO_SIGNING_PRIVATE_KEY_PATH",
        "apps/api/.local/keys/server-signing-private.pem",
      ),
    );
    this.signingPublicKeyPath = absolutePath(
      config.get<string>(
        "CRYPTO_SIGNING_PUBLIC_KEY_PATH",
        "apps/api/.local/keys/server-signing-public.pem",
      ),
    );
    this.acceptV1 = config.get<string>("CRYPTO_ACCEPT_V1", "true") === "true";
    this.autoGenerate =
      config.get<string>("CRYPTO_AUTO_GENERATE", "false") === "true";
    this.rsaBits = Number(config.get<string>("CRYPTO_RSA_BITS", "3072"));
    this.maxClockSkewMs = Number(
      config.get<string>("CRYPTO_MAX_CLOCK_SKEW_MS", "120000"),
    );
  }

  async onModuleInit(): Promise<void> {
    this.ensureKeyFiles();
    const privatePem = readFileSync(this.privateKeyPath, "utf8");
    const publicPem = readFileSync(this.publicKeyPath, "utf8");
    const signingPrivatePem = readFileSync(this.signingPrivateKeyPath, "utf8");
    const signingPublicPem = readFileSync(this.signingPublicKeyPath, "utf8");
    this.privateKey = await importRsaPrivateKeyPem(privatePem);
    this.publicKey = await importRsaPublicKeyPem(publicPem);
    this.signingPrivateKey =
      await importRsaSigningPrivateKeyPem(signingPrivatePem);
    this.signingPublicKey =
      await importRsaSigningPublicKeyPem(signingPublicPem);
    await assertRsaEncryptionKeyPair(this.publicKey, this.privateKey);
    await assertRsaSigningKeyPair(
      this.signingPrivateKey,
      this.signingPublicKey,
    );
    const publicKeyJwk = await exportRsaPublicJwk(this.publicKey);
    const fingerprintSha256 = await fingerprintPublicKey(this.publicKey);
    const signingPublicKeyJwk = await exportRsaSigningPublicJwk(
      this.signingPublicKey,
    );
    const signingFingerprintSha256 = await fingerprintPublicKey(
      this.signingPublicKey,
    );
    this.descriptor = {
      version: SECURE_ENVELOPE_VERSION,
      keyId: this.keyId,
      publicKey: publicKeyJwk,
      fingerprintSha256,
      algorithm: RSA_ALGORITHM,
      contentEncryption: CONTENT_ENCRYPTION,
      expiresAt: null,
      supportedVersions: this.acceptV1
        ? [SECURE_ENVELOPE_VERSION, SECURE_JWE_VERSION]
        : [SECURE_JWE_VERSION],
      signingKeyId: this.signingKeyId,
      signingPublicKey: signingPublicKeyJwk,
      signingFingerprintSha256,
      signatureAlgorithm: RESPONSE_SIGNATURE_ALGORITHM,
    };
    this.logger.log(
      `Envelope v1/JWE v2 sẵn sàng: enc=${this.keyId} (${fingerprintSha256}), ` +
        `sig=${this.signingKeyId} (${signingFingerprintSha256}).`,
    );
  }

  getServerKeyDescriptor(): CryptoServerKeyDescriptor {
    if (!this.descriptor)
      throw new ServiceUnavailableException("Crypto key chưa sẵn sàng.");
    return this.descriptor;
  }

  async decryptIncoming(
    protocol: SecureEnvelopeProtocol,
    envelope: EncryptedEnvelope<RequestAad> | FlattenedJweEnvelope,
    method: string,
    path: string,
    protectedHeaders: ProtectedRequestHeaders = {},
  ): Promise<{ body: unknown; context: SecureRequestContext }> {
    if (!this.privateKey || !this.descriptor) {
      throw new ServiceUnavailableException("Crypto service chưa sẵn sàng.");
    }
    if (protocol === SECURE_ENVELOPE_V1_HEADER_VALUE && !this.acceptV1) {
      throw new BadRequestException({
        code: "ENVELOPE_VERSION_DISABLED",
        message: "Envelope v1 đã bị tắt trên server.",
      });
    }
    const requestKeyId =
      protocol === SECURE_ENVELOPE_V1_HEADER_VALUE
        ? (envelope as EncryptedEnvelope<RequestAad>).keyId
        : readUnverifiedJweProtectedHeader(envelope as FlattenedJweEnvelope)
            .kid;
    if (requestKeyId !== this.keyId) {
      throw new ConflictException({
        code: "SERVER_KEY_ROTATED",
        message: "Server key đã thay đổi; hãy tải lại public key.",
        activeKeyId: this.keyId,
      });
    }

    const decrypted =
      protocol === SECURE_ENVELOPE_V1_HEADER_VALUE
        ? await decryptRequestEnvelope<unknown>(
            envelope as EncryptedEnvelope<RequestAad>,
            this.privateKey,
          )
        : await decryptJweRequest<unknown>(
            envelope as FlattenedJweEnvelope,
            this.privateKey,
            this.keyId,
          );
    const metadata: RequestAad | JweRequestMetadata =
      protocol === SECURE_ENVELOPE_V1_HEADER_VALUE
        ? (
            decrypted as Awaited<
              ReturnType<typeof decryptRequestEnvelope<unknown>>
            >
          ).aad
        : (decrypted as Awaited<ReturnType<typeof decryptJweRequest<unknown>>>)
            .metadata;
    const normalizedMethod = method.toUpperCase();
    const normalizedPath = normalizeApiPath(path);
    if (
      metadata.method !== normalizedMethod ||
      metadata.path !== normalizedPath
    ) {
      throw new BadRequestException({
        code: "AAD_ROUTE_MISMATCH",
        message:
          "Metadata được bảo vệ không khớp HTTP method hoặc path thực tế.",
      });
    }
    if (
      !Number.isFinite(metadata.timestamp) ||
      Math.abs(Date.now() - metadata.timestamp) > this.maxClockSkewMs
    ) {
      throw new BadRequestException({
        code: "REQUEST_EXPIRED",
        message: "Timestamp request nằm ngoài cửa sổ cho phép.",
      });
    }
    if (!metadata.requestId || !metadata.nonce || !metadata.clientKeyId) {
      throw new BadRequestException({
        code: "AAD_INVALID",
        message: "AAD thiếu requestId, nonce hoặc clientKeyId.",
      });
    }
    if (
      protocol === SECURE_ENVELOPE_V2_HEADER_VALUE &&
      !protectedHeadersMatch(
        (metadata as JweRequestMetadata).boundHeaders,
        protectedHeaders,
      )
    ) {
      throw new BadRequestException({
        code: "BOUND_HEADER_MISMATCH",
        message: "CSRF hoặc idempotency header không khớp metadata đã mã hóa.",
      });
    }

    const clientPublicKey = await importRsaPublicJwk(metadata.clientPublicKey);
    assertStrongClientKey(clientPublicKey);
    const clientFingerprint = await fingerprintPublicKey(clientPublicKey);
    if (clientFingerprint !== metadata.clientKeyId) {
      throw new BadRequestException({
        code: "CLIENT_KEY_ID_MISMATCH",
        message: "clientKeyId không khớp public key trong AAD.",
      });
    }
    this.replayCache.consume(metadata.clientKeyId, metadata.nonce);

    const contextBase = {
      requestId: metadata.requestId,
      requestNonce: metadata.nonce,
      clientKeyId: metadata.clientKeyId,
      clientPublicJwk: metadata.clientPublicKey,
      clientPublicKey,
    };
    return {
      body: decrypted.body,
      context:
        protocol === SECURE_ENVELOPE_V1_HEADER_VALUE
          ? {
              ...contextBase,
              protocol: SECURE_ENVELOPE_V1_HEADER_VALUE,
              aad: metadata as RequestAad,
            }
          : {
              ...contextBase,
              protocol: SECURE_ENVELOPE_V2_HEADER_VALUE,
              metadata: metadata as JweRequestMetadata,
            },
    };
  }

  async encryptOutgoing<T>(
    context: SecureRequestContext,
    body: T,
    statusCode: number,
  ): Promise<EncryptedEnvelope<ResponseAad> | FlattenedJweEnvelope> {
    if (context.protocol === SECURE_ENVELOPE_V2_HEADER_VALUE) {
      if (!this.signingPrivateKey) {
        throw new ServiceUnavailableException("Signing key chưa sẵn sàng.");
      }
      return encryptJweResponse({
        clientPublicKey: context.clientPublicKey,
        clientKeyId: context.clientKeyId,
        serverKeyId: this.keyId,
        signingPrivateKey: this.signingPrivateKey,
        signingKeyId: this.signingKeyId,
        requestId: context.requestId,
        requestNonce: context.requestNonce,
        statusCode,
        body,
      });
    }
    return encryptResponseEnvelope({
      clientPublicKey: context.clientPublicKey,
      serverKeyId: this.keyId,
      requestId: context.requestId,
      requestNonce: context.requestNonce,
      statusCode,
      body,
    });
  }

  private ensureKeyFiles(): void {
    this.ensureKeyPair(this.privateKeyPath, this.publicKeyPath, "encryption");
    this.ensureKeyPair(
      this.signingPrivateKeyPath,
      this.signingPublicKeyPath,
      "signing",
    );
  }

  private ensureKeyPair(
    privatePath: string,
    publicPath: string,
    purpose: string,
  ): void {
    const hasPrivate = existsSync(privatePath);
    const hasPublic = existsSync(publicPath);
    if (hasPrivate && hasPublic) return;
    if (hasPrivate !== hasPublic) {
      throw new Error(
        `RSA ${purpose} key pair không đầy đủ; không tự ghi đè key đang tồn tại.`,
      );
    }
    if (
      !this.autoGenerate ||
      this.config.get<string>("NODE_ENV") === "production"
    ) {
      throw new Error(
        `Không tìm thấy RSA ${purpose} key tại ${privatePath} và ${publicPath}. ` +
          "Tạo key bằng npm run crypto:keys hoặc cấu hình secret manager.",
      );
    }
    mkdirSync(dirname(privatePath), { recursive: true, mode: 0o700 });
    mkdirSync(dirname(publicPath), { recursive: true, mode: 0o700 });
    const { privateKey, publicKey } = generateKeyPairSync("rsa", {
      modulusLength: this.rsaBits,
      publicExponent: 0x10001,
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
      publicKeyEncoding: { type: "spki", format: "pem" },
    });
    writeFileSync(privatePath, privateKey, { mode: 0o600 });
    writeFileSync(publicPath, publicKey, { mode: 0o644 });
    this.logger.warn(
      `Đã tự tạo RSA ${purpose} key cho development. Không dùng cơ chế này trong production.`,
    );
  }
}

function assertStrongClientKey(key: CryptoKey): void {
  const algorithm = key.algorithm as RsaHashedKeyAlgorithm;
  const exponent = Array.from(algorithm.publicExponent ?? []);
  if (
    algorithm.name !== "RSA-OAEP" ||
    algorithm.modulusLength < 2_048 ||
    algorithm.modulusLength > 8_192 ||
    exponent.length !== 3 ||
    exponent[0] !== 1 ||
    exponent[1] !== 0 ||
    exponent[2] !== 1
  ) {
    throw new BadRequestException({
      code: "CLIENT_KEY_INVALID",
      message:
        "Client RSA key phải từ 2048 đến 8192 bit và dùng public exponent 65537.",
    });
  }
}

function protectedHeadersMatch(
  expected: ProtectedRequestHeaders,
  actual: ProtectedRequestHeaders,
): boolean {
  return (
    (expected.csrfToken ?? undefined) === (actual.csrfToken ?? undefined) &&
    (expected.idempotencyKey ?? undefined) ===
      (actual.idempotencyKey ?? undefined)
  );
}

function absolutePath(value: string): string {
  return isAbsolute(value) ? value : resolve(process.cwd(), value);
}

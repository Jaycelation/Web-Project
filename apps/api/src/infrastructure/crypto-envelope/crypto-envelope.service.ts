import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CONTENT_ENCRYPTION,
  CryptoServerKeyDescriptor,
  EncryptedEnvelope,
  RequestAad,
  ResponseAad,
  RSA_ALGORITHM,
  SECURE_ENVELOPE_VERSION,
  decryptRequestEnvelope,
  encryptResponseEnvelope,
  exportRsaPublicJwk,
  fingerprintPublicKey,
  importRsaPrivateKeyPem,
  importRsaPublicJwk,
  importRsaPublicKeyPem,
  normalizeApiPath,
} from '@secure-commerce/crypto-envelope';
import { generateKeyPairSync } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import { ReplayCacheService } from './replay-cache.service.js';
import type { SecureRequestContext } from './crypto-envelope.types.js';

@Injectable()
export class CryptoEnvelopeService implements OnModuleInit {
  private readonly logger = new Logger(CryptoEnvelopeService.name);
  private readonly keyId: string;
  private readonly privateKeyPath: string;
  private readonly publicKeyPath: string;
  private readonly autoGenerate: boolean;
  private readonly rsaBits: number;
  private readonly maxClockSkewMs: number;
  private privateKey: CryptoKey | undefined;
  private publicKey: CryptoKey | undefined;
  private descriptor: CryptoServerKeyDescriptor | undefined;

  constructor(
    private readonly config: ConfigService,
    private readonly replayCache: ReplayCacheService,
  ) {
    this.keyId = config.get<string>('CRYPTO_KEY_ID', 'dev-rsa-2026-01');
    this.privateKeyPath = absolutePath(
      config.get<string>('CRYPTO_PRIVATE_KEY_PATH', 'apps/api/.local/keys/server-private.pem'),
    );
    this.publicKeyPath = absolutePath(
      config.get<string>('CRYPTO_PUBLIC_KEY_PATH', 'apps/api/.local/keys/server-public.pem'),
    );
    this.autoGenerate = config.get<string>('CRYPTO_AUTO_GENERATE', 'false') === 'true';
    this.rsaBits = Number(config.get<string>('CRYPTO_RSA_BITS', '3072'));
    this.maxClockSkewMs = Number(config.get<string>('CRYPTO_MAX_CLOCK_SKEW_MS', '120000'));
  }

  async onModuleInit(): Promise<void> {
    this.ensureKeyFiles();
    const privatePem = readFileSync(this.privateKeyPath, 'utf8');
    const publicPem = readFileSync(this.publicKeyPath, 'utf8');
    this.privateKey = await importRsaPrivateKeyPem(privatePem);
    this.publicKey = await importRsaPublicKeyPem(publicPem);
    const publicKeyJwk = await exportRsaPublicJwk(this.publicKey);
    const fingerprintSha256 = await fingerprintPublicKey(this.publicKey);
    this.descriptor = {
      version: SECURE_ENVELOPE_VERSION,
      keyId: this.keyId,
      publicKey: publicKeyJwk,
      fingerprintSha256,
      algorithm: RSA_ALGORITHM,
      contentEncryption: CONTENT_ENCRYPTION,
      expiresAt: null,
    };
    this.logger.log(`Hybrid encryption sẵn sàng: ${this.keyId}, SHA-256 ${fingerprintSha256}.`);
  }

  getServerKeyDescriptor(): CryptoServerKeyDescriptor {
    if (!this.descriptor) throw new ServiceUnavailableException('Crypto key chưa sẵn sàng.');
    return this.descriptor;
  }

  async decryptIncoming(
    envelope: EncryptedEnvelope<RequestAad>,
    method: string,
    path: string,
  ): Promise<{ body: unknown; context: SecureRequestContext }> {
    if (!this.privateKey || !this.descriptor) {
      throw new ServiceUnavailableException('Crypto service chưa sẵn sàng.');
    }
    if (envelope.keyId !== this.keyId) {
      throw new ConflictException({
        code: 'SERVER_KEY_ROTATED',
        message: 'Server key đã thay đổi; hãy tải lại public key.',
        activeKeyId: this.keyId,
      });
    }

    const decrypted = await decryptRequestEnvelope<unknown>(envelope, this.privateKey);
    const aad = decrypted.aad;
    const normalizedMethod = method.toUpperCase();
    const normalizedPath = normalizeApiPath(path);
    if (aad.method !== normalizedMethod || aad.path !== normalizedPath) {
      throw new BadRequestException({
        code: 'AAD_ROUTE_MISMATCH',
        message: 'AAD không khớp HTTP method hoặc path thực tế.',
      });
    }
    if (!Number.isFinite(aad.timestamp) || Math.abs(Date.now() - aad.timestamp) > this.maxClockSkewMs) {
      throw new BadRequestException({
        code: 'REQUEST_EXPIRED',
        message: 'Timestamp request nằm ngoài cửa sổ cho phép.',
      });
    }
    if (!aad.requestId || !aad.nonce || !aad.clientKeyId) {
      throw new BadRequestException({ code: 'AAD_INVALID', message: 'AAD thiếu requestId, nonce hoặc clientKeyId.' });
    }

    const clientPublicKey = await importRsaPublicJwk(aad.clientPublicKey);
    const clientFingerprint = await fingerprintPublicKey(clientPublicKey);
    if (clientFingerprint !== aad.clientKeyId) {
      throw new BadRequestException({
        code: 'CLIENT_KEY_ID_MISMATCH',
        message: 'clientKeyId không khớp public key trong AAD.',
      });
    }
    this.replayCache.consume(aad.clientKeyId, aad.nonce);

    return {
      body: decrypted.body,
      context: {
        requestId: aad.requestId,
        requestNonce: aad.nonce,
        clientKeyId: aad.clientKeyId,
        clientPublicJwk: aad.clientPublicKey,
        clientPublicKey,
        aad,
      },
    };
  }

  async encryptOutgoing<T>(
    context: SecureRequestContext,
    body: T,
    statusCode: number,
  ): Promise<EncryptedEnvelope<ResponseAad>> {
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
    if (existsSync(this.privateKeyPath) && existsSync(this.publicKeyPath)) return;
    if (!this.autoGenerate || this.config.get<string>('NODE_ENV') === 'production') {
      throw new Error(
        `Không tìm thấy RSA key tại ${this.privateKeyPath} và ${this.publicKeyPath}. ` +
          'Tạo key bằng npm run crypto:keys hoặc cấu hình secret manager.',
      );
    }
    mkdirSync(dirname(this.privateKeyPath), { recursive: true, mode: 0o700 });
    mkdirSync(dirname(this.publicKeyPath), { recursive: true, mode: 0o700 });
    const { privateKey, publicKey } = generateKeyPairSync('rsa', {
      modulusLength: this.rsaBits,
      publicExponent: 0x10001,
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      publicKeyEncoding: { type: 'spki', format: 'pem' },
    });
    writeFileSync(this.privateKeyPath, privateKey, { mode: 0o600 });
    writeFileSync(this.publicKeyPath, publicKey, { mode: 0o644 });
    this.logger.warn('Đã tự tạo RSA key cho môi trường phát triển. Không dùng cơ chế này trong production.');
  }
}

function absolutePath(value: string): string {
  return isAbsolute(value) ? value : resolve(process.cwd(), value);
}

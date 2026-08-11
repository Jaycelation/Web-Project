import { ConflictException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ReplayCacheService {
  private readonly entries = new Map<string, number>();
  private readonly ttlMs: number;
  private readonly maxEntries = 100_000;

  constructor(config: ConfigService) {
    this.ttlMs = Number(config.get<string>('CRYPTO_REPLAY_TTL_MS', '180000'));
  }

  consume(clientKeyId: string, nonce: string, now = Date.now()): void {
    this.prune(now);
    const key = `${clientKeyId}:${nonce}`;
    const expiresAt = this.entries.get(key);
    if (expiresAt && expiresAt > now) {
      throw new ConflictException({
        code: 'REPLAY_DETECTED',
        message: 'Request nonce đã được sử dụng.',
      });
    }
    if (this.entries.size >= this.maxEntries) {
      const firstKey = this.entries.keys().next().value as string | undefined;
      if (firstKey) this.entries.delete(firstKey);
    }
    this.entries.set(key, now + this.ttlMs);
  }

  private prune(now: number): void {
    for (const [key, expiresAt] of this.entries) {
      if (expiresAt > now) break;
      this.entries.delete(key);
    }
  }
}

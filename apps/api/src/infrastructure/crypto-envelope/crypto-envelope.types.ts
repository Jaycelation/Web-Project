import type { RequestAad, RsaPublicJwk } from '@secure-commerce/crypto-envelope';

export interface SecureRequestContext {
  requestId: string;
  requestNonce: string;
  clientKeyId: string;
  clientPublicJwk: RsaPublicJwk;
  clientPublicKey: CryptoKey;
  aad: RequestAad;
}

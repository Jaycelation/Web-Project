import type {
  JweRequestMetadata,
  RequestAad,
  RsaPublicJwk,
  SecureEnvelopeProtocol,
} from "@secure-commerce/crypto-envelope";

interface SecureRequestContextBase {
  protocol: SecureEnvelopeProtocol;
  requestId: string;
  requestNonce: string;
  clientKeyId: string;
  clientPublicJwk: RsaPublicJwk;
  clientPublicKey: CryptoKey;
}

export interface SecureRequestContextV1 extends SecureRequestContextBase {
  protocol: "v1";
  aad: RequestAad;
}

export interface SecureRequestContextV2 extends SecureRequestContextBase {
  protocol: "v2";
  metadata: JweRequestMetadata;
}

export type SecureRequestContext =
  SecureRequestContextV1 | SecureRequestContextV2;

import { generateKeyPairSync } from 'node:crypto';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const privatePath = resolve(process.env.CRYPTO_PRIVATE_KEY_PATH || 'apps/api/.local/keys/server-private.pem');
const publicPath = resolve(process.env.CRYPTO_PUBLIC_KEY_PATH || 'apps/api/.local/keys/server-public.pem');
const modulusLength = Number.parseInt(process.env.CRYPTO_RSA_BITS || '3072', 10);
const force = process.argv.includes('--force');

if (!force && (existsSync(privatePath) || existsSync(publicPath))) {
  console.error('Key đã tồn tại. Dùng --force để xoay key có chủ đích.');
  process.exit(1);
}

mkdirSync(dirname(privatePath), { recursive: true, mode: 0o700 });
mkdirSync(dirname(publicPath), { recursive: true, mode: 0o700 });

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength,
  publicExponent: 0x10001,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});

writeFileSync(privatePath, privateKey, { mode: 0o600 });
writeFileSync(publicPath, publicKey, { mode: 0o644 });
console.log(`Đã tạo RSA-${modulusLength}:`);
console.log(`- Private: ${privatePath}`);
console.log(`- Public : ${publicPath}`);

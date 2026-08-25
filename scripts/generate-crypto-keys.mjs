import { generateKeyPairSync } from "node:crypto";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";

const modulusLength = Number.parseInt(
  process.env.CRYPTO_RSA_BITS || "3072",
  10,
);
const force = process.argv.includes("--force");
const keyPairs = [
  {
    purpose: "encryption",
    privatePath: resolve(
      process.env.CRYPTO_PRIVATE_KEY_PATH ||
        "apps/api/.local/keys/server-private.pem",
    ),
    publicPath: resolve(
      process.env.CRYPTO_PUBLIC_KEY_PATH ||
        "apps/api/.local/keys/server-public.pem",
    ),
  },
  {
    purpose: "signing",
    privatePath: resolve(
      process.env.CRYPTO_SIGNING_PRIVATE_KEY_PATH ||
        "apps/api/.local/keys/server-signing-private.pem",
    ),
    publicPath: resolve(
      process.env.CRYPTO_SIGNING_PUBLIC_KEY_PATH ||
        "apps/api/.local/keys/server-signing-public.pem",
    ),
  },
];

if (
  !Number.isInteger(modulusLength) ||
  modulusLength < 2_048 ||
  modulusLength > 8_192
) {
  console.error("CRYPTO_RSA_BITS phải là số nguyên từ 2048 đến 8192.");
  process.exit(1);
}

for (const pair of keyPairs) {
  const hasPrivate = existsSync(pair.privatePath);
  const hasPublic = existsSync(pair.publicPath);
  if (!force && hasPrivate !== hasPublic) {
    console.error(
      `Key pair ${pair.purpose} không đầy đủ; từ chối ghi đè file đang tồn tại.`,
    );
    process.exit(1);
  }
  if (!force && hasPrivate && hasPublic) {
    console.log(`Bỏ qua ${pair.purpose}: key pair đã tồn tại.`);
    continue;
  }

  mkdirSync(dirname(pair.privatePath), { recursive: true, mode: 0o700 });
  mkdirSync(dirname(pair.publicPath), { recursive: true, mode: 0o700 });

  const { privateKey, publicKey } = generateKeyPairSync("rsa", {
    modulusLength,
    publicExponent: 0x10001,
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
    publicKeyEncoding: { type: "spki", format: "pem" },
  });

  writeFileSync(pair.privatePath, privateKey, { mode: 0o600 });
  writeFileSync(pair.publicPath, publicKey, { mode: 0o644 });
  console.log(`Đã tạo RSA-${modulusLength} ${pair.purpose}:`);
  console.log(`- Private: ${pair.privatePath}`);
  console.log(`- Public : ${pair.publicPath}`);
}

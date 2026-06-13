// Deterministic R2 verification — confirms credentials, bucket, and public URL
// work, independent of the app (no auth needed).
//
// Usage (vars from .env or your shell):
//   node scripts/verify-r2.mjs
//
// PowerShell, setting vars inline first:
//   $env:R2_ACCOUNT_ID="..."; $env:R2_ACCESS_KEY_ID="..."; $env:R2_SECRET_ACCESS_KEY="..."
//   $env:R2_BUCKET="..."; $env:R2_PUBLIC_URL="https://pub-xxxx.r2.dev"
//   node scripts/verify-r2.mjs

import "dotenv/config";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const {
  R2_ACCOUNT_ID,
  R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY,
  R2_BUCKET,
  R2_PUBLIC_URL,
} = process.env;

function fail(msg) {
  console.error(`\n❌ ${msg}`);
  process.exit(1);
}

if (!R2_ACCOUNT_ID) fail("R2_ACCOUNT_ID is not set.");
if (!R2_ACCESS_KEY_ID) fail("R2_ACCESS_KEY_ID is not set.");
if (!R2_SECRET_ACCESS_KEY) fail("R2_SECRET_ACCESS_KEY is not set.");
if (!R2_BUCKET) fail("R2_BUCKET is not set.");

const client = new S3Client({
  region: "auto",
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

const key = `healthcheck/verify-${Date.now()}.txt`;
const body = `R2 verification at ${new Date().toISOString()}`;

console.log(`→ Uploading test object to bucket "${R2_BUCKET}" as ${key} ...`);
try {
  await client.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: body,
      ContentType: "text/plain",
    })
  );
  console.log("✅ Upload OK — account id, credentials, and bucket are all valid.");
} catch (e) {
  fail(`Upload failed: ${e.name} — ${e.message}`);
}

if (!R2_PUBLIC_URL) {
  console.log(
    "\n⚠️  R2_PUBLIC_URL not set — skipping the public-read check.\n" +
      "   Set it (the bucket's r2.dev URL or a custom domain) so stored files are viewable."
  );
  process.exit(0);
}

const url = `${R2_PUBLIC_URL.replace(/\/+$/, "")}/${key}`;
console.log(`→ Fetching public URL: ${url}`);
try {
  const res = await fetch(url);
  const text = await res.text();
  if (res.ok && text === body) {
    console.log("✅ Public read OK — R2_PUBLIC_URL is correct and the bucket is public.");
    console.log("\n🎉 R2 is fully configured and working.");
  } else {
    fail(
      `Public read returned HTTP ${res.status}. Enable public access on the bucket ` +
        `and make sure R2_PUBLIC_URL is the bucket's public domain.`
    );
  }
} catch (e) {
  fail(`Public fetch failed: ${e.message}`);
}

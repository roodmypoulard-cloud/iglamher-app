import { NextResponse } from "next/server";

// Android App Links association. Rewritten to /.well-known/assetlinks.json in
// next.config. Set ANDROID_PACKAGE + ANDROID_SHA256 (signing cert fingerprint).
export const dynamic = "force-static";

export function GET() {
  const packageName = process.env.ANDROID_PACKAGE ?? "com.iglamher.app";
  const fingerprint = process.env.ANDROID_SHA256 ?? "REPLACE_WITH_SHA256_CERT_FINGERPRINT";
  return NextResponse.json(
    [
      {
        relation: ["delegate_permission/common.handle_all_urls"],
        target: { namespace: "android_app", package_name: packageName, sha256_cert_fingerprints: [fingerprint] },
      },
    ],
    { headers: { "content-type": "application/json" } },
  );
}

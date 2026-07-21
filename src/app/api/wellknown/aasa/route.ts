import { NextResponse } from "next/server";

// Apple Universal Links association. Rewritten to /.well-known/apple-app-site-association
// in next.config. Set APPLE_APP_ID = "<TEAMID>.com.iglamher.app".
export const dynamic = "force-static";

export function GET() {
  const appID = process.env.APPLE_APP_ID ?? "TEAMID.com.iglamher.app";
  return NextResponse.json(
    {
      applinks: {
        apps: [],
        details: [
          { appID, paths: ["/discover", "/professionals/*", "/services/*", "/book/*", "/categories/*", "/account/*", "/messages/*"] },
        ],
      },
      webcredentials: { apps: [appID] },
    },
    { headers: { "content-type": "application/json" } },
  );
}

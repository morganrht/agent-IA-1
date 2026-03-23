import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const baseUrl = (process.env.NEXTAUTH_URL || req.nextUrl.origin).trim().replace(/\/$/, "");
  const redirectUri = `${baseUrl}/api/auth/google/callback`;

  return NextResponse.json({
    NEXTAUTH_URL: process.env.NEXTAUTH_URL || "(non défini)",
    request_origin: req.nextUrl.origin,
    redirect_uri_used: redirectUri,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID ? process.env.GOOGLE_CLIENT_ID.slice(0, 20) + "..." : "(manquant)",
    message: "Ajoute exactement 'redirect_uri_used' dans Google Console → Authorized redirect URIs",
  });
}

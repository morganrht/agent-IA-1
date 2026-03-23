import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const error = req.nextUrl.searchParams.get("error");
  const stateB64 = req.nextUrl.searchParams.get("state");

  if (error || !code) {
    return NextResponse.redirect(new URL(`/settings?auth_error=${error || "unknown"}`, req.nextUrl.origin));
  }

  // Recover the exact redirect_uri that was used in the auth request
  let redirectUri: string;
  try {
    redirectUri = stateB64 ? Buffer.from(stateB64, "base64").toString() : "";
  } catch {
    redirectUri = "";
  }

  // Fallback: reconstruct from env or origin
  if (!redirectUri) {
    const baseUrl = (process.env.NEXTAUTH_URL || req.nextUrl.origin).trim().replace(/\/$/, "");
    redirectUri = `${baseUrl}/api/auth/google/callback`;
  }

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  const tokens = await tokenRes.json();

  if (tokens.error || !tokens.access_token) {
    const msg = encodeURIComponent(tokens.error_description || tokens.error || "token_error");
    return NextResponse.redirect(new URL(`/settings?auth_error=${msg}`, req.nextUrl.origin));
  }

  const cookieStore = await cookies();
  const opts = { httpOnly: true, sameSite: "lax" as const, path: "/", secure: process.env.NODE_ENV === "production" };

  cookieStore.set("g_access_token", tokens.access_token, { ...opts, maxAge: 3600 });
  if (tokens.refresh_token) {
    cookieStore.set("g_refresh_token", tokens.refresh_token, { ...opts, maxAge: 30 * 24 * 3600 });
  }

  return NextResponse.redirect(new URL("/calendar?connected=google", req.nextUrl.origin));
}

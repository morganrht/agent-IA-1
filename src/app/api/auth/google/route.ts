import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  // Use canonical URL from env, fallback to request origin
  const baseUrl = (process.env.NEXTAUTH_URL || req.nextUrl.origin).trim().replace(/\/$/, "");
  const redirectUri = `${baseUrl}/api/auth/google/callback`;

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: [
      "https://www.googleapis.com/auth/calendar",
      "https://www.googleapis.com/auth/calendar.events",
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/gmail.send",
      "https://www.googleapis.com/auth/gmail.modify",
      "https://www.googleapis.com/auth/userinfo.email",
    ].join(" "),
    access_type: "offline",
    prompt: "consent",
    // Store redirect_uri in state so callback uses the exact same one
    state: Buffer.from(redirectUri).toString("base64"),
  });

  return NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params}`
  );
}

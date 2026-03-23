import { cookies } from "next/headers";

export async function getGoogleToken(): Promise<string | null> {
  const cookieStore = await cookies();
  const access = cookieStore.get("g_access_token")?.value;
  if (access) return access;

  // Try refresh
  const refresh = cookieStore.get("g_refresh_token")?.value;
  if (!refresh) return null;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: refresh,
      grant_type: "refresh_token",
    }),
  });

  const data = await res.json();
  if (!data.access_token) return null;

  cookieStore.set("g_access_token", data.access_token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 3600,
  });

  return data.access_token;
}

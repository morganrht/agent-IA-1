import { NextRequest, NextResponse } from "next/server";
import { getGoogleToken } from "@/lib/googleAuth";

export async function GET() {
  const token = await getGoogleToken();
  if (!token) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const now = new Date().toISOString();
  const future = new Date(Date.now() + 60 * 24 * 3600 * 1000).toISOString();

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${now}&timeMax=${future}&singleEvents=true&orderBy=startTime&maxResults=100`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  const data = await res.json();
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const token = await getGoogleToken();
  if (!token) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const body = await req.json();
  const res = await fetch(
    "https://www.googleapis.com/calendar/v3/calendars/primary/events",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );

  const data = await res.json();
  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest) {
  const token = await getGoogleToken();
  if (!token) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const { eventId } = await req.json();
  await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
    { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }
  );

  return NextResponse.json({ ok: true });
}

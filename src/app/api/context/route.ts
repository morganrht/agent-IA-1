import { NextResponse } from "next/server";
import { getGoogleToken } from "@/lib/googleAuth";

export async function GET() {
  const token = await getGoogleToken();
  if (!token) return NextResponse.json({ connected: false });

  const now = new Date().toISOString();
  const in30days = new Date(Date.now() + 30 * 86400000).toISOString();

  const [calRes, mailListRes] = await Promise.all([
    fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?maxResults=30&orderBy=startTime&singleEvents=true&timeMin=${now}&timeMax=${in30days}`,
      { headers: { Authorization: `Bearer ${token}` } }
    ),
    fetch(
      `https://www.googleapis.com/gmail/v1/users/me/messages?q=in:inbox&maxResults=20`,
      { headers: { Authorization: `Bearer ${token}` } }
    ),
  ]);

  const calData = await calRes.json();
  const mailList = await mailListRes.json();

  let emails: object[] = [];
  if (mailList.messages?.length > 0) {
    emails = await Promise.all(
      mailList.messages.slice(0, 20).map(async (m: { id: string }) => {
        const r = await fetch(
          `https://www.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const d = await r.json();
        const h = d.payload?.headers || [];
        const get = (name: string) => h.find((x: { name: string; value: string }) => x.name.toLowerCase() === name.toLowerCase())?.value || "";
        const from = get("From");
        const nameMatch = from.match(/^"?([^"<]+)"?\s*<?/);
        const fromName = nameMatch ? nameMatch[1].trim() : from.split("@")[0];
        const dateStr = get("Date");
        let dateRelative = "";
        try {
          const dt = new Date(dateStr);
          const diffH = (Date.now() - dt.getTime()) / 3600000;
          if (diffH < 24) dateRelative = `aujourd'hui ${dt.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;
          else if (diffH < 48) dateRelative = "hier";
          else dateRelative = dt.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
        } catch {}
        return {
          id: d.id,
          from: fromName,
          fromEmail: from.match(/<(.+)>/)?.[1] || from,
          subject: get("Subject") || "(Sans objet)",
          snippet: (d.snippet || "").replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&quot;/g, '"').slice(0, 150),
          date: dateRelative,
          unread: d.labelIds?.includes("UNREAD") || false,
        };
      })
    );
  }

  return NextResponse.json({
    connected: true,
    events: (calData.items || []).map((e: {
      id?: string;
      summary?: string;
      start?: { dateTime?: string; date?: string };
      end?: { dateTime?: string; date?: string };
      location?: string;
      description?: string;
    }) => ({
      id: e.id,
      summary: e.summary || "(Sans titre)",
      start: e.start?.dateTime || e.start?.date || "",
      end: e.end?.dateTime || e.end?.date || "",
      location: e.location || "",
      description: (e.description || "").slice(0, 100),
    })),
    emails,
  });
}

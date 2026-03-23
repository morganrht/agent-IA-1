import { NextRequest, NextResponse } from "next/server";
import { getGoogleToken } from "@/lib/googleAuth";

// List messages
export async function GET(req: NextRequest) {
  const token = await getGoogleToken();
  if (!token) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const q = req.nextUrl.searchParams.get("q") || "in:inbox";
  const maxResults = req.nextUrl.searchParams.get("max") || "20";

  // Get message IDs
  const listRes = await fetch(
    `https://www.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(q)}&maxResults=${maxResults}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const listData = await listRes.json();
  if (!listData.messages) return NextResponse.json({ messages: [] });

  // Fetch each message in parallel (limited batch)
  const details = await Promise.all(
    listData.messages.slice(0, 20).map(async (m: { id: string }) => {
      const r = await fetch(
        `https://www.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      return r.json();
    })
  );

  return NextResponse.json({ messages: details });
}

// Modify (archive/trash/star)
export async function PATCH(req: NextRequest) {
  const token = await getGoogleToken();
  if (!token) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const { messageId, action } = await req.json();

  let body: object = {};
  if (action === "archive") body = { removeLabelIds: ["INBOX"] };
  else if (action === "trash") body = { addLabelIds: ["TRASH"], removeLabelIds: ["INBOX"] };
  else if (action === "unread") body = { addLabelIds: ["UNREAD"] };
  else if (action === "read") body = { removeLabelIds: ["UNREAD"] };
  else if (action === "star") body = { addLabelIds: ["STARRED"] };
  else if (action === "unstar") body = { removeLabelIds: ["STARRED"] };

  const res = await fetch(
    `https://www.googleapis.com/gmail/v1/users/me/messages/${messageId}/modify`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );

  return NextResponse.json(await res.json());
}

// Send email
export async function POST(req: NextRequest) {
  const token = await getGoogleToken();
  if (!token) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const { to, subject, body, threadId } = await req.json();

  const emailLines = [
    `To: ${to}`,
    `Subject: ${subject}`,
    "Content-Type: text/plain; charset=utf-8",
    "",
    body,
  ];
  const raw = btoa(emailLines.join("\r\n")).replace(/\+/g, "-").replace(/\//g, "_");

  const res = await fetch("https://www.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ raw, ...(threadId ? { threadId } : {}) }),
  });

  return NextResponse.json(await res.json());
}

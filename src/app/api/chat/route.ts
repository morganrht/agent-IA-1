import { NextRequest } from "next/server";

// Sanitize messages so no empty/null content reaches the AI APIs
function cleanMessages(raw: unknown[]) {
  return raw
    .filter((m: any) => m && m.role && m.content != null)
    .map((m: any) => ({
      role: String(m.role),
      content: String(m.content || " ").trim() || " ",
    }));
}

export async function POST(req: NextRequest) {
  const { messages: rawMessages } = await req.json();
  const messages = cleanMessages(rawMessages || []);

  if (!messages.length) {
    return new Response("data: [DONE]\n\n", { headers: { "Content-Type": "text/event-stream" } });
  }

  // ── Mistral ──────────────────────────────────────────────────────────────
  if (process.env.MISTRAL_API_KEY?.trim()) {
    const res = await fetch("https://api.mistral.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.MISTRAL_API_KEY.trim()}`,
      },
      body: JSON.stringify({
        model: "mistral-small-latest",
        messages,
        stream: true,
        max_tokens: 2048,
        temperature: 0.72,
      }),
    });

    if (!res.ok || !res.body) {
      const errText = await res.text();
      const fallback = `data: ${JSON.stringify({ text: "⚠️ Erreur Mistral : " + errText.slice(0, 200) })}\ndata: [DONE]\n\n`;
      return new Response(fallback, { headers: { "Content-Type": "text/event-stream" } });
    }

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        const reader = res.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";
            for (const line of lines) {
              if (!line.startsWith("data: ")) continue;
              const data = line.slice(6).trim();
              if (data === "[DONE]") { controller.enqueue(encoder.encode("data: [DONE]\n\n")); continue; }
              try {
                const parsed = JSON.parse(data);
                const text = parsed.choices?.[0]?.delta?.content || "";
                if (text) controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
              } catch {}
            }
          }
        } finally {
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
    });
  }

  // ── Groq fallback ────────────────────────────────────────────────────────
  const { default: Groq } = await import("groq-sdk");
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

  const stream = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: messages as any,
    stream: true,
    max_tokens: 2048,
    temperature: 0.72,
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        const text = chunk.choices[0]?.delta?.content || "";
        if (text) controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
      }
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });

  return new Response(readable, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
  });
}

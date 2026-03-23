import { NextRequest } from "next/server";

type TextPart = { type: "text"; text: string };
type ImagePart = { type: "image_url"; image_url: { url: string } };
type MsgContent = string | Array<TextPart | ImagePart>;
type MistralMsg = { role: string; content: MsgContent };

/**
 * Build a truly human-like system prompt for the assistant
 */
function buildSystemPrompt(contextData: any): string {
  const now = new Date();
  const timeStr = now.toLocaleString("fr-FR", { 
    hour: "2-digit", 
    minute: "2-digit" 
  });

  let context = "";

  // Calendar events
  if (contextData?.events?.length) {
    const upcoming = contextData.events.slice(0, 3);
    context += "\n📅 Prochains événements:\n";
    upcoming.forEach((e: any) => {
      const start = new Date(e.start).toLocaleString("fr-FR", { weekday: "short", hour: "2-digit", minute: "2-digit" });
      context += `• ${e.summary} (${start})`;
      if (e.location) context += ` @ ${e.location}`;
      context += "\n";
    });
  }

  // Unread emails
  if (contextData?.emails?.length) {
    const unread = contextData.emails.filter((e: any) => e.unread).slice(0, 2);
    if (unread.length > 0) {
      context += "\n📧 Mails non lus:\n";
      unread.forEach((e: any) => {
        context += `• ${e.from}: "${e.subject}"\n`;
      });
    }
  }

  return `Tu es l'assistant personnel de Morgan. Ton rôle: aider à sa journée de travail.

PERSONNALITÉ - IMPORTANT:
• Sois natural et conversationnel. Parle comme une vraie personne.
• Sois respectueux et professionnel. Jamais condescendant.
• Être direct et concis. 1-2 phrases max par réponse (sauf si demandé).
• Ne sois PAS un robot. Pas de listes à moins que demandé.
• Tu peux être sympathique, parfois drôle, mais dans les limites du professionnel.

CAPACITÉS:
1️⃣ CONVERSATION: Parker naturel comme un collègue ou secrétaire
2️⃣ VISION: Si Morgan partage l'écran, tu vois ce qu'il montre et tu en parles
3️⃣ ACTIONS: Tu peux créer des notes, des événements, envoyer des mails
4️⃣ CONTEXTE: Tu as accès à son calendrier, mails, notes

CONTEXTE ACTUEL:
• Heure: ${timeStr}${context}

ACTIONS (utilise seulement si nécessaire):
ACTION:CREATE_NOTE:{"title":"...","content":"..."}
ACTION:ADD_EVENT:{"title":"...","date":"YYYY-MM-DD","time":"HH:MM","endTime":"HH:MM"}
ACTION:SEND_EMAIL:{"to":"...","subject":"...","body":"..."}

RÈGLES DÉCISIVES:
✓ Sois bref, Morgan peut t'interrompre n'importe quand
✓ Si tu partages l'écran de Morgan, analyse-le avant de répondre
✓ Ne juge jamais, aide simplement
✓ Demande clarification si incertitude au lieu de deviner
✓ Reste dans le contexte professionnel et personnel de Morgan
✓ Pas de blabla inutile

Allez, parlons. Comment je peux t'aider?`;
}

/**
 * Build Mistral messages with screen frame
 */
function buildMistralMessages(
  history: { role: string; content: string }[],
  screenFrame: string | null
): MistralMsg[] {
  const out: MistralMsg[] = [];
  
  for (let i = 0; i < history.length; i++) {
    const m = history[i];
    
    if (m.role === "user" && i === history.length - 1 && screenFrame) {
      out.push({
        role: "user",
        content: [
          { type: "text", text: m.content },
          { 
            type: "image_url", 
            image_url: { url: `data:image/jpeg;base64,${screenFrame}` } 
          },
        ],
      });
    } else {
      out.push({ role: m.role, content: m.content });
    }
  }
  
  return out;
}

/**
 * Main API handler - Stream responses from Mistral
 */
export async function POST(req: NextRequest) {
  const { messages: rawMessages, screenFrame, contexData: contextData } = await req.json();

  const apiKey = process.env.MISTRAL_API_KEY?.trim();
  if (!apiKey) {
    return new Response(
      `data: ${JSON.stringify({ text: "Clé API manquante. Désolé." })}\ndata: [DONE]\n\n`,
      { headers: { "Content-Type": "text/event-stream" } }
    );
  }

  // Normalize messages
  const messages: { role: string; content: string }[] = (rawMessages || [])
    .filter((m: any) => m && m.role && m.content != null)
    .map((m: any) => ({ 
      role: String(m.role).toLowerCase(), 
      content: String(m.content).trim() || " " 
    }));

  if (!messages.length) {
    return new Response(
      `data: ${JSON.stringify({ text: "" })}\ndata: [DONE]\n\n`,
      { headers: { "Content-Type": "text/event-stream" } }
    );
  }

  // Select model based on context
  const model = screenFrame ? "pixtral-12b-2409" : "mistral-small-latest";
  
  const systemPrompt = buildSystemPrompt(contextData || {});
  const mistralMessages: MistralMsg[] = [
    { role: "system", content: systemPrompt },
    ...buildMistralMessages(messages, screenFrame || null),
  ];

  try {
    const res = await fetch("https://api.mistral.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: mistralMessages,
        stream: true,
        max_tokens: 200,  // Keep responses SHORT
        temperature: 0.8,  // More natural
        top_p: 0.95,
      }),
    });

    if (!res.ok || !res.body) {
      const err = await res.text();
      console.error("Mistral Error:", err);
      return new Response(
        `data: ${JSON.stringify({ text: "Erreur API. Réessaie." })}\ndata: [DONE]\n\n`,
        { headers: { "Content-Type": "text/event-stream" } }
      );
    }

    // Stream response
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
              if (data === "[DONE]") {
                controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                continue;
              }
              
              try {
                const parsed = JSON.parse(data);
                const text = parsed.choices?.[0]?.delta?.content || "";
                if (text) {
                  controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify({ text })}\n\n`)
                  );
                }
              } catch {}
            }
          }
        } catch (err) {
          console.error("Stream error:", err);
        } finally {
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    console.error("Request error:", err);
    return new Response(
      `data: ${JSON.stringify({ text: "Erreur. Réessaie." })}\ndata: [DONE]\n\n`,
      { headers: { "Content-Type": "text/event-stream" } }
    );
  }
}
  const out: MistralMsg[] = [];
  
  for (let i = 0; i < history.length; i++) {
    const m = history[i];
    
    // Attach screenshot only to the last user message if available
    if (m.role === "user" && i === history.length - 1 && screenFrame) {
      out.push({
        role: "user",
        content: [
          { type: "text", text: m.content },
          { 
            type: "image_url", 
            image_url: { url: `data:image/jpeg;base64,${screenFrame}` } 
          },
        ],
      });
    } else {
      out.push({ role: m.role, content: m.content });
    }
  }
  
  return out;
}

/**
 * Main handler for voice call AI responses
 */
export async function POST(req: NextRequest) {
  const { messages: rawMessages, screenFrame, contexData: contextData } = await req.json();

  const apiKey = process.env.MISTRAL_API_KEY?.trim();
  if (!apiKey) {
    return new Response(
      `data: ${JSON.stringify({ 
        text: "Erreur: API Mistral non configurée. Contacte Morgan." 
      })}\ndata: [DONE]\n\n`,
      { headers: { "Content-Type": "text/event-stream" } }
    );
  }

  // Validate and normalize messages
  const messages: { role: string; content: string }[] = (rawMessages || [])
    .filter((m: any) => m && m.role && m.content != null)
    .map((m: any) => ({ 
      role: String(m.role).toLowerCase(), 
      content: String(m.content).trim() || " " 
    }));

  if (!messages.length) {
    return new Response(
      `data: ${JSON.stringify({ text: "" })}\ndata: [DONE]\n\n`,
      { headers: { "Content-Type": "text/event-stream" } }
    );
  }

  // Choose model based on context:
  // - If there's a screen frame, use Pixtral for image analysis
  // - Otherwise use latest small model for speed
  const model = screenFrame ? "pixtral-12b-2409" : "mistral-small-latest";
  
  // Build messages with system context
  const systemPrompt = buildSystemPrompt(contextData || {});
  const mistralMessages: MistralMsg[] = [
    { role: "system", content: systemPrompt },
    ...buildMistralMessages(messages, screenFrame || null),
  ];

  try {
    const res = await fetch("https://api.mistral.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: mistralMessages,
        stream: true,
        max_tokens: 500,
        temperature: 0.7,
        top_p: 0.9,
      }),
    });

    if (!res.ok || !res.body) {
      const err = await res.text();
      const errorMsg = err.slice(0, 150);
      console.error("Mistral API error:", errorMsg);
      
      return new Response(
        `data: ${JSON.stringify({ 
          text: `Désolé, j'ai un problème. ${errorMsg}` 
        })}\ndata: [DONE]\n\n`,
        { headers: { "Content-Type": "text/event-stream" } }
      );
    }

    // Stream the response
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
              if (data === "[DONE]") {
                controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                continue;
              }
              
              try {
                const parsed = JSON.parse(data);
                const text = parsed.choices?.[0]?.delta?.content || "";
                if (text) {
                  controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify({ text })}\n\n`)
                  );
                }
              } catch {
                // Ignore parse errors
              }
            }
          }
        } catch (err) {
          console.error("Stream error:", err);
        } finally {
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    console.error("Request error:", err);
    return new Response(
      `data: ${JSON.stringify({ 
        text: "Erreur interne. Veuillez réessayer." 
      })}\ndata: [DONE]\n\n`,
      { headers: { "Content-Type": "text/event-stream" } }
    );
  }
}

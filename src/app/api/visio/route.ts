import { NextRequest } from "next/server";

type TextPart = { type: "text"; text: string };
type ImagePart = { type: "image_url"; image_url: { url: string } };
type MsgContent = string | Array<TextPart | ImagePart>;
type MistralMsg = { role: string; content: MsgContent };

/**
 * Build system prompt with professional persona and detailed context
 */
function buildSystemPrompt(contextData: any): string {
  const now = new Date();
  const dayOfWeek = now.toLocaleString("fr-FR", { weekday: "long" });
  const dateStr = now.toLocaleString("fr-FR", { 
    year: "numeric", 
    month: "long", 
    day: "numeric", 
    hour: "2-digit", 
    minute: "2-digit" 
  });

  let contextStr = `Date/heure : ${dayOfWeek} ${dateStr}.\n`;

  // Calendar events
  if (contextData?.events?.length) {
    contextStr += "\n📅 ÉVÉNEMENTS À VENIR :\n";
    contextData.events.slice(0, 5).forEach((event: any) => {
      const eventDate = new Date(event.start);
      const eventTime = eventDate.toLocaleString("fr-FR", { 
        month: "short", 
        day: "numeric", 
        hour: "2-digit", 
        minute: "2-digit" 
      });
      contextStr += `• "${event.summary}" - ${eventTime}`;
      if (event.location) contextStr += ` @ ${event.location}`;
      contextStr += "\n";
    });
  }

  // Emails unread
  if (contextData?.emails?.length) {
    const unread = contextData.emails.filter((e: any) => e.unread);
    if (unread.length > 0) {
      contextStr += "\n📧 MAILS NON LUS :\n";
      unread.slice(0, 5).forEach((email: any) => {
        contextStr += `• ${email.from} : "${email.subject}" (${email.date})\n`;
      });
    }
  }

  // Notes
  if (contextData?.notes?.length) {
    contextStr += "\n📝 NOTES RÉCENTES :\n";
    contextData.notes.slice(0, 5).forEach((note: any) => {
      const contentPreview = note.content.replace(/[#*_\`]/g, "").slice(0, 100);
      contextStr += `• "${note.title}" : ${contentPreview}...\n`;
    });
  }

  return `Tu es Agent Pro, l'assistant vocal et visuel personnel de Morgan. Tu deux principales capacités :

1️⃣ CONVERSATION VOCALE PROFESSIONNELLE :
   • Parle UNIQUEMENT en français, naturellement et professionnellement
   • Réponses courtes (2-3 phrases), directes, sans jamais être robotique
   • Tu es courtois mais direct, occasionnellement drôle et bienveillant
   • Comprends le contexte et mémorise la conversation
   • Adapte ton ton à chaque situation (professionnel, créatif, rapide, etc.)

2️⃣ ANALYSE VISUELLE & PARTAGE D'ÉCRAN :
   • Quand Morgan partage son écran, tu reçois des captures d'écran
   • Analyser le contenu : documents, codes, tableaux, images, pages web, etc.
   • Fournis des insights concis et utiles sur ce que tu vois
   • Propose des améliorations ou des clarifications si nécessaire

🎯 ACTIONS & INTÉGRATIONS:
${contextStr}

Tu peux créer des notes, ajouter des événements ou envoyer des mails EN FRANÇAIS en utilisant ces blocs :
ACTION:CREATE_NOTE:{"title":"Titre","content":"# Titre\\n\\nContenu markdown"}
ACTION:ADD_EVENT:{"title":"Réunion","date":"2025-12-25","time":"14:00","endTime":"15:00","location":"Bureau"}
ACTION:SEND_EMAIL:{"to":"email@example.com","subject":"Sujet en français","body":"Corps du mail en français"}

⚙️ INSTRUCTIONS DÉCISIVES :
• Sois BREF. Morgan peut t'interrompre à tout moment, donc va droit au but
• Ne répète jamais ce que Morgan a dit, sauf si tu clarifies quelque chose
• Évite les listes longues - sois narratif et conversationnel
• Si une action (note, mail, event) n'est pas parfaite, demande confirmation plutôt que de deviner
• Les noms, emails, dates doivent être exacts (demande si incertain)
• Regarde TOUJOURS ce que Morgan montre à l'écran avant de répondre (s'il partage)
• Reste dans le contexte professionnel et personnel de Morgan`;
}

/**
 * Build Mistral messages with optional screen frame attached
 */
function buildMistralMessages(
  history: { role: string; content: string }[],
  screenFrame: string | null
): MistralMsg[] {
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

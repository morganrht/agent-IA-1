"use client";

import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Send, Mic, MicOff, Trash2, Bot, User, Loader2, Plus, MessageSquare, ChevronLeft, Mail, Check } from "lucide-react";
import { useStore, type ChatSession } from "@/lib/store";
import { useRouter } from "next/navigation";

type LiveContext = {
  connected: boolean;
  events?: { id?: string; summary: string; start: string; end: string; location: string }[];
  emails?: { id: string; from: string; fromEmail?: string; subject: string; snippet: string; date?: string; unread: boolean }[];
};

type AgentAction =
  | { type: "SEND_EMAIL"; to: string; subject: string; body: string }
  | { type: "CREATE_NOTE"; title: string; content: string }
  | { type: "ADD_EVENT"; title: string; date: string; time: string; endTime: string; location?: string };

function buildSystemPrompt(
  notes: { title: string; content: string }[],
  prefs: { name: string },
  ctx: LiveContext | null
) {
  const today = new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const time = new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

  const notesSummary = notes.length > 0
    ? "\n\n📝 Notes de Morgan :\n" + notes.slice(0, 20).map((n) =>
        `• "${n.title}" : ${n.content.replace(/[#*`]/g, "").slice(0, 200)}`
      ).join("\n")
    : "";

  let calendarSummary = "";
  if (ctx?.connected && ctx.events && ctx.events.length > 0) {
    calendarSummary = "\n\n📅 Calendrier (30 prochains jours) :\n" + ctx.events.map((e) => {
      const start = e.start ? new Date(e.start).toLocaleString("fr-FR", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "";
      return `• [${e.id || ""}] ${e.summary}${start ? ` — ${start}` : ""}${e.location ? ` @ ${e.location}` : ""}`;
    }).join("\n");
  } else if (ctx?.connected) {
    calendarSummary = "\n\n📅 Calendrier : aucun événement dans les 30 prochains jours.";
  }

  let emailSummary = "";
  if (ctx?.connected && ctx.emails && ctx.emails.length > 0) {
    emailSummary = "\n\n📬 Boîte de réception (20 derniers mails) :\n" + ctx.emails.map((e) =>
      `• ${e.unread ? "🔵 " : ""}[${e.id}] ${e.from}${e.fromEmail ? ` <${e.fromEmail}>` : ""} — "${e.subject}" (${e.date || ""}) : ${e.snippet}`
    ).join("\n");
  }

  const actionInstructions = `

🛠 ACTIONS DISPONIBLES — Tu peux exécuter ces actions en ajoutant un bloc à la fin de ta réponse :

• Envoyer un mail (avec confirmation) :
ACTION:SEND_EMAIL:{"to":"email@example.com","subject":"Sujet","body":"Corps complet du mail"}

• Créer une note :
ACTION:CREATE_NOTE:{"title":"Titre de la note","content":"Contenu complet"}

• Ajouter un événement au calendrier :
ACTION:ADD_EVENT:{"title":"Titre","date":"YYYY-MM-DD","time":"HH:MM","endTime":"HH:MM","location":"..."}

Règles : 1 action par bloc, sur une seule ligne, JSON valide. Le mail n'est jamais envoyé sans confirmation explicite de Morgan.`;

  return `Tu es l'agent personnel et professionnel de ${prefs.name}.
Tu t'appelles Agent Pro. Tu parles en français par défaut.
Tu es intelligent, empathique, proactif et vraiment utile — comme un secrétaire de confiance et un ami brillant.
Tu as une vraie personnalité : chaleureux, direct, parfois drôle, jamais robotique ni condescendant.
Tu donnes des réponses complètes, précises et actionnables. Tu poses des questions de suivi si besoin.
Tu peux aider sur tout : stratégie, rédaction, analyse, code, organisation, idées, questions personnelles, mails, calendrier, notes, etc.
Date : ${today} · Heure : ${time}.${notesSummary}${calendarSummary}${emailSummary}${actionInstructions}`;
}

function parseActions(content: string): AgentAction[] {
  const actions: AgentAction[] = [];
  const regex = /ACTION:(SEND_EMAIL|CREATE_NOTE|ADD_EVENT):(\{[^}]+\})/g;
  let m;
  while ((m = regex.exec(content)) !== null) {
    try {
      const data = JSON.parse(m[2]);
      if (m[1] === "SEND_EMAIL") actions.push({ type: "SEND_EMAIL", ...data });
      else if (m[1] === "CREATE_NOTE") actions.push({ type: "CREATE_NOTE", ...data });
      else if (m[1] === "ADD_EVENT") actions.push({ type: "ADD_EVENT", ...data });
    } catch {}
  }
  return actions;
}

function stripActions(content: string): string {
  return content
    .replace(/\nACTION:(SEND_EMAIL|CREATE_NOTE|ADD_EVENT):\{[^\n]+\}/g, "")
    .replace(/ACTION:(SEND_EMAIL|CREATE_NOTE|ADD_EVENT):\{[^\n]+\}/g, "")
    .trim();
}

export default function ChatPage() {
  const { sessions, activeSessionId, createSession, setActiveSession, addMessage, updateLastMessage, deleteSession, getActiveSession, notes, prefs, createNote, updateNote, setDraftEmail } = useStore();
  const router = useRouter();
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [liveCtx, setLiveCtx] = useState<LiveContext | null>(null);
  const [pendingActions, setPendingActions] = useState<AgentAction[]>([]);
  const [executingActions, setExecutingActions] = useState<Set<number>>(new Set());
  const [doneActions, setDoneActions] = useState<Set<number>>(new Set());
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const currentSessionIdRef = useRef<string | null>(activeSessionId);

  const activeSession = getActiveSession();

  // Fetch live context (calendar + mail) on mount
  useEffect(() => {
    fetch("/api/context")
      .then((r) => r.json())
      .then((data) => setLiveCtx(data))
      .catch(() => setLiveCtx({ connected: false }));
  }, []);

  useEffect(() => { currentSessionIdRef.current = activeSessionId; }, [activeSessionId]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [activeSession?.messages.length, loading]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 160) + "px";
    }
  }, [input]);

  const ensureSession = (): string => {
    if (activeSessionId) return activeSessionId;
    return createSession().id;
  };

  const sendMessage = async (text?: string) => {
    const content = (text || input).trim();
    if (!content || loading) return;

    const sessionId = ensureSession();
    setInput("");
    setLoading(true);
    setPendingActions([]);
    setExecutingActions(new Set());
    setDoneActions(new Set());

    addMessage(sessionId, { role: "user", content });

    const session = useStore.getState().sessions.find((s) => s.id === sessionId);
    const history = session?.messages || [];
    const systemPrompt = buildSystemPrompt(notes, prefs, liveCtx);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            { role: "system", content: systemPrompt },
            ...history.map((m) => ({ role: m.role, content: m.content })),
          ],
        }),
      });

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let aiContent = "";
      let assistantMsgAdded = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        for (const line of decoder.decode(value).split("\n")) {
          if (line.startsWith("data: ") && line !== "data: [DONE]") {
            try { aiContent += JSON.parse(line.slice(6)).text; } catch {}
          }
        }
        if (aiContent && !assistantMsgAdded) {
          // Only add the assistant message once we have actual content (avoids empty-string bug)
          addMessage(sessionId, { role: "assistant", content: aiContent });
          assistantMsgAdded = true;
        } else if (assistantMsgAdded) {
          updateLastMessage(sessionId, aiContent);
        }
      }

      // Parse all action blocks from final response
      const actions = parseActions(aiContent);
      // Auto-execute non-destructive actions (notes, events); require confirmation for email
      const autoActions: AgentAction[] = [];
      const confirmActions: AgentAction[] = [];
      for (const a of actions) {
        if (a.type === "SEND_EMAIL") confirmActions.push(a);
        else autoActions.push(a);
      }
      // Execute notes and events silently
      for (const a of autoActions) {
        if (a.type === "CREATE_NOTE") {
          const note = createNote();
          setTimeout(() => {
            updateNote(note.id, "title", a.title || "Note");
            updateNote(note.id, "content", `# ${a.title || "Note"}\n\n${a.content || ""}`);
          }, 50);
        } else if (a.type === "ADD_EVENT") {
          const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
          fetch("/api/calendar", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              summary: a.title,
              location: a.location || "",
              start: { dateTime: `${a.date}T${a.time}:00`, timeZone: tz },
              end: { dateTime: `${a.date}T${a.endTime}:00`, timeZone: tz },
            }),
          }).catch(() => {});
        }
      }
      if (confirmActions.length) setPendingActions(confirmActions);
    } catch {
      addMessage(sessionId, { role: "assistant", content: "Désolé, une erreur s'est produite. Vérifie ta clé API dans les paramètres." });
    } finally {
      setLoading(false);
    }
  };

  const executeConfirmedAction = async (action: AgentAction, idx: number) => {
    setExecutingActions((prev) => new Set([...prev, idx]));
    if (action.type === "SEND_EMAIL") {
      await fetch("/api/gmail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: action.to, subject: action.subject, body: action.body }),
      });
    }
    setExecutingActions((prev) => { const s = new Set(prev); s.delete(idx); return s; });
    setDoneActions((prev) => new Set([...prev, idx]));
  };

  const openMailCompose = (action: AgentAction) => {
    if (action.type !== "SEND_EMAIL") return;
    setDraftEmail({ to: action.to, subject: action.subject, body: action.body });
    router.push("/mail");
  };

  const toggleVoice = () => {
    if (!("webkitSpeechRecognition" in window || "SpeechRecognition" in window)) {
      alert("Reconnaissance vocale non supportée. Utilise Chrome ou Safari.");
      return;
    }
    if (listening) { recognitionRef.current?.stop(); setListening(false); return; }
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const r: SpeechRecognition = new SR();
    r.lang = "fr-FR";
    r.continuous = false;
    r.interimResults = false;
    r.onresult = (e: SpeechRecognitionEvent) => { sendMessage(e.results[0][0].transcript); };
    r.onend = () => setListening(false);
    r.start();
    recognitionRef.current = r;
    setListening(true);
  };

  const newChat = () => { createSession(); setSidebarOpen(false); };

  const SUGGESTIONS = [
    "Résume mes tâches du jour",
    "Réponds au dernier mail non lu à ma place",
    "Qu'est-ce que j'ai comme réunions cette semaine ?",
    "Qu'est-ce que j'ai dans mes notes ?",
  ];

  const modelName = process.env.NEXT_PUBLIC_AI_MODEL || "Mistral";

  return (
    <div className="h-full flex" style={{ background: "var(--bg-primary)" }}>
      {/* Sessions sidebar */}
      <div
        className={`flex-shrink-0 flex flex-col transition-all duration-200 ${sidebarOpen ? "w-60" : "w-0 overflow-hidden"} md:w-56`}
        style={{ background: "var(--bg-secondary)", borderRight: "1px solid var(--border)" }}
      >
        <div className="p-3 border-b flex items-center justify-between" style={{ borderColor: "var(--border)" }}>
          <span className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>CONVERSATIONS</span>
          <button onClick={newChat} className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: "var(--accent)" }}>
            <Plus size={12} color="white" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {sessions.length === 0 && (
            <p className="text-xs p-2" style={{ color: "var(--text-muted)" }}>Aucune conversation</p>
          )}
          {sessions.map((s: ChatSession) => (
            <div key={s.id}
              onClick={() => { setActiveSession(s.id); setSidebarOpen(false); }}
              className="group flex items-center gap-2 px-2 py-2 rounded-lg cursor-pointer transition-all"
              style={{ background: activeSessionId === s.id ? "var(--accent-glow)" : "transparent", border: `1px solid ${activeSessionId === s.id ? "var(--accent)" : "transparent"}` }}>
              <MessageSquare size={12} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
              <span className="text-xs flex-1 truncate" style={{ color: activeSessionId === s.id ? "var(--accent-light)" : "var(--text-secondary)" }}>
                {s.title}
              </span>
              <button onClick={(e) => { e.stopPropagation(); deleteSession(s.id); }}
                className="opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ color: "var(--text-muted)" }}>
                <Trash2 size={11} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Main chat */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0"
          style={{ borderColor: "var(--border)", background: "var(--bg-secondary)" }}>
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="md:hidden p-1 rounded" style={{ color: "var(--text-muted)" }}>
              <ChevronLeft size={18} />
            </button>
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, var(--accent), #8b5cf6)" }}>
              <Bot size={16} color="white" />
            </div>
            <div>
              <div className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>Agent Pro</div>
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--success)", boxShadow: "0 0 4px var(--success)" }} />
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                  {modelName} · {notes.length} note{notes.length !== 1 ? "s" : ""}
                  {liveCtx?.connected && " · Calendrier & Gmail connectés"}
                </span>
              </div>
            </div>
          </div>
          <button onClick={newChat} className="btn-ghost flex items-center gap-1.5 text-xs">
            <Plus size={13} />Nouveau
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4">
          {(!activeSession || activeSession.messages.length === 0) && (
            <div className="flex flex-col items-center justify-center h-full text-center animate-fade-in">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 animate-float"
                style={{ background: "linear-gradient(135deg, var(--accent), #8b5cf6)" }}>
                <Bot size={28} color="white" />
              </div>
              <div className="font-semibold text-lg mb-1" style={{ color: "var(--text-primary)" }}>
                Bonjour {prefs.name} 👋
              </div>
              <div className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>
                {liveCtx?.connected
                  ? "Je connais tes notes, ton calendrier et tes mails. Que puis-je faire pour toi ?"
                  : "Je connais tes notes. Connecte Google pour accéder à ton calendrier et tes mails."}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-md">
                {SUGGESTIONS.map((s) => (
                  <button key={s} onClick={() => sendMessage(s)}
                    className="text-left px-4 py-3 rounded-xl text-sm transition-all"
                    style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "var(--accent)"; (e.currentTarget as HTMLElement).style.color = "var(--text-primary)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border)"; (e.currentTarget as HTMLElement).style.color = "var(--text-secondary)"; }}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeSession?.messages.map((msg, i) => {
            const displayContent = msg.role === "assistant" ? stripActions(msg.content) : msg.content;
            const isLast = i === (activeSession.messages.length - 1);
            return (
              <div key={i} className={`flex gap-3 animate-fade-in ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
                <div className="w-8 h-8 rounded-xl flex-shrink-0 flex items-center justify-center mt-1"
                  style={{ background: msg.role === "user" ? "linear-gradient(135deg, var(--accent), #8b5cf6)" : "var(--bg-card)", border: msg.role === "assistant" ? "1px solid var(--border)" : "none" }}>
                  {msg.role === "user" ? <User size={14} color="white" /> : <Bot size={14} style={{ color: "var(--accent)" }} />}
                </div>
                <div className="flex flex-col gap-2 max-w-[78%]">
                  <div className={`px-4 py-3 ${msg.role === "user" ? "message-user" : "message-ai"}`}>
                    {msg.role === "user"
                      ? <p className="text-sm text-white leading-relaxed">{displayContent}</p>
                      : <div className="prose-dark text-sm"><ReactMarkdown remarkPlugins={[remarkGfm]}>{displayContent}</ReactMarkdown></div>
                    }
                  </div>
                  {/* Action confirmation cards — shown for last AI message */}
                  {isLast && pendingActions.map((action, idx) => (
                    <div key={idx} className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--accent)", background: "var(--bg-card)" }}>
                      <div className="px-3 py-2 flex items-center gap-2" style={{ background: "var(--accent-glow)", borderBottom: "1px solid var(--border)" }}>
                        <Mail size={13} style={{ color: "var(--accent)" }} />
                        <span className="text-xs font-semibold" style={{ color: "var(--accent-light)" }}>
                          {action.type === "SEND_EMAIL" ? "Mail prêt à envoyer" : ""}
                        </span>
                      </div>
                      {action.type === "SEND_EMAIL" && (
                        <div className="px-3 py-2 space-y-1">
                          <div className="flex gap-2 text-xs"><span style={{ color: "var(--text-muted)" }}>À :</span><span style={{ color: "var(--text-primary)" }}>{action.to}</span></div>
                          <div className="flex gap-2 text-xs"><span style={{ color: "var(--text-muted)" }}>Objet :</span><span style={{ color: "var(--text-primary)" }}>{action.subject}</span></div>
                          <p className="text-xs mt-1 whitespace-pre-wrap" style={{ color: "var(--text-secondary)" }}>{action.body.slice(0, 250)}{action.body.length > 250 ? "..." : ""}</p>
                        </div>
                      )}
                      <div className="px-3 py-2 flex justify-end gap-2" style={{ borderTop: "1px solid var(--border)" }}>
                        {doneActions.has(idx)
                          ? <div className="flex items-center gap-1.5 text-xs" style={{ color: "var(--success)" }}><Check size={11} />Envoyé !</div>
                          : <>
                              <button onClick={() => openMailCompose(action)} className="btn-ghost text-xs">Ouvrir dans Mail</button>
                              <button onClick={() => executeConfirmedAction(action, idx)} disabled={executingActions.has(idx)}
                                className="btn-primary flex items-center gap-1.5 text-xs">
                                {executingActions.has(idx) ? <Loader2 size={11} className="animate-spin" /> : <Send size={11} />}
                                {executingActions.has(idx) ? "Envoi..." : "Envoyer maintenant"}
                              </button>
                            </>
                        }
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {loading && (
            <div className="flex gap-3 animate-fade-in">
              <div className="w-8 h-8 rounded-xl flex-shrink-0 flex items-center justify-center" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
                <Bot size={14} style={{ color: "var(--accent)" }} />
              </div>
              <div className="message-ai px-4 py-3">
                <div className="flex items-center gap-1.5">
                  {[0,1,2].map((i) => (
                    <div key={i} className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--accent)", animation: `wave 1.2s ease-in-out ${i * 0.2}s infinite` }} />
                  ))}
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="flex-shrink-0 p-4 border-t" style={{ borderColor: "var(--border)", background: "var(--bg-secondary)" }}>
          <div className="flex items-end gap-2 p-2 rounded-2xl" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
            <textarea ref={textareaRef} value={input} onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
              placeholder="Écris un message... (Entrée pour envoyer, Shift+Entrée pour sauter une ligne)"
              rows={1}
              className="flex-1 bg-transparent text-sm resize-none outline-none px-2 py-1.5"
              style={{ color: "var(--text-primary)", minHeight: "36px", maxHeight: "160px" }}
            />
            <div className="flex gap-1 pb-1 flex-shrink-0">
              <button onClick={toggleVoice}
                className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${listening ? "animate-pulse-glow" : ""}`}
                style={{ background: listening ? "rgba(239,68,68,0.2)" : "var(--bg-hover)", color: listening ? "#ef4444" : "var(--text-secondary)" }}>
                {listening ? <MicOff size={16} /> : <Mic size={16} />}
              </button>
              <button onClick={() => sendMessage()} disabled={!input.trim() || loading}
                className="w-9 h-9 rounded-xl flex items-center justify-center transition-all"
                style={{ background: input.trim() && !loading ? "linear-gradient(135deg, var(--accent), #8b5cf6)" : "var(--bg-hover)", color: input.trim() && !loading ? "white" : "var(--text-muted)", cursor: input.trim() && !loading ? "pointer" : "not-allowed" }}>
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

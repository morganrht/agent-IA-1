"use client";

import { useState, useEffect, useCallback } from "react";
import { Mail, Star, Archive, Trash2, Reply, Search, Loader2, Inbox, Send, X, RefreshCw, Sparkles, Pencil } from "lucide-react";
import { useStore } from "@/lib/store";

type GMessage = {
  id: string;
  threadId: string;
  labelIds: string[];
  snippet: string;
  payload: { headers: { name: string; value: string }[] };
};

type ParsedEmail = {
  id: string;
  threadId: string;
  from: string;
  fromName: string;
  subject: string;
  snippet: string;
  date: string;
  read: boolean;
  starred: boolean;
  archived: boolean;
};

function parseMessage(m: GMessage): ParsedEmail {
  const h = m.payload?.headers || [];
  const get = (name: string) => h.find((x) => x.name.toLowerCase() === name.toLowerCase())?.value || "";
  const from = get("From");
  const nameMatch = from.match(/^"?([^"<]+)"?\s*<?/);
  const fromName = nameMatch ? nameMatch[1].trim() : from.split("@")[0];

  const dateStr = get("Date");
  let date = "";
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 86400000 && d.getDate() === now.getDate()) {
      date = d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
    } else if (diff < 7 * 86400000) {
      date = d.toLocaleDateString("fr-FR", { weekday: "short" });
    } else {
      date = d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
    }
  } catch { date = ""; }

  return {
    id: m.id, threadId: m.threadId, from, fromName,
    subject: get("Subject") || "(Sans objet)",
    snippet: m.snippet || "",
    date,
    read: !m.labelIds?.includes("UNREAD"),
    starred: m.labelIds?.includes("STARRED") || false,
    archived: !m.labelIds?.includes("INBOX"),
  };
}

type ComposeMode = "reply" | "new" | null;

export default function MailPage() {
  const { draftEmail, setDraftEmail } = useStore();
  const [emails, setEmails] = useState<ParsedEmail[]>([]);
  const [selected, setSelected] = useState<ParsedEmail | null>(null);
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState(false);
  const [search, setSearch] = useState("");
  const [folder, setFolder] = useState<"inbox" | "starred">("inbox");
  const [composeMode, setComposeMode] = useState<ComposeMode>(null);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);
  // New mail compose fields
  const [composeTo, setComposeTo] = useState("");
  const [composeSubject, setComposeSubject] = useState("");
  const [composeBody, setComposeBody] = useState("");

  // Consume draft email from chat/visio if available
  useEffect(() => {
    if (draftEmail) {
      setComposeTo(draftEmail.to);
      setComposeSubject(draftEmail.subject);
      setComposeBody(draftEmail.body);
      setComposeMode("new");
      setDraftEmail(null);
    }
  }, [draftEmail, setDraftEmail]);

  const fetchMails = useCallback(async (q?: string) => {
    setLoading(true);
    try {
      const query = q || (folder === "inbox" ? "in:inbox" : "is:starred");
      const res = await fetch(`/api/gmail?q=${encodeURIComponent(query)}&max=25`);
      if (res.status === 401) { setConnected(false); setLoading(false); return; }
      const data = await res.json();
      setEmails((data.messages || []).map(parseMessage));
      setConnected(true);
    } catch { setConnected(false); }
    setLoading(false);
  }, [folder]);

  useEffect(() => { fetchMails(); }, [fetchMails]);

  const doAction = async (id: string, action: string) => {
    await fetch("/api/gmail", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageId: id, action }),
    });
    if (action === "archive" || action === "trash") {
      setEmails((prev) => prev.filter((e) => e.id !== id));
      if (selected?.id === id) setSelected(null);
    } else if (action === "star") {
      setEmails((prev) => prev.map((e) => e.id === id ? { ...e, starred: true } : e));
      if (selected?.id === id) setSelected((p) => p && { ...p, starred: true });
    } else if (action === "unstar") {
      setEmails((prev) => prev.map((e) => e.id === id ? { ...e, starred: false } : e));
      if (selected?.id === id) setSelected((p) => p && { ...p, starred: false });
    }
  };

  const openEmail = (email: ParsedEmail) => {
    setSelected(email);
    setComposeMode(null);
    setReplyText("");
    if (!email.read) {
      doAction(email.id, "read");
      setEmails((prev) => prev.map((e) => e.id === email.id ? { ...e, read: true } : e));
    }
  };

  const sendReply = async () => {
    if (!selected || !replyText.trim()) return;
    setSending(true);
    await fetch("/api/gmail", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to: selected.from, subject: `Re: ${selected.subject}`, body: replyText, threadId: selected.threadId }),
    });
    setSending(false);
    setComposeMode(null);
    setReplyText("");
  };

  const sendNewMail = async () => {
    if (!composeTo.trim() || !composeSubject.trim()) return;
    setSending(true);
    await fetch("/api/gmail", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to: composeTo, subject: composeSubject, body: composeBody }),
    });
    setSending(false);
    setComposeMode(null);
    setComposeTo(""); setComposeSubject(""); setComposeBody("");
  };

  const generateAiReply = async () => {
    if (!selected) return;
    setAiGenerating(true);
    setReplyText("");
    const prompt = `Rédige une réponse professionnelle, concise et naturelle en français à ce mail.
De : ${selected.fromName}
Objet : ${selected.subject}
Contenu : ${selected.snippet}

Écris uniquement le corps de la réponse, directement sans formule d'introduction.`;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [{ role: "user", content: prompt }] }),
      });
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let text = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        for (const line of decoder.decode(value).split("\n")) {
          if (line.startsWith("data: ") && line !== "data: [DONE]") {
            try { text += JSON.parse(line.slice(6)).text; } catch {}
          }
        }
        setReplyText(text);
      }
    } catch {}
    setAiGenerating(false);
  };

  const generateAiCompose = async () => {
    if (!composeSubject.trim()) return;
    setAiGenerating(true);
    setComposeBody("");
    const prompt = `Rédige un mail professionnel en français.
Destinataire : ${composeTo || "inconnu"}
Sujet : ${composeSubject}

Écris uniquement le corps du mail, directement.`;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [{ role: "user", content: prompt }] }),
      });
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let text = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        for (const line of decoder.decode(value).split("\n")) {
          if (line.startsWith("data: ") && line !== "data: [DONE]") {
            try { text += JSON.parse(line.slice(6)).text; } catch {}
          }
        }
        setComposeBody(text);
      }
    } catch {}
    setAiGenerating(false);
  };

  const filtered = emails.filter((e) =>
    !search || e.subject.toLowerCase().includes(search.toLowerCase()) || e.fromName.toLowerCase().includes(search.toLowerCase())
  );
  const unread = emails.filter((e) => !e.read).length;
  const initials = (name: string) => name.trim().split(/\s+/).map((w) => w[0]?.toUpperCase() || "").slice(0, 2).join("");

  return (
    <div className="h-full flex overflow-hidden" style={{ background: "var(--bg-primary)" }}>

      {/* New mail compose modal */}
      {composeMode === "new" && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)" }} onClick={() => setComposeMode(null)}>
          <div className="w-full max-w-lg rounded-2xl overflow-hidden animate-fade-in" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} onClick={(e) => e.stopPropagation()}>
            <div className="px-4 py-3 flex items-center justify-between" style={{ background: "var(--bg-secondary)", borderBottom: "1px solid var(--border)" }}>
              <span className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>Nouveau mail</span>
              <button onClick={() => setComposeMode(null)} style={{ color: "var(--text-muted)" }}><X size={16} /></button>
            </div>
            <div className="p-4 space-y-3">
              <div className="flex items-center gap-2 border-b pb-2" style={{ borderColor: "var(--border)" }}>
                <span className="text-xs w-12" style={{ color: "var(--text-muted)" }}>À :</span>
                <input value={composeTo} onChange={(e) => setComposeTo(e.target.value)} placeholder="destinataire@email.com"
                  className="flex-1 bg-transparent text-sm outline-none" style={{ color: "var(--text-primary)" }} />
              </div>
              <div className="flex items-center gap-2 border-b pb-2" style={{ borderColor: "var(--border)" }}>
                <span className="text-xs w-12" style={{ color: "var(--text-muted)" }}>Objet :</span>
                <input value={composeSubject} onChange={(e) => setComposeSubject(e.target.value)} placeholder="Sujet du mail"
                  className="flex-1 bg-transparent text-sm outline-none" style={{ color: "var(--text-primary)" }} />
              </div>
              <textarea value={composeBody} onChange={(e) => setComposeBody(e.target.value)}
                placeholder="Corps du mail..."
                rows={7} className="w-full bg-transparent text-sm resize-none outline-none" style={{ color: "var(--text-primary)" }} />
            </div>
            <div className="px-4 py-3 flex items-center justify-between" style={{ borderTop: "1px solid var(--border)", background: "var(--bg-secondary)" }}>
              <button onClick={generateAiCompose} disabled={aiGenerating || !composeSubject.trim()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={{ background: "var(--accent-glow)", color: "var(--accent-light)", border: "1px solid var(--accent)" }}>
                {aiGenerating ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
                {aiGenerating ? "Génération..." : "Générer avec l'IA"}
              </button>
              <div className="flex gap-2">
                <button onClick={() => setComposeMode(null)} className="btn-ghost text-xs">Annuler</button>
                <button onClick={sendNewMail} disabled={sending || !composeTo.trim() || !composeSubject.trim()}
                  className="btn-primary flex items-center gap-1.5 text-xs">
                  {sending ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                  {sending ? "Envoi..." : "Envoyer"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Left panel */}
      <div className="w-72 flex-shrink-0 flex flex-col h-full" style={{ background: "var(--bg-secondary)", borderRight: "1px solid var(--border)" }}>
        {/* Account header */}
        <div className="p-3 border-b" style={{ borderColor: "var(--border)" }}>
          {connected ? (
            <div className="flex items-center gap-2 mb-3">
              <img src="/google.svg" width={18} height={18} alt="Google" />
              <span className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>Gmail</span>
              <div className="ml-auto flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--success)" }} />
                <span className="text-xs" style={{ color: "var(--success)" }}>Connecté</span>
              </div>
            </div>
          ) : (
            <a href="/api/auth/google" className="btn-primary flex items-center gap-2 text-xs w-full justify-center mb-3">
              <img src="/google.svg" width={14} height={14} alt="Google" />
              Connecter Gmail
            </a>
          )}

          {/* Compose button */}
          {connected && (
            <button onClick={() => setComposeMode("new")}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium mb-2 transition-all"
              style={{ background: "linear-gradient(135deg, var(--accent), #8b5cf6)", color: "white" }}>
              <Pencil size={12} />Nouveau mail
            </button>
          )}

          {/* Folder tabs */}
          <div className="flex gap-1 mb-2">
            {(["inbox", "starred"] as const).map((f) => (
              <button key={f} onClick={() => setFolder(f)}
                className="flex-1 py-1.5 text-xs font-medium rounded-lg transition-all"
                style={{ background: folder === f ? "var(--accent-glow)" : "transparent", color: folder === f ? "var(--accent-light)" : "var(--text-secondary)", border: `1px solid ${folder === f ? "var(--accent)" : "transparent"}` }}>
                {f === "inbox" ? `Boîte${unread > 0 ? ` (${unread})` : ""}` : "Favoris"}
              </button>
            ))}
            <button onClick={() => fetchMails()} className="w-8 flex items-center justify-center rounded-lg" style={{ color: "var(--text-muted)" }}>
              {loading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
            </button>
          </div>

          <div className="relative">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher..."
              className="w-full pl-8 pr-3 py-1.5 rounded-lg text-xs outline-none"
              style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
              onKeyDown={(e) => e.key === "Enter" && fetchMails(`in:inbox ${search}`)} />
          </div>
        </div>

        {/* Email list */}
        <div className="flex-1 overflow-y-auto">
          {loading && emails.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <Loader2 size={20} className="animate-spin" style={{ color: "var(--accent)" }} />
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>Chargement...</span>
            </div>
          )}
          {!connected && !loading && (
            <div className="p-4 text-center">
              <img src="/google.svg" width={40} height={40} alt="Google" className="mx-auto mb-3 opacity-60" />
              <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>Connecte Gmail pour voir tes vrais emails</p>
              <a href="/api/auth/google" className="btn-primary text-xs inline-block">Connecter →</a>
            </div>
          )}
          {filtered.map((email) => (
            <div key={email.id} onClick={() => openEmail(email)}
              className="px-3 py-3 cursor-pointer transition-all border-b"
              style={{ background: selected?.id === email.id ? "var(--bg-hover)" : email.read ? "transparent" : "rgba(108,99,255,0.04)", borderColor: "var(--border)" }}
              onMouseEnter={(e) => { if (selected?.id !== email.id) (e.currentTarget as HTMLElement).style.background = "var(--bg-card)"; }}
              onMouseLeave={(e) => { if (selected?.id !== email.id) (e.currentTarget as HTMLElement).style.background = email.read ? "transparent" : "rgba(108,99,255,0.04)"; }}>
              <div className="flex items-start gap-2">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5"
                  style={{ background: "rgba(234,67,53,0.15)", color: "#ea4335" }}>
                  {initials(email.fromName) || "?"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-semibold truncate" style={{ color: email.read ? "var(--text-secondary)" : "var(--text-primary)" }}>
                      {email.fromName}
                    </span>
                    <span className="text-xs flex-shrink-0" style={{ color: "var(--text-muted)", fontSize: "10px" }}>{email.date}</span>
                  </div>
                  <div className="flex items-center gap-1 mt-0.5">
                    {!email.read && <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: "var(--accent)" }} />}
                    <p className="text-xs truncate" style={{ color: "var(--text-secondary)" }}>{email.subject}</p>
                  </div>
                  <p className="text-xs truncate mt-0.5" style={{ color: "var(--text-muted)", fontSize: "11px" }}>{email.snippet}</p>
                </div>
                {email.starred && <Star size={11} className="flex-shrink-0 mt-1" style={{ color: "#f59e0b", fill: "#f59e0b" }} />}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Email detail */}
      <div className="flex-1 flex flex-col min-w-0 h-full">
        {selected ? (
          <>
            {/* Header */}
            <div className="px-6 py-4 border-b flex-shrink-0" style={{ borderColor: "var(--border)", background: "var(--bg-secondary)" }}>
              <div className="flex items-start justify-between gap-4 mb-3">
                <h2 className="text-base font-semibold leading-snug" style={{ color: "var(--text-primary)" }}>{selected.subject}</h2>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => doAction(selected.id, selected.starred ? "unstar" : "star")} className="p-1.5 rounded-lg btn-ghost">
                    <Star size={15} style={{ color: selected.starred ? "#f59e0b" : "var(--text-muted)", fill: selected.starred ? "#f59e0b" : "none" }} />
                  </button>
                  <button onClick={() => doAction(selected.id, "archive")} className="p-1.5 rounded-lg btn-ghost"><Archive size={15} /></button>
                  <button onClick={() => doAction(selected.id, "trash")} className="p-1.5 rounded-lg btn-ghost"><Trash2 size={15} /></button>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold" style={{ background: "rgba(234,67,53,0.15)", color: "#ea4335" }}>
                  {initials(selected.fromName) || "?"}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{selected.fromName}</span>
                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>&lt;{selected.from.match(/<(.+)>/)?.[1] || selected.from}&gt;</span>
                  </div>
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>{selected.date}</span>
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-5">
              <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "var(--text-primary)" }}>{selected.snippet}</p>
              <p className="text-xs mt-4 italic" style={{ color: "var(--text-muted)" }}>↗ Pour voir le contenu complet, ouvre Gmail — aperçu disponible ici.</p>
            </div>

            {/* Reply area */}
            <div className="flex-shrink-0 p-4 border-t" style={{ borderColor: "var(--border)", background: "var(--bg-secondary)" }}>
              {composeMode !== "reply" ? (
                <button onClick={() => setComposeMode("reply")} className="btn-ghost flex items-center gap-2 text-sm w-full justify-center">
                  <Reply size={15} />Répondre
                </button>
              ) : (
                <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
                  <div className="px-3 py-2 border-b flex items-center justify-between" style={{ borderColor: "var(--border)", background: "var(--bg-card)" }}>
                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>À : {selected.from}</span>
                    <div className="flex items-center gap-2">
                      <button onClick={generateAiReply} disabled={aiGenerating}
                        className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium"
                        style={{ background: "var(--accent-glow)", color: "var(--accent-light)", border: "1px solid var(--accent)" }}>
                        {aiGenerating ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
                        {aiGenerating ? "Génération..." : "IA"}
                      </button>
                      <button onClick={() => setComposeMode(null)} style={{ color: "var(--text-muted)" }}><X size={14} /></button>
                    </div>
                  </div>
                  <textarea value={replyText} onChange={(e) => setReplyText(e.target.value)}
                    placeholder={aiGenerating ? "L'IA rédige ta réponse..." : "Écris ta réponse ou clique sur 'IA'..."}
                    rows={4} className="w-full p-3 bg-transparent text-sm resize-none outline-none" style={{ color: "var(--text-primary)" }} />
                  <div className="px-3 py-2 flex justify-end gap-2" style={{ background: "var(--bg-card)", borderTop: "1px solid var(--border)" }}>
                    <button onClick={() => setComposeMode(null)} className="btn-ghost text-xs">Annuler</button>
                    <button onClick={sendReply} disabled={sending || !replyText.trim()} className="btn-primary flex items-center gap-2 text-xs">
                      {sending ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                      {sending ? "Envoi..." : "Envoyer"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-3">
            <Inbox size={40} style={{ color: "var(--text-muted)" }} />
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>Sélectionne un email pour le lire</p>
            {connected && (
              <button onClick={() => setComposeMode("new")} className="btn-primary flex items-center gap-2 text-sm mt-2">
                <Pencil size={14} />Rédiger un nouveau mail
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

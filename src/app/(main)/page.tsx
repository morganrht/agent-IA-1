"use client";

import Link from "next/link";
import { MessageSquare, Video, StickyNote, Calendar, Mail, Sparkles, ArrowRight, Clock, Zap, Plus } from "lucide-react";
import { useState, useEffect } from "react";
import { useStore } from "@/lib/store";
import { useRouter } from "next/navigation";

function LiveClock() {
  const [time, setTime] = useState("");
  const [date, setDate] = useState("");
  useEffect(() => {
    const update = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
      setDate(now.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }));
    };
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div>
      <div className="text-4xl font-bold tabular-nums" style={{ color: "var(--text-primary)" }}>{time}</div>
      <div className="text-sm mt-1 capitalize" style={{ color: "var(--text-secondary)" }}>{date}</div>
    </div>
  );
}

export default function Dashboard() {
  const { notes, sessions, prefs, createNote, createSession, setActiveSession } = useStore();
  const router = useRouter();

  const recentNotes = notes.slice(0, 3);
  const recentConvs = sessions.slice(0, 3);
  const totalMessages = sessions.reduce((acc, s) => acc + s.messages.length, 0);

  const handleNewChat = () => {
    createSession();
    router.push("/chat");
  };

  const handleOpenNote = (id: string) => {
    router.push(`/notes?id=${id}`);
  };

  const handleResumeChat = (id: string) => {
    setActiveSession(id);
    router.push("/chat");
  };

  const modules = [
    { href: "/chat", icon: MessageSquare, label: "Chat IA", desc: "Discuter avec l'agent", color: "#6c63ff", glow: "rgba(108,99,255,0.3)" },
    { href: "/visio", icon: Video, label: "Visio IA", desc: "Appel vidéo avec l'agent", color: "#06b6d4", glow: "rgba(6,182,212,0.3)" },
    { href: "/notes", icon: StickyNote, label: "Notes", desc: `${notes.length} note${notes.length !== 1 ? "s" : ""} enregistrée${notes.length !== 1 ? "s" : ""}`, color: "#f59e0b", glow: "rgba(245,158,11,0.3)" },
    { href: "/calendar", icon: Calendar, label: "Calendrier", desc: "Voir tes événements", color: "#22c55e", glow: "rgba(34,197,94,0.3)" },
    { href: "/mail", icon: Mail, label: "Mails", desc: "Gmail & Outlook", color: "#ec4899", glow: "rgba(236,72,153,0.3)" },
  ];

  return (
    <div className="h-full overflow-y-auto p-5 md:p-8" style={{ background: "var(--bg-primary)" }}>
      {/* Header */}
      <div className="mb-6 animate-fade-in">
        <div className="flex items-center gap-2 mb-0.5">
          <Sparkles size={14} style={{ color: "var(--accent)" }} />
          <span className="text-sm font-medium" style={{ color: "var(--accent)" }}>Bonjour, {prefs.name}</span>
        </div>
        <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Tableau de bord</h1>
      </div>

      {/* Top row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
        {/* Clock */}
        <div className="p-5 rounded-2xl animate-fade-in" style={{ background: "linear-gradient(135deg, rgba(108,99,255,0.12), rgba(139,92,246,0.08))", border: "1px solid rgba(108,99,255,0.25)" }}>
          <div className="flex items-start justify-between">
            <LiveClock />
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "var(--accent-glow)" }}>
              <Clock size={20} style={{ color: "var(--accent)" }} />
            </div>
          </div>
        </div>

        {/* Agent stats */}
        <div className="p-5 rounded-2xl animate-fade-in" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <div className="flex items-center gap-2 mb-3">
            <Sparkles size={14} style={{ color: "var(--accent)" }} />
            <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Agent Pro</span>
            <div className="ml-auto flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--success)", boxShadow: "0 0 6px var(--success)" }} />
              <span className="text-xs" style={{ color: "var(--success)" }}>En ligne</span>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[
              { v: sessions.length, l: "Conversations" },
              { v: totalMessages, l: "Messages" },
              { v: notes.length, l: "Notes" },
            ].map(({ v, l }) => (
              <div key={l} className="text-center p-2 rounded-xl" style={{ background: "var(--bg-secondary)" }}>
                <div className="text-xl font-bold" style={{ color: "var(--accent-light)" }}>{v}</div>
                <div className="text-xs" style={{ color: "var(--text-muted)" }}>{l}</div>
              </div>
            ))}
          </div>
          <button onClick={handleNewChat} className="btn-primary w-full mt-3 text-xs flex items-center justify-center gap-2">
            <Plus size={13} />
            Nouvelle conversation
          </button>
        </div>
      </div>

      {/* Quick modules */}
      <div className="mb-5">
        <div className="flex items-center gap-2 mb-3">
          <Zap size={13} style={{ color: "var(--text-muted)" }} />
          <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Accès rapide</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {modules.map(({ href, icon: Icon, label, desc, color, glow }, i) => (
            <Link key={href} href={href}
              className="group p-4 rounded-2xl transition-all duration-200 hover:scale-[1.02] animate-fade-in"
              style={{ background: "var(--bg-card)", border: "1px solid var(--border)", animationDelay: `${i * 50}ms` }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = color; (e.currentTarget as HTMLElement).style.boxShadow = `0 4px 16px ${glow}`; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border)"; (e.currentTarget as HTMLElement).style.boxShadow = "none"; }}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-2.5" style={{ background: `${color}18` }}>
                <Icon size={18} style={{ color }} />
              </div>
              <div className="font-semibold text-xs mb-0.5" style={{ color: "var(--text-primary)" }}>{label}</div>
              <div className="text-xs" style={{ color: "var(--text-muted)", fontSize: "10px" }}>{desc}</div>
            </Link>
          ))}
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Recent notes */}
        <div className="p-4 rounded-2xl" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <StickyNote size={14} style={{ color: "#f59e0b" }} />
              <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Notes récentes</span>
            </div>
            <Link href="/notes" className="text-xs flex items-center gap-1" style={{ color: "var(--accent)" }}>
              Voir tout <ArrowRight size={11} />
            </Link>
          </div>
          {recentNotes.length === 0 ? (
            <div className="text-center py-4">
              <p className="text-xs mb-2" style={{ color: "var(--text-muted)" }}>Aucune note</p>
              <Link href="/notes" className="text-xs font-medium" style={{ color: "var(--accent)" }}>+ Créer une note</Link>
            </div>
          ) : (
            <div className="space-y-2">
              {recentNotes.map((n) => (
                <div key={n.id} onClick={() => handleOpenNote(n.id)}
                  className="flex items-center gap-2 p-2 rounded-xl cursor-pointer transition-all"
                  style={{ background: "var(--bg-secondary)" }}
                  onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = "var(--bg-hover)"}
                  onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = "var(--bg-secondary)"}>
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: n.color }} />
                  <span className="text-xs font-medium flex-1 truncate" style={{ color: "var(--text-primary)" }}>{n.title}</span>
                  <span className="text-xs" style={{ color: "var(--text-muted)", fontSize: "10px" }}>
                    {new Date(n.updatedAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent chats */}
        <div className="p-4 rounded-2xl" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <MessageSquare size={14} style={{ color: "var(--accent)" }} />
              <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Conversations récentes</span>
            </div>
            <Link href="/chat" className="text-xs flex items-center gap-1" style={{ color: "var(--accent)" }}>
              Voir tout <ArrowRight size={11} />
            </Link>
          </div>
          {recentConvs.length === 0 ? (
            <div className="text-center py-4">
              <p className="text-xs mb-2" style={{ color: "var(--text-muted)" }}>Aucune conversation</p>
              <button onClick={handleNewChat} className="text-xs font-medium" style={{ color: "var(--accent)" }}>+ Démarrer un chat</button>
            </div>
          ) : (
            <div className="space-y-2">
              {recentConvs.map((s) => (
                <div key={s.id} onClick={() => handleResumeChat(s.id)}
                  className="flex items-center gap-2 p-2 rounded-xl cursor-pointer transition-all"
                  style={{ background: "var(--bg-secondary)" }}
                  onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = "var(--bg-hover)"}
                  onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = "var(--bg-secondary)"}>
                  <MessageSquare size={11} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                  <span className="text-xs flex-1 truncate" style={{ color: "var(--text-primary)" }}>{s.title}</span>
                  <span className="text-xs" style={{ color: "var(--text-muted)", fontSize: "10px" }}>{s.messages.length} msg</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Plus, Trash2, Search, StickyNote, Edit3, Eye, Sparkles } from "lucide-react";
import { useStore } from "@/lib/store";

function NotesContent() {
  const { notes, createNote, updateNote, deleteNote, sessions, createSession, setActiveSession, addMessage } = useStore();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [preview, setPreview] = useState(false);
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const id = searchParams.get("id");
    if (id && notes.find((n) => n.id === id)) { setSelectedId(id); return; }
    if (!selectedId && notes.length > 0) setSelectedId(notes[0].id);
  }, [notes, searchParams]);

  const selected = notes.find((n) => n.id === selectedId) || null;

  const filtered = notes.filter((n) =>
    !search || n.title.toLowerCase().includes(search.toLowerCase()) || n.content.toLowerCase().includes(search.toLowerCase())
  );

  const handleCreate = () => {
    const note = createNote();
    setSelectedId(note.id);
    setPreview(false);
  };

  const handleDelete = (id: string) => {
    deleteNote(id);
    const remaining = notes.filter((n) => n.id !== id);
    setSelectedId(remaining[0]?.id || null);
  };

  const askAIAboutNote = () => {
    if (!selected) return;
    const sessionId = createSession().id;
    addMessage(sessionId, {
      role: "user",
      content: `Voici une de mes notes intitulée "${selected.title}":\n\n${selected.content}\n\nPeux-tu m'aider à l'améliorer, la compléter ou en extraire les points clés ?`,
    });
    setActiveSession(sessionId);
    router.push("/chat");
  };

  const formatDate = (ts: number) =>
    new Date(ts).toLocaleDateString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="h-full flex" style={{ background: "var(--bg-primary)" }}>
      {/* Sidebar */}
      <div className="w-64 flex-shrink-0 flex flex-col h-full" style={{ background: "var(--bg-secondary)", borderRight: "1px solid var(--border)" }}>
        <div className="p-4 border-b" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center justify-between mb-3">
            <span className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>Notes ({notes.length})</span>
            <button onClick={handleCreate} className="w-7 h-7 rounded-lg flex items-center justify-center hover:scale-110 transition-transform"
              style={{ background: "linear-gradient(135deg, var(--accent), #8b5cf6)" }}>
              <Plus size={14} color="white" />
            </button>
          </div>
          <div className="relative">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher..."
              className="w-full pl-7 pr-3 py-1.5 rounded-lg text-xs outline-none"
              style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {filtered.length === 0 && (
            <div className="text-center py-8">
              <StickyNote size={22} className="mx-auto mb-2" style={{ color: "var(--text-muted)" }} />
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>{search ? "Aucun résultat" : "Aucune note"}</p>
            </div>
          )}
          {filtered.map((note) => (
            <div key={note.id} onClick={() => setSelectedId(note.id)}
              className="group p-3 rounded-xl cursor-pointer transition-all"
              style={{ background: selectedId === note.id ? "var(--bg-hover)" : "transparent", border: `1px solid ${selectedId === note.id ? "var(--border-light)" : "transparent"}` }}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-2 h-2 rounded-full flex-shrink-0 mt-0.5" style={{ background: note.color }} />
                  <span className="text-xs font-medium truncate" style={{ color: "var(--text-primary)" }}>{note.title}</span>
                </div>
                <button onClick={(e) => { e.stopPropagation(); handleDelete(note.id); }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" style={{ color: "var(--text-muted)" }}>
                  <Trash2 size={11} />
                </button>
              </div>
              <p className="text-xs mt-1 truncate pl-4" style={{ color: "var(--text-muted)" }}>
                {note.content.replace(/[#*`]/g, "").slice(0, 45)}
              </p>
              <p className="mt-1 pl-4" style={{ color: "var(--text-muted)", fontSize: "10px" }}>{formatDate(note.updatedAt)}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 flex flex-col h-full min-w-0">
        {selected ? (
          <>
            <div className="flex items-center gap-3 px-5 py-3 border-b flex-shrink-0" style={{ borderColor: "var(--border)", background: "var(--bg-secondary)" }}>
              <input value={selected.title}
                onChange={(e) => updateNote(selected.id, "title", e.target.value)}
                className="flex-1 bg-transparent font-semibold text-base outline-none"
                style={{ color: "var(--text-primary)" }} />
              <div className="flex items-center gap-1">
                <button onClick={askAIAboutNote}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all"
                  style={{ background: "rgba(108,99,255,0.15)", color: "var(--accent-light)", border: "1px solid rgba(108,99,255,0.3)" }}
                  title="Demander à l'IA">
                  <Sparkles size={12} />IA
                </button>
                <button onClick={() => setPreview(false)} className="p-2 rounded-lg"
                  style={{ background: !preview ? "var(--bg-hover)" : "transparent", color: !preview ? "var(--accent)" : "var(--text-muted)" }}>
                  <Edit3 size={14} />
                </button>
                <button onClick={() => setPreview(true)} className="p-2 rounded-lg"
                  style={{ background: preview ? "var(--bg-hover)" : "transparent", color: preview ? "var(--accent)" : "var(--text-muted)" }}>
                  <Eye size={14} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {preview ? (
                <div className="prose-dark p-6 max-w-3xl mx-auto">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{selected.content}</ReactMarkdown>
                </div>
              ) : (
                <textarea
                  key={selected.id}
                  defaultValue={selected.content}
                  onChange={(e) => updateNote(selected.id, "content", e.target.value)}
                  placeholder="Markdown supporté..."
                  className="w-full h-full p-6 bg-transparent resize-none outline-none font-mono text-sm leading-relaxed"
                  style={{ color: "var(--text-primary)" }}
                />
              )}
            </div>

            <div className="px-5 py-2 border-t flex items-center gap-4 flex-shrink-0" style={{ borderColor: "var(--border)", background: "var(--bg-secondary)" }}>
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>Modifié {formatDate(selected.updatedAt)}</span>
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>{selected.content.split(/\s+/).filter(Boolean).length} mots</span>
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>Markdown · Auto-sauvegardé</span>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center">
            <StickyNote size={36} className="mb-4" style={{ color: "var(--text-muted)" }} />
            <p className="text-sm mb-4" style={{ color: "var(--text-muted)" }}>Aucune note sélectionnée</p>
            <button onClick={handleCreate} className="btn-primary flex items-center gap-2"><Plus size={15} />Créer une note</button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function NotesPage() {
  return (
    <Suspense fallback={<div className="h-full flex items-center justify-center" style={{ color: "var(--text-muted)" }}>Chargement...</div>}>
      <NotesContent />
    </Suspense>
  );
}

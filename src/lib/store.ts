import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Message = { role: "user" | "assistant"; content: string; ts?: number };

export type ChatSession = {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
};

export type Note = {
  id: string;
  title: string;
  content: string;
  color: string;
  updatedAt: number;
};

export type UserPrefs = {
  name: string;
  lang: string;
  model: string;
  groqKey?: string;
};

interface AppStore {
  // Chat sessions
  sessions: ChatSession[];
  activeSessionId: string | null;
  createSession: () => ChatSession;
  setActiveSession: (id: string) => void;
  addMessage: (sessionId: string, msg: Message) => void;
  updateLastMessage: (sessionId: string, content: string) => void;
  deleteSession: (id: string) => void;
  getActiveSession: () => ChatSession | null;

  // Notes
  notes: Note[];
  createNote: () => Note;
  updateNote: (id: string, field: keyof Note, value: string | number) => void;
  deleteNote: (id: string) => void;

  // Google connection
  googleConnected: boolean;
  setGoogleConnected: (v: boolean) => void;

  // Draft email (cross-module: set by chat/visio, consumed by mail page)
  draftEmail: { to: string; subject: string; body: string } | null;
  setDraftEmail: (draft: { to: string; subject: string; body: string } | null) => void;

  // Prefs
  prefs: UserPrefs;
  updatePrefs: (p: Partial<UserPrefs>) => void;
}

const NOTE_COLORS = ["#6c63ff","#06b6d4","#f59e0b","#22c55e","#ec4899","#f97316"];

export const useStore = create<AppStore>()(
  persist(
    (set, get) => ({
      // ─── Chat ────────────────────────────────────────────────────────────
      sessions: [],
      activeSessionId: null,

      createSession: () => {
        const session: ChatSession = {
          id: Date.now().toString(),
          title: "Nouvelle conversation",
          messages: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        set((s) => ({ sessions: [session, ...s.sessions], activeSessionId: session.id }));
        return session;
      },

      setActiveSession: (id) => set({ activeSessionId: id }),

      addMessage: (sessionId, msg) => {
        set((s) => ({
          sessions: s.sessions.map((sess) => {
            if (sess.id !== sessionId) return sess;
            const messages = [...sess.messages, { ...msg, ts: Date.now() }];
            // Auto-title from first user message
            const title = sess.messages.length === 0 && msg.role === "user"
              ? msg.content.slice(0, 50) + (msg.content.length > 50 ? "..." : "")
              : sess.title;
            return { ...sess, messages, title, updatedAt: Date.now() };
          }),
        }));
      },

      updateLastMessage: (sessionId, content) => {
        set((s) => ({
          sessions: s.sessions.map((sess) => {
            if (sess.id !== sessionId) return sess;
            const messages = [...sess.messages];
            if (messages.length > 0) messages[messages.length - 1] = { ...messages[messages.length - 1], content };
            return { ...sess, messages, updatedAt: Date.now() };
          }),
        }));
      },

      deleteSession: (id) => {
        set((s) => {
          const sessions = s.sessions.filter((x) => x.id !== id);
          const activeSessionId = s.activeSessionId === id ? (sessions[0]?.id || null) : s.activeSessionId;
          return { sessions, activeSessionId };
        });
      },

      getActiveSession: () => {
        const { sessions, activeSessionId } = get();
        return sessions.find((s) => s.id === activeSessionId) || null;
      },

      // ─── Notes ───────────────────────────────────────────────────────────
      notes: [],

      createNote: () => {
        const { notes } = get();
        const note: Note = {
          id: Date.now().toString(),
          title: "Nouvelle note",
          content: "# Nouvelle note\n\nCommence à écrire...",
          color: NOTE_COLORS[notes.length % NOTE_COLORS.length],
          updatedAt: Date.now(),
        };
        set((s) => ({ notes: [note, ...s.notes] }));
        return note;
      },

      updateNote: (id, field, value) => {
        set((s) => ({
          notes: s.notes.map((n) =>
            n.id === id ? { ...n, [field]: value, updatedAt: Date.now() } : n
          ),
        }));
      },

      deleteNote: (id) => set((s) => ({ notes: s.notes.filter((n) => n.id !== id) })),

      // ─── Google ──────────────────────────────────────────────────────────
      googleConnected: false,
      setGoogleConnected: (v) => set({ googleConnected: v }),

      // ─── Draft email ─────────────────────────────────────────────────────
      draftEmail: null,
      setDraftEmail: (draft) => set({ draftEmail: draft }),

      // ─── Prefs ───────────────────────────────────────────────────────────
      prefs: { name: "Morgan", lang: "fr", model: "llama-3.3-70b-versatile" },
      updatePrefs: (p) => set((s) => ({ prefs: { ...s.prefs, ...p } })),
    }),
    {
      name: "agent-pro-store",
      partialize: (s) => ({
        sessions: s.sessions.slice(0, 50), // Keep last 50 sessions
        notes: s.notes,
        googleConnected: s.googleConnected,
        prefs: s.prefs,
      }),
    }
  )
);

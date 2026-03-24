"use client";

import {
  createContext,
  useContext,
  useRef,
  useState,
  useCallback,
  useEffect,
  ReactNode,
} from "react";
import { useStore } from "./store";

export type CallState = "idle" | "connecting" | "active" | "ended";
export type VoiceState = "ai_speaking" | "listening" | "thinking" | "idle";

// Voice state with advanced tracking
type VoiceStateInfo = {
  state: VoiceState;
  isInterruptible: boolean;
  interruptReady: boolean;
  startTime: number;
};

type ActionToast = { id: number; type: "note" | "mail" | "event"; message: string };
type EmailDraft = { to: string; subject: string; body: string };

interface VisioContextType {
  // State
  callState: CallState;
  voiceState: VoiceState;
  micOn: boolean;
  speakerOn: boolean;
  transcript: string;
  callDuration: number;
  userVolume: number;
  toasts: ActionToast[];
  pendingEmailDraft: EmailDraft | null;

  // Actions
  startCall: () => Promise<void>;
  endCall: () => void;
  toggleMic: () => void;
  toggleSpeaker: () => void;
  dismissEmailDraft: () => void;
  confirmEmailDraft: () => Promise<void>;

  // Camera (video elements stay in the page, streams live here)
  camStream: MediaStream | null;
  startCamera: () => Promise<void>;
  stopCamera: () => void;
  screenStream: MediaStream | null;
  startScreenShare: () => Promise<void>;
  stopScreenShare: () => void;
}

const VisioContext = createContext<VisioContextType | null>(null);

export function useVisio() {
  const ctx = useContext(VisioContext);
  if (!ctx) throw new Error("useVisio must be inside VisioProvider");
  return ctx;
}

// ── Smart voice selection ──────────────────────────────────────────────────────
function getBestVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  const fr = voices.filter((v) => v.lang.startsWith("fr"));
  if (!fr.length) return null;
  const score = (v: SpeechSynthesisVoice) => {
    let s = 0;
    if (v.name.includes("Google")) s += 20;
    if (v.name.includes("Neural") || v.name.includes("Premium") || v.name.includes("Enhanced")) s += 15;
    if (v.name === "Amélie" || v.name === "Thomas") s += 12;
    if (v.lang === "fr-FR") s += 4;
    return s;
  };
  return fr.sort((a, b) => score(b) - score(a))[0];
}

// ── Parse / strip action blocks ────────────────────────────────────────────────
type AiAction =
  | { type: "SEND_EMAIL"; to: string; subject: string; body: string }
  | { type: "CREATE_NOTE"; title: string; content: string }
  | { type: "ADD_EVENT"; title: string; date: string; time: string; endTime: string; location?: string };

function parseActions(text: string): AiAction[] {
  const out: AiAction[] = [];
  const re = /ACTION:(SEND_EMAIL|CREATE_NOTE|ADD_EVENT):(\{[^}]+\})/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    try {
      const d = JSON.parse(m[2]);
      if (m[1] === "SEND_EMAIL") out.push({ type: "SEND_EMAIL", ...d });
      else if (m[1] === "CREATE_NOTE") out.push({ type: "CREATE_NOTE", ...d });
      else if (m[1] === "ADD_EVENT") out.push({ type: "ADD_EVENT", ...d });
    } catch {}
  }
  return out;
}

function stripActions(t: string) {
  return t.replace(/\nACTION:(SEND_EMAIL|CREATE_NOTE|ADD_EVENT):\{[^\n]+\}/g, "")
          .replace(/ACTION:(SEND_EMAIL|CREATE_NOTE|ADD_EVENT):\{[^\n]+\}/g, "")
          .trim();
}

// ── Provider ───────────────────────────────────────────────────────────────────
export function VisioProvider({ children }: { children: ReactNode }) {
  const { notes, createNote, updateNote, setDraftEmail } = useStore();

  const [callState, setCallState] = useState<CallState>("idle");
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [micOn, setMicOn] = useState(true);
  const [speakerOn, setSpeakerOn] = useState(true);
  const [transcript, setTranscript] = useState("");
  const [callDuration, setCallDuration] = useState(0);
  const [userVolume, setUserVolume] = useState(0);
  const [toasts, setToasts] = useState<ActionToast[]>([]);
  const [pendingEmailDraft, setPendingEmailDraft] = useState<EmailDraft | null>(null);
  const [camStream, setCamStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);

  // Refs (survive re-renders and navigation)
  const callStateRef = useRef<CallState>("idle");
  const voiceStateRef = useRef<VoiceState>("idle");
  const speakerOnRef = useRef(true);
  const micOnRef = useRef(true);
  const notesRef = useRef(notes);
  const messagesRef = useRef<{ role: string; content: string }[]>([]);
  const liveCtxRef = useRef<object | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const vadTimerRef = useRef<NodeJS.Timeout | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const camStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const toastIdRef = useRef(0);
  const bargeInCooldownRef = useRef(false);
  const bestVoiceRef = useRef<SpeechSynthesisVoice | null>(null);

  useEffect(() => { speakerOnRef.current = speakerOn; }, [speakerOn]);
  useEffect(() => { micOnRef.current = micOn; }, [micOn]);
  useEffect(() => { notesRef.current = notes; }, [notes]);

  const setVoice = (vs: VoiceState) => { voiceStateRef.current = vs; setVoiceState(vs); };

  // Timer
  useEffect(() => {
    callStateRef.current = callState;
    if (callState === "active") {
      timerRef.current = setInterval(() => setCallDuration((d) => d + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      if (callState === "idle") setCallDuration(0);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [callState]);

  const addToast = useCallback((type: ActionToast["type"], message: string) => {
    const id = ++toastIdRef.current;
    setToasts((p) => [...p, { id, type, message }]);
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 4000);
  }, []);

  // ── Camera ───────────────────────────────────────────────────────────────────
  const startCamera = useCallback(async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      camStreamRef.current = s;
      setCamStream(s);
    } catch {}
  }, []);

  const stopCamera = useCallback(() => {
    camStreamRef.current?.getTracks().forEach((t) => t.stop());
    camStreamRef.current = null;
    setCamStream(null);
  }, []);

  const startScreenShare = useCallback(async () => {
    try {
      const s = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      screenStreamRef.current = s;
      setScreenStream(s);
      s.getVideoTracks()[0].onended = () => { screenStreamRef.current = null; setScreenStream(null); };
    } catch {}
  }, []);

  const stopScreenShare = useCallback(() => {
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenStreamRef.current = null;
    setScreenStream(null);
  }, []);

  // ── VAD ───────────────────────────────────────────────────────────────────────
  // Uses speech-band analysis (300–3000 Hz).
  // fftSize=512 → 256 bins, each ~86 Hz wide (at 44100 Hz).
  // Speech band = bins 3-35 (roughly 300–3000 Hz).
  // Compute average amplitude ONLY in that band → more immune to background noise.
  const startVAD = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      micStreamRef.current = stream;

      const audioCtx = new AudioContext();
      audioCtxRef.current = audioCtx;

      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 512;
      audioCtx.createMediaStreamSource(stream).connect(analyser);

      const data = new Uint8Array(analyser.frequencyBinCount);
      const binHz = audioCtx.sampleRate / analyser.fftSize;
      const lo = Math.round(300 / binHz);
      const hi = Math.round(3000 / binHz);
      const bandWidth = hi - lo + 1;

      let speechFrames = 0;
      const SPEECH_THRESHOLD = 18;  // Lower threshold = more sensitive
      const BARGE_IN_FRAMES = 3;     // Fewer frames needed = faster interrupt

      vadTimerRef.current = setInterval(() => {
        if (callStateRef.current !== "active") return;
        analyser.getByteFrequencyData(data);

        let sum = 0;
        for (let i = lo; i <= hi; i++) sum += data[i];
        const speechAvg = sum / bandWidth;
        setUserVolume(Math.min(100, speechAvg * 1.8));

        // Aggressive barge-in: interrupt quickly when speech detected
        if (speechAvg > SPEECH_THRESHOLD && micOnRef.current) {
          speechFrames++;
          if (speechFrames >= BARGE_IN_FRAMES && voiceStateRef.current === "ai_speaking" && !bargeInCooldownRef.current) {
            speechFrames = 0;
            bargeInCooldownRef.current = true;
            setTimeout(() => { bargeInCooldownRef.current = false; }, 800);  // Shorter cooldown
            interruptAI();
          }
        } else {
          speechFrames = 0;
        }
      }, 80);  // Faster polling (80ms instead of 100ms)
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stopVAD = useCallback(() => {
    if (vadTimerRef.current) clearInterval(vadTimerRef.current);
    audioCtxRef.current?.close().catch(() => {});
    micStreamRef.current?.getTracks().forEach((t) => t.stop());
    audioCtxRef.current = null;
    micStreamRef.current = null;
  }, []);

  // ── Recognition ──────────────────────────────────────────────────────────────
  const doStartListening = useCallback(() => {
    if (callStateRef.current !== "active" || !micOnRef.current) return;
    try { recognitionRef.current?.stop(); } catch {}
    recognitionRef.current = null;

    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;

    const r: SpeechRecognition = new SR();
    r.lang = "fr-FR";
    r.continuous = false;
    r.interimResults = false;
    r.maxAlternatives = 1;

    r.onresult = (e: SpeechRecognitionEvent) => {
      const text = e.results[0][0].transcript.trim();
      if (!text || text.length < 2) { scheduleListening(200); return; }
      setTranscript(`Toi : "${text}"`);
      setVoice("thinking");
      askAgent(text);
    };
    r.onerror = (e: Event) => {
      const err = (e as any).error;
      if (err === "no-speech" || err === "aborted") {
        if (voiceStateRef.current === "listening") scheduleListening(150);
      } else {
        scheduleListening(1000);
      }
    };
    r.onend = () => {
      if (voiceStateRef.current === "listening" && callStateRef.current === "active") scheduleListening(150);
    };
    try { r.start(); recognitionRef.current = r; } catch { scheduleListening(600); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const scheduleListening = (delay = 200) => {
    setTimeout(() => {
      if (callStateRef.current === "active" && voiceStateRef.current === "listening") doStartListening();
    }, delay);
  };

  // ── Interrupt AI ─────────────────────────────────────────────────────────────
  const interruptAI = useCallback(() => {
    window.speechSynthesis.cancel();
    setVoice("listening");
    doStartListening();
  }, [doStartListening]);

  // ── TTS ───────────────────────────────────────────────────────────────────────
  const speak = useCallback((text: string) => {
    if (!speakerOnRef.current) { 
      setVoice("listening"); 
      doStartListening(); 
      return; 
    }

    // Ensure clean text
    const cleanText = stripActions(text).trim();
    if (!cleanText) { 
      setVoice("listening"); 
      doStartListening(); 
      return; 
    }

    // Cancel previous speech
    try {
      window.speechSynthesis.cancel();
    } catch {}

    setVoice("ai_speaking");

    const doSpeak = () => {
      try {
        const utter = new SpeechSynthesisUtterance(cleanText);
        utter.lang = "fr-FR";
        utter.rate = 0.95;  // Slightly faster
        utter.pitch = 1.0;   // Natural pitch
        utter.volume = 1.0;
        
        if (!bestVoiceRef.current) {
          bestVoiceRef.current = getBestVoice();
        }
        if (bestVoiceRef.current) {
          utter.voice = bestVoiceRef.current;
        }

        const handleEnd = () => {
          if (voiceStateRef.current === "ai_speaking") {
            setVoice("listening");
            doStartListening();
          }
        };

        utter.onend = handleEnd;
        utter.onerror = (e) => {
          console.error("TTS Error:", e.error);
          handleEnd();
        };

        window.speechSynthesis.speak(utter);
      } catch (err) {
        console.error("Speak error:", err);
        setVoice("listening");
        doStartListening();
      }
    };

    // Get voices if not loaded
    if (window.speechSynthesis.getVoices().length === 0) {
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.onvoiceschanged = null;
        doSpeak();
      };
    } else {
      doSpeak();
    }
  }, [doStartListening]);

  // ── Execute actions ───────────────────────────────────────────────────────────
  const executeActions = useCallback(async (actions: AiAction[]) => {
    for (const a of actions) {
      if (a.type === "CREATE_NOTE") {
        const note = createNote();
        setTimeout(() => {
          updateNote(note.id, "title", a.title || "Note vocale");
          updateNote(note.id, "content", `# ${a.title || "Note vocale"}\n\n${a.content || ""}`);
        }, 50);
        addToast("note", `Note créée : \"${a.title}\"`);
      } else if (a.type === "UPDATE_NOTE") {
        if (a.id && (a.title || a.content)) {
          if (a.title) updateNote(a.id, "title", a.title);
          if (a.content) updateNote(a.id, "content", a.content);
          addToast("note", `Note modifiée : \"${a.title || a.id}\"`);
        }
      } else if (a.type === "DELETE_NOTE") {
        if (a.id) {
          deleteNote(a.id);
          addToast("note", `Note supprimée : \"${a.id}\"`);
        }
      } else if (a.type === "SEND_EMAIL") {
        setPendingEmailDraft({ to: a.to, subject: a.subject, body: a.body });
      } else if (a.type === "ADD_EVENT") {
        try {
          const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
          await fetch("/api/calendar", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              summary: a.title,
              location: a.location || "",
              start: { dateTime: `${a.date}T${a.time}:00`, timeZone: tz },
              end: { dateTime: `${a.date}T${a.endTime}:00`, timeZone: tz },
            }),
          });
          addToast("event", `Événement créé : \"${a.title}\"`);
        } catch {}
      }
    }
  }, [createNote, updateNote, deleteNote, addToast]);

  // ── Capture screen frame for AI analysis ──────────────────────────────────────
  const captureScreenFrame = useCallback(async (): Promise<string | null> => {
    if (!screenStreamRef.current) return null;
    try {
      const video = document.createElement("video");
      video.srcObject = screenStreamRef.current;
      video.play();
      
      await new Promise((resolve) => {
        video.onloadedmetadata = resolve;
      });

      const canvas = document.createElement("canvas");
      canvas.width = 1920;
      canvas.height = 1080;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      return new Promise((resolve) => {
        canvas.toBlob((blob) => {
          if (!blob) { resolve(null); return; }
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64 = (reader.result as string).split(",")[1];
            resolve(base64 || null);
          };
          reader.readAsDataURL(blob);
        }, "image/jpeg", 0.85);
      });
    } catch (err) {
      console.error("Failed to capture screen:", err);
      return null;
    }
  }, []);

  // ── AI call with context and screen analysis ──────────────────────────────────
  const askAgent = useCallback(async (userText: string) => {
    messagesRef.current.push({ role: "user", content: userText });
    
    try {
      // Capture screen if user is sharing
      const screenFrame = await captureScreenFrame();
      
      // Build API payload
      const payload = {
        messages: messagesRef.current,
        contexData: liveCtxRef.current,
        screenFrame: screenFrame || null,
      };

      const res = await fetch("/api/visio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let aiText = "";
      let isFirst = true;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        for (const line of decoder.decode(value).split("\n")) {
          if (!line.startsWith("data: ") || line === "data: [DONE]") continue;
          
          try {
            const data = JSON.parse(line.slice(6));
            if (data.text) {
              aiText += data.text;
              // Update display while streaming
              if (isFirst) {
                setTranscript(data.text);
                isFirst = false;
              }
            }
          } catch {}
        }
      }

      messagesRef.current.push({ role: "assistant", content: aiText });
      const actions = parseActions(aiText);
      if (actions.length) await executeActions(actions);
      
      const displayText = stripActions(aiText);
      setTranscript(displayText);
      speak(displayText);
    } catch (err) {
      console.error("API Error:", err);
      speak("Désolé, j'ai eu un problème technique. Peux-tu répéter ?");
    }
  }, [captureScreenFrame, speak, executeActions]);

  // ── Build system prompt ───────────────────────────────────────────────────────
  const buildSystemPrompt = useCallback(() => {
    const now = new Date().toLocaleString("fr-FR");
    const ctx = liveCtxRef.current as any;
    const currentNotes = notesRef.current;

    const notesSummary = currentNotes.length > 0
      ? "\n\n📝 NOTES :\n" + currentNotes.slice(0, 10).map((n) =>
          `• "${n.title}" : ${n.content.replace(/[#*`]/g, "").slice(0, 150)}`
        ).join("\n")
      : "";

    let calSummary = "";
    if (ctx?.events?.length) {
      calSummary = "\n\n📅 CALENDRIER :\n" + ctx.events.slice(0, 10).map((e: any) => {
        const start = e.start ? new Date(e.start).toLocaleString("fr-FR", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "";
        return `• ${e.summary}${start ? ` — ${start}` : ""}${e.location ? ` @ ${e.location}` : ""}`;
      }).join("\n");
    }

    let mailSummary = "";
    if (ctx?.emails?.length) {
      mailSummary = "\n\n📬 MAILS :\n" + ctx.emails.slice(0, 10).map((e: any) =>
        `• ${e.unread ? "🔵 " : ""}${e.from} — "${e.subject}" (${e.date || ""}) : ${e.snippet}`
      ).join("\n");
    }

    return `Tu es l'agent personnel et professionnel de Morgan, en appel vocal.
Tu t'appelles Agent Pro. Tu parles UNIQUEMENT en français. Réponses courtes et naturelles, comme une vraie conversation.
Tu es chaleureux, direct, parfois drôle, jamais robotique.
Date : ${now}.

ACTIONS — Termine ta phrase par un bloc si besoin :
ACTION:CREATE_NOTE:{"title":"...","content":"..."}
ACTION:ADD_EVENT:{"title":"...","date":"YYYY-MM-DD","time":"HH:MM","endTime":"HH:MM","location":"..."}
ACTION:SEND_EMAIL:{"to":"email@...","subject":"...","body":"..."}
(Le mail ne part pas sans confirmation de Morgan)${notesSummary}${calSummary}${mailSummary}`;
  }, []);

  // ── Start / End ───────────────────────────────────────────────────────────────
  const startCall = useCallback(async () => {
    setCallState("connecting");
    callStateRef.current = "connecting";
    try {
      const ctx = await fetch("/api/context").then((r) => r.json());
      liveCtxRef.current = ctx;
    } catch {}

    messagesRef.current = [{ role: "system", content: buildSystemPrompt() }];

    await startCamera();
    await startVAD();
    await new Promise((r) => setTimeout(r, 800));

    setCallState("active");
    callStateRef.current = "active";
    await new Promise((r) => setTimeout(r, 500));

    speak("Bonjour ! Prêt à t'aider. Tu peux m'interrompre à tout moment en parlant.");
  }, [startCamera, startVAD, buildSystemPrompt, speak]);

  const cleanup = useCallback(() => {
    window.speechSynthesis?.cancel();
    try { recognitionRef.current?.stop(); } catch {}
    stopCamera();
    stopScreenShare();
    stopVAD();
  }, [stopCamera, stopScreenShare, stopVAD]);

  const endCall = useCallback(() => {
    cleanup();
    callStateRef.current = "ended";
    setCallState("ended");
    setVoice("idle");
    setTranscript("");
    messagesRef.current = [];
    setTimeout(() => {
      setCallState("idle");
      callStateRef.current = "idle";
    }, 2000);
  }, [cleanup]);

  const toggleMic = useCallback(() => {
    const next = !micOnRef.current;
    micOnRef.current = next;
    setMicOn(next);
    if (!next) { try { recognitionRef.current?.stop(); } catch {} }
    else if (voiceStateRef.current === "listening") doStartListening();
  }, [doStartListening]);

  const toggleSpeaker = useCallback(() => {
    setSpeakerOn((p) => {
      speakerOnRef.current = !p;
      if (p) window.speechSynthesis.cancel(); // was on, now off
      return !p;
    });
  }, []);

  const confirmEmailDraft = useCallback(async () => {
    if (!pendingEmailDraft) return;
    await fetch("/api/gmail", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(pendingEmailDraft),
    });
    addToast("mail", `Mail envoyé à ${pendingEmailDraft.to}`);
    setPendingEmailDraft(null);
    speak("Mail envoyé !");
  }, [pendingEmailDraft, addToast, speak]);

  const dismissEmailDraft = useCallback(() => {
    // Send to mail page as draft instead
    if (pendingEmailDraft) setDraftEmail(pendingEmailDraft);
    setPendingEmailDraft(null);
  }, [pendingEmailDraft, setDraftEmail]);

  const value: VisioContextType = {
    callState, voiceState, micOn, speakerOn, transcript, callDuration,
    userVolume, toasts, pendingEmailDraft,
    startCall, endCall, toggleMic, toggleSpeaker,
    dismissEmailDraft, confirmEmailDraft,
    camStream, startCamera, stopCamera,
    screenStream, startScreenShare, stopScreenShare,
  };

  return <VisioContext.Provider value={value}>{children}</VisioContext.Provider>;
}

"use client";

import { usePathname, useRouter } from "next/navigation";
import { useVisio } from "@/lib/VisioContext";
import { Mic, MicOff, PhoneOff, Maximize2, Loader2, StickyNote, Mail, Calendar } from "lucide-react";

export default function FloatingCallBar() {
  const { callState, voiceState, micOn, callDuration, toasts, toggleMic, endCall } = useVisio();
  const pathname = usePathname();
  const router = useRouter();

  const isOnVisioPage = pathname === "/visio";
  const isActive = callState === "active" || callState === "connecting";

  const formatDuration = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  return (
    <>
      {/* Action toasts (show on all pages when in call) */}
      {isActive && toasts.length > 0 && (
        <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
          {toasts.map((t) => (
            <div key={t.id} className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-white"
              style={{ background: t.type === "note" ? "rgba(108,99,255,0.95)" : t.type === "mail" ? "rgba(234,67,53,0.95)" : "rgba(34,197,94,0.95)", boxShadow: "0 4px 20px rgba(0,0,0,0.3)" }}>
              {t.type === "note" ? <StickyNote size={12} /> : t.type === "mail" ? <Mail size={12} /> : <Calendar size={12} />}
              {t.message}
            </div>
          ))}
        </div>
      )}

      {/* Floating call bar — only when active and NOT on the visio page */}
      {isActive && !isOnVisioPage && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 px-4 py-3 rounded-2xl"
          style={{ background: "rgba(10,8,20,0.95)", border: "1px solid rgba(108,99,255,0.5)", backdropFilter: "blur(20px)", boxShadow: "0 8px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(108,99,255,0.2)" }}>

          {/* Pulse indicator */}
          <div className="flex items-center gap-2">
            <div className="relative w-2 h-2">
              <div className="w-2 h-2 rounded-full" style={{ background: voiceState === "ai_speaking" ? "#22c55e" : voiceState === "thinking" ? "#f59e0b" : "#6c63ff" }} />
              <div className="absolute inset-0 w-2 h-2 rounded-full animate-ping opacity-50"
                style={{ background: voiceState === "ai_speaking" ? "#22c55e" : "#6c63ff" }} />
            </div>
            <span className="text-xs font-semibold text-white">Agent Pro</span>
            {callState === "connecting" && <Loader2 size={11} className="animate-spin text-white opacity-60" />}
          </div>

          <div className="w-px h-5 opacity-30" style={{ background: "white" }} />

          <span className="text-xs font-mono text-white opacity-70">
            {callState === "connecting" ? "Connexion..." : formatDuration(callDuration)}
          </span>

          <div className="w-px h-5 opacity-30" style={{ background: "white" }} />

          <div className="text-xs opacity-50 text-white w-16">
            {voiceState === "ai_speaking" ? "parle" : voiceState === "thinking" ? "réfléchit..." : voiceState === "listening" ? "écoute" : ""}
          </div>

          <div className="flex items-center gap-2">
            <button onClick={toggleMic}
              className="w-8 h-8 rounded-full flex items-center justify-center transition-all hover:scale-110"
              style={{ background: micOn ? "rgba(255,255,255,0.12)" : "rgba(239,68,68,0.4)", color: micOn ? "white" : "#f87171" }}>
              {micOn ? <Mic size={14} /> : <MicOff size={14} />}
            </button>

            <button onClick={() => router.push("/visio")}
              className="w-8 h-8 rounded-full flex items-center justify-center transition-all hover:scale-110"
              style={{ background: "rgba(255,255,255,0.12)", color: "white" }}
              title="Retour à la visio">
              <Maximize2 size={14} />
            </button>

            <button onClick={endCall}
              className="w-8 h-8 rounded-full flex items-center justify-center transition-all hover:scale-110"
              style={{ background: "rgba(239,68,68,0.8)", color: "white" }}>
              <PhoneOff size={14} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}

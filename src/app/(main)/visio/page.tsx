"use client";

import { useEffect, useRef } from "react";
import { Mic, MicOff, Video, VideoOff, PhoneOff, Volume2, VolumeX, Loader2, Phone, Monitor, MonitorOff, Check } from "lucide-react";
import { useVisio } from "@/lib/VisioContext";
import { Mail } from "lucide-react";

// ─── AI Avatar (Canvas) ────────────────────────────────────────────────────────
function AIAvatar({ speaking, thinking }: { speaking: boolean; thinking: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const W = canvas.width, H = canvas.height;

    const draw = (t: number) => {
      ctx.clearRect(0, 0, W, H);
      const cx = W / 2, cy = H / 2;

      for (let r = 0; r < 3; r++) {
        const phase = (t / 1000 + r * 0.4) % 1;
        ctx.beginPath();
        ctx.arc(cx, cy, 80 + r * 20 + (speaking ? Math.sin(t / 150 + r) * 8 : 0) + phase * 30, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(108,99,255,${speaking ? 0.12 - phase * 0.1 : 0.05})`;
        ctx.lineWidth = 2; ctx.stroke();
      }

      const faceR = 70 + (speaking ? Math.sin(t / 120) * 3 : 0);
      const g = ctx.createRadialGradient(cx - 10, cy - 15, 10, cx, cy, faceR);
      g.addColorStop(0, "#1e1b4b"); g.addColorStop(0.6, "#0f0d2e"); g.addColorStop(1, "#050418");
      ctx.beginPath(); ctx.arc(cx, cy, faceR, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill();
      ctx.beginPath(); ctx.arc(cx, cy, faceR, 0, Math.PI * 2);
      ctx.strokeStyle = speaking ? "rgba(108,99,255,0.9)" : "rgba(108,99,255,0.4)";
      ctx.lineWidth = speaking ? 3 : 2; ctx.stroke();

      const eyeY = cy - 16;
      const blink = Math.sin(t / 2500);
      const eyeH = blink < 0.95 ? 8 : Math.max(1, 8 * (1 - (blink - 0.95) * 20));
      [-1, 1].forEach((side) => {
        const ex = cx + side * 22;
        ctx.beginPath(); ctx.ellipse(ex, eyeY, 9, eyeH, 0, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255,255,255,0.08)"; ctx.fill();
        if (eyeH > 2) {
          const ir = Math.min(6, eyeH * 0.75);
          const ig = ctx.createRadialGradient(ex, eyeY, 0, ex, eyeY, ir);
          ig.addColorStop(0, "#a78bfa"); ig.addColorStop(0.5, "#6c63ff"); ig.addColorStop(1, "#4338ca");
          ctx.beginPath(); ctx.arc(ex, eyeY, ir, 0, Math.PI * 2); ctx.fillStyle = ig; ctx.fill();
          ctx.beginPath(); ctx.arc(ex, eyeY, 2.5, 0, Math.PI * 2); ctx.fillStyle = "#000"; ctx.fill();
          ctx.beginPath(); ctx.arc(ex + 2, eyeY - 2, 1.5, 0, Math.PI * 2); ctx.fillStyle = "rgba(255,255,255,0.8)"; ctx.fill();
        }
        const by = eyeY - 14 + (thinking ? Math.sin(t / 400) * 2 : 0);
        ctx.beginPath(); ctx.moveTo(ex - 9, by + 2); ctx.quadraticCurveTo(ex, by - 2, ex + 9, by + 2);
        ctx.strokeStyle = "rgba(160,130,255,0.7)"; ctx.lineWidth = 2.5; ctx.lineCap = "round"; ctx.stroke();
      });

      ctx.beginPath(); ctx.moveTo(cx - 4, cy + 4); ctx.quadraticCurveTo(cx - 7, cy + 14, cx, cy + 16);
      ctx.quadraticCurveTo(cx + 7, cy + 14, cx + 4, cy + 4);
      ctx.strokeStyle = "rgba(150,130,255,0.3)"; ctx.lineWidth = 1.5; ctx.stroke();

      const mY = cy + 30;
      if (speaking) {
        const open = Math.abs(Math.sin(t / 120)) * 10;
        const curve = 3 + Math.sin(t / 180) * 2;
        ctx.beginPath(); ctx.moveTo(cx - 24, mY - open / 2);
        ctx.quadraticCurveTo(cx - 12, mY - open / 2 - curve, cx, mY - open / 2 - 1);
        ctx.quadraticCurveTo(cx + 12, mY - open / 2 - curve, cx + 24, mY - open / 2);
        ctx.strokeStyle = "rgba(180,150,255,0.8)"; ctx.lineWidth = 2; ctx.stroke();
        if (open > 2) {
          ctx.beginPath(); ctx.moveTo(cx - 24, mY - open / 2);
          ctx.quadraticCurveTo(cx, mY - open - 2, cx + 24, mY - open / 2);
          ctx.quadraticCurveTo(cx, mY + open / 2, cx - 24, mY - open / 2);
          ctx.fillStyle = "rgba(20,10,40,0.9)"; ctx.fill();
        }
        ctx.beginPath(); ctx.moveTo(cx - 24, mY + open / 2);
        ctx.quadraticCurveTo(cx, mY + open / 2 + curve + 2, cx + 24, mY + open / 2);
        ctx.strokeStyle = "rgba(180,150,255,0.8)"; ctx.lineWidth = 2; ctx.stroke();
        [-1, 1].forEach((side) => {
          for (let b = 0; b < 5; b++) {
            const bH = 8 + Math.abs(Math.sin(t / 100 + b * 0.8)) * (20 + b * 5);
            ctx.beginPath(); ctx.roundRect(cx + side * (faceR + 15 + b * 10) - 2, cy - bH / 2, 4, bH, 2);
            ctx.fillStyle = `rgba(108,99,255,${0.6 - b * 0.1})`; ctx.fill();
          }
        });
      } else {
        ctx.beginPath(); ctx.moveTo(cx - 24, mY); ctx.quadraticCurveTo(cx, mY + 6, cx + 24, mY);
        ctx.strokeStyle = "rgba(160,130,255,0.6)"; ctx.lineWidth = 2.5; ctx.lineCap = "round"; ctx.stroke();
      }
      if (thinking) {
        for (let i = 0; i < 5; i++) {
          const angle = (t / 800 + i * (Math.PI * 2) / 5) % (Math.PI * 2);
          const pr = 90 + Math.sin(t / 300 + i) * 10;
          ctx.beginPath(); ctx.arc(cx + Math.cos(angle) * pr, cy + Math.sin(angle) * pr, 2 + Math.sin(t / 200 + i * 1.5) * 1.5, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(108,99,255,${0.4 + Math.sin(t / 300 + i) * 0.3})`; ctx.fill();
        }
      }
      animRef.current = requestAnimationFrame(draw);
    };
    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, [speaking, thinking]);

  return <canvas ref={canvasRef} width={300} height={300} className="w-full h-full object-contain" style={{ maxWidth: "300px", maxHeight: "300px" }} />;
}

// ─── Main page ─────────────────────────────────────────────────────────────────
export default function VisioPage() {
  const {
    callState, voiceState, micOn, speakerOn, transcript, callDuration, userVolume,
    pendingEmailDraft, startCall, endCall, toggleMic, toggleSpeaker,
    dismissEmailDraft, confirmEmailDraft,
    camStream, startCamera, stopCamera, screenStream, startScreenShare, stopScreenShare,
  } = useVisio();

  const videoRef = useRef<HTMLVideoElement>(null);
  const screenVideoRef = useRef<HTMLVideoElement>(null);

  // Re-attach camera stream to video element when entering the page or stream changes
  useEffect(() => {
    if (videoRef.current && camStream) {
      videoRef.current.srcObject = camStream;
      videoRef.current.play().catch(() => {});
    }
  }, [camStream]);

  useEffect(() => {
    if (screenVideoRef.current && screenStream) {
      screenVideoRef.current.srcObject = screenStream;
      screenVideoRef.current.play().catch(() => {});
    }
  }, [screenStream]);

  const formatDuration = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  const aiSpeaking = voiceState === "ai_speaking";
  const aiThinking = voiceState === "thinking";
  const isListening = voiceState === "listening";
  const camOn = !!camStream;
  const screenSharing = !!screenStream;

  // ── Idle (waiting to start call) ──────────────────────────────────────────
  if (callState === "idle") return (
    <div className="h-full flex items-center justify-center p-8" style={{ background: "var(--bg-primary)" }}>
      <div className="text-center animate-fade-in">
        <div className="flex justify-center mb-6">
          <div className="relative w-36 h-36 rounded-full flex items-center justify-center animate-pulse-glow"
            style={{ background: "linear-gradient(135deg, #0f0d2e, #1e1b4b)", border: "2px solid rgba(108,99,255,0.5)" }}>
            <AIAvatar speaking={false} thinking={false} />
            <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center"
              style={{ background: "var(--success)", border: "2px solid var(--bg-primary)" }}>
              <div className="w-2 h-2 rounded-full bg-white" />
            </div>
          </div>
        </div>
        <h2 className="text-2xl font-bold mb-1" style={{ color: "var(--text-primary)" }}>Agent Pro</h2>
        <p className="text-sm mb-4" style={{ color: "var(--text-muted)" }}>L'assistant vocal intelligent</p>
        <div className="flex flex-wrap gap-2 justify-center text-xs mb-8 max-w-md mx-auto">
          {[
            "🎤 Parle naturellement",
            "🤚 Interromps l'agent",
            "👁️ Agent voit ton écran",
            "📝 Crée des notes",
            "📅 Gère ton calendrier",
            "🚀 Rapide & intelligent"
          ].map((t) => (
            <span key={t} className="px-2.5 py-1 rounded-lg whitespace-nowrap" style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-muted)" }}>
              {t}
            </span>
          ))}
        </div>
        <button onClick={startCall}
          className="inline-flex items-center gap-3 px-8 py-4 rounded-2xl text-white font-semibold text-lg transition-all hover:scale-105 active:scale-95"
          style={{ background: "linear-gradient(135deg, #22c55e, #16a34a)", boxShadow: "0 12px 40px rgba(34,197,94,0.35)" }}>
          <Phone size={22} />Démarrer l&apos;appel
        </button>
        <p className="text-xs mt-6" style={{ color: "var(--text-muted)" }}>
          ✓ Chrome/Edge recommandé · ✓ Autorise micro + caméra · ✓ Aucun coût d'utilisation
        </p>
      </div>
    </div>
  );

  if (callState === "ended") return (
    <div className="h-full flex items-center justify-center" style={{ background: "var(--bg-primary)" }}>
      <div className="text-center animate-fade-in">
        <div className="text-5xl mb-4">👋</div>
        <p className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>Appel terminé</p>
        <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>Durée : {formatDuration(callDuration)}</p>
      </div>
    </div>
  );

  return (
    <div className="h-full flex flex-col relative overflow-hidden" style={{ background: "#050408" }}>
      {/* Ambient gradient */}
      <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse at 30% 50%, rgba(108,99,255,0.08) 0%, transparent 60%)" }} />

      {/* Email draft confirmation modal */}
      {pendingEmailDraft && (
        <div className="absolute inset-0 z-40 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.8)" }}>
          <div className="w-full max-w-sm rounded-2xl overflow-hidden animate-fade-in backdrop-blur-sm" style={{ background: "#0f0d2e", border: "1px solid rgba(108,99,255,0.5)" }}>
            <div className="px-4 py-3 flex items-center gap-2" style={{ background: "rgba(108,99,255,0.15)" }}>
              <Mail size={14} style={{ color: "#a78bfa" }} />
              <span className="text-sm font-semibold text-white">Confirmer l&apos;envoi du mail</span>
            </div>
            <div className="p-4 space-y-2">
              <div className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>À : <span className="text-white font-medium">{pendingEmailDraft.to}</span></div>
              <div className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>Objet : <span className="text-white font-medium">{pendingEmailDraft.subject}</span></div>
              <p className="text-xs text-white/70 whitespace-pre-wrap mt-3 pb-2" style={{ maxHeight: "120px", overflow: "auto" }}>
                {pendingEmailDraft.body.slice(0, 300)}{pendingEmailDraft.body.length > 300 ? "..." : ""}
              </p>
            </div>
            <div className="px-4 py-3 flex gap-2" style={{ background: "rgba(0,0,0,0.3)" }}>
              <button onClick={dismissEmailDraft} className="flex-1 py-2.5 rounded-lg text-xs font-medium text-white/70 transition-colors hover:text-white"
                style={{ background: "rgba(255,255,255,0.08)" }}>
                Modifier dans Mail
              </button>
              <button onClick={confirmEmailDraft} className="flex-1 py-2.5 rounded-lg text-xs text-white font-semibold flex items-center justify-center gap-1.5 transition-all hover:scale-105"
                style={{ background: "linear-gradient(135deg, #6c63ff, #8b5cf6)" }}>
                <Check size={13} />Envoyer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loading overlay */}
      {callState === "connecting" && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center backdrop-blur-sm" style={{ background: "rgba(5,4,8,0.9)" }}>
          <div className="mb-4 p-4 rounded-2xl" style={{ background: "rgba(108,99,255,0.1)" }}>
            <Loader2 size={40} className="animate-spin" style={{ color: "#6c63ff" }} />
          </div>
          <p className="text-white font-semibold">Lancement de l&apos;appel...</p>
          <p className="text-sm text-white/40 mt-2">Chargement du contexte personnel...</p>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex min-h-0 relative">
        {/* AI side - left */}
        <div className="flex-1 flex flex-col items-center justify-center relative" style={{ borderRight: "1px solid rgba(108,99,255,0.15)" }}>
          <div className="absolute top-5 left-5 z-10 px-3 py-1.5 rounded-full flex items-center gap-2"
            style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full" style={{
                background: aiSpeaking ? "var(--success)" : aiThinking ? "#f59e0b" : isListening ? "#6366f1" : "rgba(255,255,255,0.3)",
                boxShadow: aiSpeaking ? "0 0 8px var(--success)" : aiThinking ? "0 0 8px #f59e0b" : "none",
              }} />
              <span className="text-xs text-white font-medium uppercase tracking-wide">Agent Pro</span>
            </div>
            {aiThinking && <Loader2 size={10} className="animate-spin opacity-70" style={{ color: "#f59e0b" }} />}
          </div>

          {/* Agent avatar */}
          <div style={{ width: "280px", height: "280px" }} className="mb-4">
            <AIAvatar speaking={aiSpeaking} thinking={aiThinking} />
          </div>

          {/* Transcript display */}
          {transcript && (
            <div className="absolute bottom-8 left-4 right-4 px-4 py-3 rounded-xl text-center text-sm"
              style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.9)", maxHeight: "100px", overflow: "auto" }}>
              {transcript}
            </div>
          )}
        </div>

        {/* User side - right */}
        <div className="flex-1 flex flex-col items-center justify-center relative bg-black/40">
          <div className="absolute top-5 left-5 z-10 px-3 py-1.5 rounded-full flex items-center gap-1.5"
            style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <span className="text-xs text-white font-medium uppercase tracking-wide">Toi</span>
            {!micOn && <MicOff size={12} style={{ color: "#ef4444" }} />}
          </div>

          {/* Volume meter */}
          <div className="absolute top-5 right-5 z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-full"
            style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div className="flex items-end gap-0.5 h-4">
              {[0.2, 0.4, 0.6, 0.8, 1].map((scale, i) => (
                <div key={i} className="w-0.5 rounded-full transition-all duration-75"
                  style={{ 
                    height: `${Math.max(3, userVolume * scale * 0.12)}px`, 
                    background: userVolume > 25 ? "#22c55e" : "rgba(255,255,255,0.25)" 
                  }} />
              ))}
            </div>
          </div>

          {/* Display shared screen if present, otherwise camera */}
          {screenSharing && (
            <div className="absolute inset-0 flex items-center justify-center z-5 bg-black/80">
              <div className="relative w-full h-full flex items-center justify-center">
                <video ref={screenVideoRef} autoPlay muted playsInline className="w-full h-full object-contain" />
                <div className="absolute top-4 left-4 px-3 py-1.5 rounded-lg text-xs font-medium text-white flex items-center gap-2"
                  style={{ background: "rgba(239,68,68,0.3)", backdropFilter: "blur(10px)" }}>
                  <Monitor size={13} style={{ color: "#ef4444" }} />
                  Partage d'écran actif
                </div>
              </div>
            </div>
          )}

          {camOn ? (
            <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" style={{ transform: "scaleX(-1)" }} />
          ) : (
            <div className="flex flex-col items-center gap-4">
              <div className="w-24 h-24 rounded-full flex items-center justify-center text-5xl font-bold text-white" style={{ background: "linear-gradient(135deg, var(--accent), #8b5cf6)" }}>
                M
              </div>
              <span className="text-sm text-white opacity-50">Caméra désactivée</span>
            </div>
          )}
        </div>
      </div>

      {/* Control bar */}
      <div className="shrink-0 px-8 py-6 flex items-center justify-between"
        style={{ background: "rgba(5,4,8,0.95)", backdropFilter: "blur(20px)", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
        
        {/* Duration display */}
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: "var(--success)" }} />
          <span className="text-sm text-white font-mono font-semibold">{formatDuration(callDuration)}</span>
        </div>

        {/* Control buttons */}
        <div className="flex items-center gap-4">
          <button onClick={toggleMic} className="w-14 h-14 rounded-full flex items-center justify-center transition-all active:scale-95"
            style={{ 
              background: micOn ? "rgba(255,255,255,0.12)" : "rgba(239,68,68,0.25)", 
              color: micOn ? "white" : "#ef4444",
              border: `1.5px solid ${micOn ? "rgba(255,255,255,0.15)" : "rgba(239,68,68,0.3)"}`,
              boxShadow: micOn ? "0 0 20px rgba(255,255,255,0.1)" : "none"
            }}>
            {micOn ? <Mic size={22} /> : <MicOff size={22} />}
          </button>
          
          <button onClick={() => { camOn ? stopCamera() : startCamera(); }} className="w-14 h-14 rounded-full flex items-center justify-center transition-all active:scale-95"
            style={{ 
              background: camOn ? "rgba(255,255,255,0.12)" : "rgba(239,68,68,0.25)", 
              color: camOn ? "white" : "#ef4444",
              border: `1.5px solid ${camOn ? "rgba(255,255,255,0.15)" : "rgba(239,68,68,0.3)"}`,
            }}>
            {camOn ? <Video size={22} /> : <VideoOff size={22} />}
          </button>
          
          <button onClick={screenSharing ? stopScreenShare : startScreenShare} className="w-14 h-14 rounded-full flex items-center justify-center transition-all active:scale-95"
            style={{ 
              background: screenSharing ? "rgba(239,68,68,0.25)" : "rgba(255,255,255,0.12)", 
              color: screenSharing ? "#ef4444" : "white",
              border: `1.5px solid ${screenSharing ? "rgba(239,68,68,0.3)" : "rgba(255,255,255,0.15)"}`,
            }}>
            {screenSharing ? <MonitorOff size={22} /> : <Monitor size={22} />}
          </button>
          
          <button onClick={toggleSpeaker} className="w-14 h-14 rounded-full flex items-center justify-center transition-all active:scale-95"
            style={{ 
              background: "rgba(255,255,255,0.12)", 
              color: speakerOn ? "white" : "#f59e0b",
              border: `1.5px solid rgba(255,255,255,0.15)`,
            }}>
            {speakerOn ? <Volume2 size={22} /> : <VolumeX size={22} />}
          </button>
          
          <div style={{ width: "1px", height: "30px", background: "rgba(255,255,255,0.1)" }} />
          
          <button onClick={endCall} className="w-16 h-14 rounded-full flex items-center justify-center transition-all active:scale-95 hover:scale-105"
            style={{ 
              background: "linear-gradient(135deg, #ef4444, #dc2626)", 
              color: "white",
              boxShadow: "0 6px 25px rgba(239,68,68,0.4)", 
              border: "none" 
            }}>
            <PhoneOff size={22} />
          </button>
        </div>

        {/* Status indicator */}
        <div className="text-right text-xs">
          {isListening && <span style={{ color: "#6366f1" }}>● écoutant...</span>}
          {aiThinking && <span style={{ color: "var(--accent)" }}>● réfléchit...</span>}
          {aiSpeaking && <span style={{ color: "var(--success)" }}>● parle...</span>}
        </div>
      </div>
    </div>
  );
}

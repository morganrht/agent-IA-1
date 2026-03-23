"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Plus, Clock, MapPin, X, Loader2, Calendar } from "lucide-react";

type GCalEvent = {
  id: string;
  summary?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  location?: string;
  htmlLink?: string;
  colorId?: string;
};

const COLORS = ["#6c63ff","#06b6d4","#f59e0b","#22c55e","#ec4899","#f97316","#8b5cf6","#14b8a6","#ef4444","#3b82f6","#a855f7","#eab308"];
const MONTHS_FR = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];
const DAYS_FR = ["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"];

function todayStr() { return new Date().toISOString().split("T")[0]; }

function eventColor(e: GCalEvent) {
  if (e.colorId) return COLORS[parseInt(e.colorId) % COLORS.length];
  return COLORS[0];
}

function formatEventTime(e: GCalEvent) {
  const dt = e.start.dateTime;
  if (!dt) return "Toute la journée";
  return new Date(dt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function eventDateStr(e: GCalEvent) {
  const raw = e.start.dateTime || e.start.date || "";
  return raw.split("T")[0];
}

type Recurrence = "none" | "daily" | "weekly" | "biweekly" | "monthly";
type NewEvent = { title: string; date: string; time: string; endTime: string; location: string; recurrence: Recurrence };

const RECURRENCE_OPTIONS: { value: Recurrence; label: string; rrule: string | null }[] = [
  { value: "none", label: "Pas de récurrence", rrule: null },
  { value: "daily", label: "Tous les jours", rrule: "RRULE:FREQ=DAILY" },
  { value: "weekly", label: "Toutes les semaines", rrule: "RRULE:FREQ=WEEKLY" },
  { value: "biweekly", label: "Toutes les 2 semaines", rrule: "RRULE:FREQ=WEEKLY;INTERVAL=2" },
  { value: "monthly", label: "Tous les mois", rrule: "RRULE:FREQ=MONTHLY" },
];

function CalendarContent() {
  const searchParams = useSearchParams();
  const [connected, setConnected] = useState(false);
  const [events, setEvents] = useState<GCalEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewDate, setViewDate] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newEvent, setNewEvent] = useState<NewEvent>({ title: "", date: selectedDate, time: "09:00", endTime: "10:00", location: "", recurrence: "none" });

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/calendar");
      if (res.status === 401) { setConnected(false); setLoading(false); return; }
      const data = await res.json();
      setEvents(data.items || []);
      setConnected(true);
    } catch { setConnected(false); }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  useEffect(() => {
    if (searchParams.get("connected") === "true") fetchEvents();
  }, [searchParams, fetchEvents]);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  let startDow = firstDay.getDay();
  startDow = startDow === 0 ? 6 : startDow - 1;

  const days: (Date | null)[] = [];
  for (let i = 0; i < startDow; i++) days.push(null);
  for (let d = 1; d <= lastDay.getDate(); d++) days.push(new Date(year, month, d));

  const eventsOnDate = (date: Date) => {
    const str = date.toISOString().split("T")[0];
    return events.filter((e) => eventDateStr(e) === str);
  };

  const selectedEvents = events.filter((e) => eventDateStr(e) === selectedDate);

  const saveEvent = async () => {
    if (!newEvent.title.trim()) return;
    setSaving(true);
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const rrule = RECURRENCE_OPTIONS.find((r) => r.value === newEvent.recurrence)?.rrule;
    const body: object = {
      summary: newEvent.title,
      location: newEvent.location,
      start: { dateTime: `${newEvent.date}T${newEvent.time}:00`, timeZone: tz },
      end: { dateTime: `${newEvent.date}T${newEvent.endTime}:00`, timeZone: tz },
      ...(rrule ? { recurrence: [rrule] } : {}),
    };
    const res = await fetch("/api/calendar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (res.ok) { await fetchEvents(); setShowModal(false); setNewEvent({ title: "", date: selectedDate, time: "09:00", endTime: "10:00", location: "", recurrence: "none" }); }
    setSaving(false);
  };

  const deleteEvent = async (id: string) => {
    await fetch("/api/calendar", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ eventId: id }) });
    setEvents((prev) => prev.filter((e) => e.id !== id));
  };

  const formatSelectedDate = () => {
    const d = new Date(selectedDate + "T12:00:00");
    return d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  };

  return (
    <div className="h-full flex flex-col md:flex-row overflow-hidden" style={{ background: "var(--bg-primary)" }}>

      {/* Add Event Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)" }} onClick={() => setShowModal(false)}>
          <div className="w-full max-w-md rounded-2xl p-6 animate-fade-in" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-base" style={{ color: "var(--text-primary)" }}>Nouvel événement</h3>
              <button onClick={() => setShowModal(false)} style={{ color: "var(--text-muted)" }}><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <input value={newEvent.title} onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })} placeholder="Titre de l'événement *" className="input-dark text-sm" />
              <input type="date" value={newEvent.date} onChange={(e) => setNewEvent({ ...newEvent, date: e.target.value })} className="input-dark text-sm" style={{ colorScheme: "dark" }} />
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-xs mb-1 block" style={{ color: "var(--text-muted)" }}>Début</label>
                  <input type="time" value={newEvent.time} onChange={(e) => setNewEvent({ ...newEvent, time: e.target.value })} className="input-dark text-sm" style={{ colorScheme: "dark" }} />
                </div>
                <div className="flex-1">
                  <label className="text-xs mb-1 block" style={{ color: "var(--text-muted)" }}>Fin</label>
                  <input type="time" value={newEvent.endTime} onChange={(e) => setNewEvent({ ...newEvent, endTime: e.target.value })} className="input-dark text-sm" style={{ colorScheme: "dark" }} />
                </div>
              </div>
              <input value={newEvent.location} onChange={(e) => setNewEvent({ ...newEvent, location: e.target.value })} placeholder="Lieu (optionnel)" className="input-dark text-sm" />
              <div>
                <label className="text-xs mb-1 block" style={{ color: "var(--text-muted)" }}>Récurrence</label>
                <select value={newEvent.recurrence} onChange={(e) => setNewEvent({ ...newEvent, recurrence: e.target.value as Recurrence })}
                  className="input-dark text-sm w-full" style={{ colorScheme: "dark" }}>
                  {RECURRENCE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setShowModal(false)} className="btn-ghost flex-1 text-sm">Annuler</button>
              <button onClick={saveEvent} disabled={saving || !newEvent.title.trim()} className="btn-primary flex-1 text-sm flex items-center justify-center gap-2">
                {saving ? <Loader2 size={14} className="animate-spin" /> : null}
                {saving ? "Enregistrement..." : "Créer l'événement"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Calendar grid */}
      <div className="flex-1 flex flex-col p-4 md:p-6 min-w-0" style={{ borderRight: "1px solid var(--border)" }}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <button onClick={() => { setViewDate(new Date(new Date().getFullYear(), new Date().getMonth(), 1)); setSelectedDate(todayStr()); }} className="btn-ghost text-xs">Aujourd'hui</button>
            <div className="flex items-center gap-1">
              <button onClick={() => setViewDate(new Date(year, month - 1, 1))} className="p-1.5 rounded-lg transition-all" style={{ color: "var(--text-secondary)" }} onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background="var(--bg-hover)"} onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background="transparent"}><ChevronLeft size={18} /></button>
              <button onClick={() => setViewDate(new Date(year, month + 1, 1))} className="p-1.5 rounded-lg transition-all" style={{ color: "var(--text-secondary)" }} onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background="var(--bg-hover)"} onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background="transparent"}><ChevronRight size={18} /></button>
            </div>
            <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>{MONTHS_FR[month]} {year}</h2>
          </div>
          <div className="flex items-center gap-2">
            {loading && <Loader2 size={14} className="animate-spin" style={{ color: "var(--text-muted)" }} />}
            {!connected ? (
              <a href="/api/auth/google" className="btn-primary flex items-center gap-2 text-xs">
                <img src="/google.svg" width={14} height={14} alt="Google" />
                Connecter Google
              </a>
            ) : (
              <div className="flex items-center gap-1.5">
                <img src="/google.svg" width={14} height={14} alt="Google" />
                <span className="text-xs" style={{ color: "var(--success)" }}>Google connecté</span>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-7 mb-1">
          {DAYS_FR.map((d) => (
            <div key={d} className="text-center text-xs font-semibold py-2" style={{ color: "var(--text-muted)" }}>{d}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-0.5 flex-1">
          {days.map((date, i) => {
            if (!date) return <div key={`e${i}`} />;
            const str = date.toISOString().split("T")[0];
            const isToday = str === todayStr();
            const isSel = str === selectedDate;
            const dayEvs = eventsOnDate(date);
            return (
              <div key={str} onClick={() => setSelectedDate(str)}
                className="rounded-xl p-1.5 cursor-pointer transition-all min-h-[56px]"
                style={{ background: isSel ? "var(--accent-glow)" : isToday ? "rgba(108,99,255,0.08)" : "transparent", border: `1px solid ${isSel ? "var(--accent)" : isToday ? "rgba(108,99,255,0.3)" : "transparent"}` }}>
                <div className="text-xs font-semibold w-5 h-5 flex items-center justify-center rounded-full mb-0.5"
                  style={{ color: isSel || isToday ? "var(--accent-light)" : "var(--text-secondary)", background: isToday && !isSel ? "rgba(108,99,255,0.2)" : "transparent" }}>
                  {date.getDate()}
                </div>
                <div className="space-y-0.5">
                  {dayEvs.slice(0, 2).map((ev) => (
                    <div key={ev.id} className="text-xs px-1 py-0.5 rounded truncate"
                      style={{ background: `${eventColor(ev)}20`, color: eventColor(ev), fontSize: "10px" }}>
                      {ev.summary || "Sans titre"}
                    </div>
                  ))}
                  {dayEvs.length > 2 && <div style={{ color: "var(--text-muted)", fontSize: "10px" }}>+{dayEvs.length - 2}</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Day detail */}
      <div className="w-full md:w-72 flex-shrink-0 flex flex-col" style={{ background: "var(--bg-secondary)" }}>
        <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: "var(--border)" }}>
          <div>
            <div className="font-semibold text-sm capitalize" style={{ color: "var(--text-primary)" }}>{formatSelectedDate()}</div>
            <div className="text-xs" style={{ color: "var(--text-muted)" }}>{selectedEvents.length} événement{selectedEvents.length !== 1 ? "s" : ""}</div>
          </div>
          <button onClick={() => { setNewEvent({ ...newEvent, date: selectedDate }); setShowModal(true); }}
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, var(--accent), #8b5cf6)" }}>
            <Plus size={14} color="white" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {!connected && (
            <div className="p-4 rounded-xl text-center" style={{ background: "rgba(108,99,255,0.08)", border: "1px solid rgba(108,99,255,0.2)" }}>
              <img src="/google.svg" width={32} height={32} alt="Google" className="mx-auto mb-2" />
              <p className="text-xs mb-3" style={{ color: "var(--text-secondary)" }}>Connecte Google Calendar pour voir tes vrais événements</p>
              <a href="/api/auth/google" className="btn-primary text-xs inline-block">Connecter Google →</a>
            </div>
          )}
          {connected && selectedEvents.length === 0 && (
            <div className="text-center py-10">
              <Calendar size={28} className="mx-auto mb-3" style={{ color: "var(--text-muted)" }} />
              <p className="text-sm mb-3" style={{ color: "var(--text-muted)" }}>Aucun événement</p>
              <button onClick={() => setShowModal(true)} className="btn-ghost text-xs flex items-center gap-1 mx-auto"><Plus size={12} />Ajouter</button>
            </div>
          )}
          {selectedEvents.map((ev) => (
            <div key={ev.id} className="p-3 rounded-xl group"
              style={{ background: "var(--bg-card)", border: `1px solid ${eventColor(ev)}30`, borderLeft: `3px solid ${eventColor(ev)}` }}>
              <div className="flex items-start justify-between gap-2">
                <span className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>{ev.summary || "Sans titre"}</span>
                <button onClick={() => deleteEvent(ev.id)} className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" style={{ color: "var(--text-muted)" }}>
                  <X size={13} />
                </button>
              </div>
              <div className="mt-1.5 space-y-1">
                {ev.start.dateTime && (
                  <div className="flex items-center gap-1.5">
                    <Clock size={11} style={{ color: "var(--text-muted)" }} />
                    <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{formatEventTime(ev)}</span>
                  </div>
                )}
                {ev.location && (
                  <div className="flex items-center gap-1.5">
                    <MapPin size={11} style={{ color: "var(--text-muted)" }} />
                    <span className="text-xs truncate" style={{ color: "var(--text-secondary)" }}>{ev.location}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function CalendarPage() {
  return (
    <Suspense fallback={<div className="h-full flex items-center justify-center" style={{ color: "var(--text-muted)" }}>Chargement...</div>}>
      <CalendarContent />
    </Suspense>
  );
}

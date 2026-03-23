"use client";

import { useState } from "react";
import {
  Settings,
  Key,
  Mail,
  Calendar,
  Bell,
  Shield,
  ChevronRight,
  Check,
  ExternalLink,
} from "lucide-react";

type Section = "general" | "api" | "email" | "calendar" | "notifications";

export default function SettingsPage() {
  const [section, setSection] = useState<Section>("general");
  const [saved, setSaved] = useState(false);

  const save = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const sections: { id: Section; icon: React.ElementType; label: string }[] = [
    { id: "general", icon: Settings, label: "Général" },
    { id: "api", icon: Key, label: "Clé API Groq" },
    { id: "email", icon: Mail, label: "Boîtes mail" },
    { id: "calendar", icon: Calendar, label: "Calendrier" },
    { id: "notifications", icon: Bell, label: "Notifications" },
  ];

  return (
    <div className="h-full flex overflow-hidden" style={{ background: "var(--bg-primary)" }}>
      {/* Sidebar */}
      <div
        className="w-56 flex-shrink-0 p-3 border-r"
        style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}
      >
        <p className="text-xs font-semibold uppercase tracking-wider px-3 py-2 mb-1" style={{ color: "var(--text-muted)" }}>
          Paramètres
        </p>
        {sections.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            onClick={() => setSection(id)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all"
            style={{
              background: section === id ? "var(--accent-glow)" : "transparent",
              color: section === id ? "var(--accent-light)" : "var(--text-secondary)",
              borderLeft: section === id ? "2px solid var(--accent)" : "2px solid transparent",
            }}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-xl">
          {section === "general" && (
            <div className="animate-fade-in">
              <h2 className="text-xl font-bold mb-6" style={{ color: "var(--text-primary)" }}>Général</h2>
              <div className="space-y-4">
                <SettingRow label="Nom d'affichage" description="Affiché dans les salutations">
                  <input defaultValue="Morgan" className="input-dark w-40 text-sm" style={{ padding: "8px 12px" }} />
                </SettingRow>
                <SettingRow label="Langue de l'agent" description="Langue utilisée par défaut">
                  <select className="input-dark w-40 text-sm" style={{ padding: "8px 12px" }}>
                    <option value="fr">Français</option>
                    <option value="en">English</option>
                  </select>
                </SettingRow>
                <SettingRow label="Modèle IA" description="Llama 3.3 70B recommandé">
                  <select className="input-dark w-48 text-sm" style={{ padding: "8px 12px" }}>
                    <option>llama-3.3-70b-versatile</option>
                    <option>llama-3.1-8b-instant</option>
                    <option>mixtral-8x7b-32768</option>
                  </select>
                </SettingRow>
              </div>
            </div>
          )}

          {section === "api" && (
            <div className="animate-fade-in">
              <h2 className="text-xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>Clé API Groq</h2>
              <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>
                Groq est gratuit. Crée ton compte sur{" "}
                <a href="https://console.groq.com" target="_blank" className="underline" style={{ color: "var(--accent-light)" }}>
                  console.groq.com
                </a>{" "}
                puis génère une clé API.
              </p>
              <div className="space-y-4">
                <SettingRow label="GROQ_API_KEY" description="Commence par gsk_...">
                  <input
                    type="password"
                    placeholder="gsk_..."
                    className="input-dark text-sm"
                    style={{ padding: "8px 12px" }}
                  />
                </SettingRow>
                <div
                  className="p-4 rounded-xl"
                  style={{ background: "rgba(108,99,255,0.08)", border: "1px solid rgba(108,99,255,0.2)" }}
                >
                  <div className="flex items-start gap-3">
                    <Shield size={16} style={{ color: "var(--accent)", marginTop: 2 }} />
                    <div>
                      <p className="text-sm font-medium mb-1" style={{ color: "var(--text-primary)" }}>
                        Sécurité
                      </p>
                      <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                        La clé est stockée dans <code className="px-1 py-0.5 rounded" style={{ background: "var(--bg-card)", fontSize: "11px" }}>.env.local</code> et n'est jamais exposée côté client. Ne la partage pas publiquement.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {section === "email" && (
            <div className="animate-fade-in">
              <h2 className="text-xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>Boîtes mail</h2>
              <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>
                Connecte Gmail et Outlook via OAuth (gratuit).
              </p>
              <div className="space-y-3">
                <OAuthCard
                  name="Gmail"
                  icon="G"
                  color="#ea4335"
                  description="Nécessite un projet Google Cloud (gratuit)"
                  setupUrl="https://console.cloud.google.com"
                  steps={["Créer projet Google Cloud", "Activer Gmail API", "Créer credentials OAuth", "Ajouter dans .env.local"]}
                />
                <OAuthCard
                  name="Outlook"
                  icon="O"
                  color="#0078d4"
                  description="Nécessite une app Azure (gratuit)"
                  setupUrl="https://portal.azure.com"
                  steps={["Aller sur portal.azure.com", "App registrations → New", "Activer Mail.Read + Mail.Send", "Ajouter dans .env.local"]}
                />
              </div>
            </div>
          )}

          {section === "calendar" && (
            <div className="animate-fade-in">
              <h2 className="text-xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>Calendrier</h2>
              <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>
                Connecte Google Calendar et Outlook Calendar.
              </p>
              <div className="space-y-3">
                <OAuthCard
                  name="Google Calendar"
                  icon="G"
                  color="#4285f4"
                  description="Utilise les mêmes credentials que Gmail"
                  setupUrl="https://console.cloud.google.com"
                  steps={["Activer Calendar API sur Google Cloud", "Même OAuth que Gmail", "Ajouter GOOGLE_CLIENT_ID dans .env"]}
                />
                <OAuthCard
                  name="Outlook Calendar"
                  icon="O"
                  color="#0078d4"
                  description="Utilise les mêmes credentials qu'Outlook Mail"
                  setupUrl="https://portal.azure.com"
                  steps={["Activer Calendars.Read dans Azure", "Même app que Outlook Mail"]}
                />
              </div>
            </div>
          )}

          {section === "notifications" && (
            <div className="animate-fade-in">
              <h2 className="text-xl font-bold mb-6" style={{ color: "var(--text-primary)" }}>Notifications</h2>
              <div className="space-y-4">
                <ToggleRow label="Nouveaux emails" description="Notifier à l'arrivée d'un email" defaultOn />
                <ToggleRow label="Rappels calendrier" description="15 min avant les événements" defaultOn />
                <ToggleRow label="Mises à jour agent" description="Nouvelles fonctionnalités" defaultOn={false} />
              </div>
            </div>
          )}

          <div className="mt-8">
            <button onClick={save} className="btn-primary flex items-center gap-2">
              {saved ? <Check size={16} /> : null}
              {saved ? "Sauvegardé !" : "Sauvegarder"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SettingRow({ label, description, children }: {
  label: string; description?: string; children: React.ReactNode;
}) {
  return (
    <div
      className="flex items-center justify-between gap-4 p-4 rounded-xl"
      style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
    >
      <div>
        <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{label}</p>
        {description && <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{description}</p>}
      </div>
      {children}
    </div>
  );
}

function ToggleRow({ label, description, defaultOn }: { label: string; description?: string; defaultOn?: boolean }) {
  const [on, setOn] = useState(defaultOn ?? false);
  return (
    <div
      className="flex items-center justify-between gap-4 p-4 rounded-xl"
      style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
    >
      <div>
        <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{label}</p>
        {description && <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{description}</p>}
      </div>
      <button
        onClick={() => setOn(!on)}
        className="w-11 h-6 rounded-full transition-all relative flex-shrink-0"
        style={{ background: on ? "var(--accent)" : "var(--border-light)" }}
      >
        <div
          className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all"
          style={{ left: on ? "calc(100% - 22px)" : "2px" }}
        />
      </button>
    </div>
  );
}

function OAuthCard({ name, icon, color, description, setupUrl, steps }: {
  name: string; icon: string; color: string; description: string; setupUrl: string; steps: string[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
    >
      <div
        className="flex items-center gap-3 p-4 cursor-pointer"
        onClick={() => setOpen(!open)}
      >
        <div className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm text-white" style={{ background: color }}>
          {icon}
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{name}</p>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>{description}</p>
        </div>
        <ChevronRight size={16} className={`transition-transform ${open ? "rotate-90" : ""}`} style={{ color: "var(--text-muted)" }} />
      </div>
      {open && (
        <div className="px-4 pb-4 border-t" style={{ borderColor: "var(--border)" }}>
          <p className="text-xs font-semibold mt-3 mb-2" style={{ color: "var(--text-muted)" }}>
            ÉTAPES DE CONFIGURATION
          </p>
          <ol className="space-y-1.5 mb-3">
            {steps.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-xs" style={{ color: "var(--text-secondary)" }}>
                <span className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 text-xs" style={{ background: `${color}20`, color }}>
                  {i + 1}
                </span>
                {s}
              </li>
            ))}
          </ol>
          <a
            href={setupUrl}
            target="_blank"
            className="flex items-center gap-1.5 text-xs font-medium"
            style={{ color }}
          >
            <ExternalLink size={12} />
            Ouvrir {name.split(" ")[0]} Console
          </a>
        </div>
      )}
    </div>
  );
}

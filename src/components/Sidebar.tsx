"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  MessageSquare,
  Video,
  StickyNote,
  Calendar,
  Mail,
  Settings,
  Menu,
  X,
  Sparkles,
  ChevronRight,
} from "lucide-react";

const navItems = [
  { href: "/", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/chat", icon: MessageSquare, label: "Chat IA" },
  { href: "/visio", icon: Video, label: "Visio IA" },
  { href: "/notes", icon: StickyNote, label: "Notes" },
  { href: "/calendar", icon: Calendar, label: "Calendrier" },
  { href: "/mail", icon: Mail, label: "Mails" },
  { href: "/settings", icon: Settings, label: "Paramètres" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const NavContent = () => (
    <>
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b" style={{ borderColor: "var(--border)" }}>
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center animate-pulse-glow"
          style={{ background: "linear-gradient(135deg, var(--accent), #8b5cf6)" }}
        >
          <Sparkles size={18} color="white" />
        </div>
        <div>
          <div className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>
            Agent Pro
          </div>
          <div className="text-xs" style={{ color: "var(--text-muted)" }}>
            Morgan
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map(({ href, icon: Icon, label }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              onClick={() => setMobileOpen(false)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group"
              style={{
                background: active ? "var(--accent-glow)" : "transparent",
                color: active ? "var(--accent-light)" : "var(--text-secondary)",
                borderLeft: active ? "2px solid var(--accent)" : "2px solid transparent",
              }}
            >
              <Icon size={18} />
              <span className="text-sm font-medium">{label}</span>
              {active && (
                <ChevronRight size={14} className="ml-auto" style={{ color: "var(--accent)" }} />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Status */}
      <div
        className="mx-3 mb-4 p-3 rounded-xl"
        style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
      >
        <div className="flex items-center gap-2">
          <div
            className="w-2 h-2 rounded-full"
            style={{ background: "var(--success)", boxShadow: "0 0 6px var(--success)" }}
          />
          <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
            Agent en ligne · Llama 3.3
          </span>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className="hidden md:flex flex-col w-56 h-full fixed left-0 top-0 z-30"
        style={{ background: "var(--bg-secondary)", borderRight: "1px solid var(--border)" }}
      >
        <NavContent />
      </aside>

      {/* Mobile top bar */}
      <div
        className="md:hidden fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 h-14"
        style={{ background: "var(--bg-secondary)", borderBottom: "1px solid var(--border)" }}
      >
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, var(--accent), #8b5cf6)" }}
          >
            <Sparkles size={14} color="white" />
          </div>
          <span className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>
            Agent Pro
          </span>
        </div>
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="p-2 rounded-lg"
          style={{ color: "var(--text-secondary)" }}
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-50"
          style={{ background: "rgba(0,0,0,0.7)" }}
          onClick={() => setMobileOpen(false)}
        >
          <aside
            className="flex flex-col w-64 h-full"
            style={{ background: "var(--bg-secondary)", borderRight: "1px solid var(--border)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <NavContent />
          </aside>
        </div>
      )}
    </>
  );
}

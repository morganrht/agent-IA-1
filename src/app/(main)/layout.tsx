"use client";

import Sidebar from "@/components/Sidebar";
import FloatingCallBar from "@/components/FloatingCallBar";
import { VisioProvider } from "@/lib/VisioContext";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <VisioProvider>
      <div className="h-full flex">
        <Sidebar />
        <main
          className="flex-1 md:ml-56 mt-14 md:mt-0 overflow-hidden"
          style={{ background: "var(--bg-primary)" }}
        >
          {children}
        </main>
      </div>
      <FloatingCallBar />
    </VisioProvider>
  );
}

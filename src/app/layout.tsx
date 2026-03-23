import type { Metadata, Viewport } from "next";
import "./globals.css";
import { VisioProvider } from "@/lib/VisioContext";

export const metadata: Metadata = {
  title: "Agent Pro — Morgan",
  description: "Ton assistant personnel & professionnel",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0a0a0f",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className="h-full">
      <body className="h-full">
        <VisioProvider>
          {children}
        </VisioProvider>
      </body>
    </html>
  );
}

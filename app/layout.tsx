import type { Metadata } from "next";
import { QueryProvider } from "@/lib/providers/query-provider";
import NetworkSyncProvider from "@/app/providers/NetworkSyncProvider";
import "./globals.css";

// Definizione statica del font-family per evitare errori di download Google Fonts in ambienti offline/sandbox
const inter = {
  variable: "font-sans",
};


export const metadata: Metadata = {
  title: "WebCAD Antincendio",
  description:
    "Applicazione CAD cloud per ingegneria antincendio: modellazione strutturale parametrica, nesting materiali e generazione BoM in tempo reale.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="it" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">
        <NetworkSyncProvider>
          <QueryProvider>{children}</QueryProvider>
        </NetworkSyncProvider>
      </body>
    </html>
  );
}


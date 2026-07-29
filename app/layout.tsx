import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { QueryProvider } from "@/lib/providers/query-provider";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Finanza Privata",
  description: "Gestionale privato per tracciamento spese e pianificazione pagamenti.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="it" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans" style={{ background: "hsl(222 47% 6%)" }}>
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}

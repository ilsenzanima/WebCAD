import type { Metadata } from "next";
import { Inter, Manrope, Plus_Jakarta_Sans, Geist, Sora, Lexend, Atkinson_Hyperlegible } from "next/font/google";
import localFont from "next/font/local";
import { cookies } from "next/headers";
import { QueryProvider } from "@/lib/providers/query-provider";
import { DEFAULT_FONT_ID, isValidFontId } from "@/lib/fonts";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--font-inter",
});

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-manrope",
});

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-jakarta",
});

const geist = Geist({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--font-geist",
});

const sora = Sora({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-sora",
});

const lexend = Lexend({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-lexend",
});

const atkinson = Atkinson_Hyperlegible({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-atkinson",
});

// OpenDyslexic: font open source (SIL OFL 1.1) pensato per la dislessia,
// con le lettere piu' pesanti alla base per aiutare a non confonderle
// (es. b/d/p/q). Non e' su Google Fonts: auto-ospitato da app/fonts/.
const openDyslexic = localFont({
  src: [
    { path: "./fonts/opendyslexic/OpenDyslexic-Regular.woff2", weight: "400", style: "normal" },
    { path: "./fonts/opendyslexic/OpenDyslexic-Italic.woff2", weight: "400", style: "italic" },
    { path: "./fonts/opendyslexic/OpenDyslexic-Bold.woff2", weight: "700", style: "normal" },
    { path: "./fonts/opendyslexic/OpenDyslexic-Bold-Italic.woff2", weight: "700", style: "italic" },
  ],
  variable: "--font-opendyslexic",
});

export const metadata: Metadata = {
  title: "Finanza Privata",
  description: "Gestionale privato per tracciamento spese e pianificazione pagamenti.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const fontCookie = cookieStore.get("font-preference")?.value;
  const activeFont = isValidFontId(fontCookie) ? fontCookie : DEFAULT_FONT_ID;

  const fontVariables = [
    inter.variable,
    manrope.variable,
    jakarta.variable,
    geist.variable,
    sora.variable,
    lexend.variable,
    atkinson.variable,
    openDyslexic.variable,
  ].join(" ");

  return (
    <html lang="it" data-font={activeFont} className={`${fontVariables} h-full antialiased`}>
      <body className="min-h-full flex flex-col" style={{ background: "hsl(222 47% 6%)" }}>
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}

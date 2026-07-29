import type { Metadata } from "next";
import { Inter, Manrope, Plus_Jakarta_Sans, Geist, Sora } from "next/font/google";
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

  return (
    <html
      lang="it"
      data-font={activeFont}
      className={`${inter.variable} ${manrope.variable} ${jakarta.variable} ${geist.variable} ${sora.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col" style={{ background: "hsl(222 47% 6%)" }}>
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}

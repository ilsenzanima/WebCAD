/**
 * Elenco dei font selezionabili per l'interfaccia (Impostazioni > Aspetto).
 * Aggiungere un nuovo font: importarlo in app/layout.tsx, aggiungere la sua
 * variabile CSS qui sotto e la relativa regola in app/globals.css.
 */
export interface FontOption {
  id: string;
  label: string;
  cssVar: string; // variabile CSS generata da next/font (es. --font-inter)
  description: string;
}

export const FONT_OPTIONS: FontOption[] = [
  { id: "inter", label: "Inter", cssVar: "--font-inter", description: "Il font attuale: pulito e molto diffuso nelle interfacce moderne." },
  { id: "opendyslexic", label: "OpenDyslexic", cssVar: "--font-opendyslexic", description: "Pensato apposta per la dislessia: base delle lettere piu' pesante per non confondere forme simili (b/d/p/q) e ancorare la riga." },
  { id: "atkinson", label: "Atkinson Hyperlegible", cssVar: "--font-atkinson", description: "Disegnato dalla Braille Institute per la massima leggibilita' e distinzione tra caratteri simili." },
  { id: "lexend", label: "Lexend", cssVar: "--font-lexend", description: "Basato su ricerche di lettura per ridurre lo sforzo visivo e migliorare la velocita' di lettura." },
  { id: "manrope", label: "Manrope", cssVar: "--font-manrope", description: "Geometrico ma morbido, molto usato in dashboard e app finanziarie." },
  { id: "jakarta", label: "Plus Jakarta Sans", cssVar: "--font-jakarta", description: "Simile a Manrope ma con un tocco piu' arrotondato e friendly." },
  { id: "geist", label: "Geist", cssVar: "--font-geist", description: "Il font di Vercel: minimale, ottima leggibilita' su schermo." },
  { id: "sora", label: "Sora (alternativa a General Sans)", cssVar: "--font-sora", description: "Umanista e caldo — il piu' vicino, tra i font liberi, allo stile dell'interfaccia di Claude Desktop." },
];

export const DEFAULT_FONT_ID = "inter";

export function isValidFontId(id: string | undefined): id is string {
  return !!id && FONT_OPTIONS.some(f => f.id === id);
}

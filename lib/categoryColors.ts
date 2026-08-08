/**
 * Tavolozza colori condivisa per i badge di categoria/conto, usata da tutte le pagine
 * che mostrano un'etichetta colorata (Budget, Scadenze, Calendario, Spese & Entrate,
 * Conti, Panoramica) e dal selettore colore in Impostazioni. Centralizzata qui per
 * evitare che una tinta aggiunta/corretta in un punto venga dimenticata altrove.
 *
 * Il colore di una categoria e' salvato come stringa libera (nessun vincolo a DB):
 * - una singola tinta ("indigo") da' un badge monocromo, come sempre;
 * - "sfondo:testo" (es. "amber:indigo") combina due tinte diverse per sfondo e testo,
 *   per avere molte piu' combinazioni distinguibili senza dover inventare nuove tinte.
 * Le categorie create prima di questa funzionalita' hanno sempre il formato a singola
 * tinta, quindi il loro aspetto resta invariato.
 */

export interface CategoryColorTone {
  value: string;
  label: string;
  bg: string;
  border: string;
  text: string;
  gradient: string;
}

export const CATEGORY_COLOR_TONES: CategoryColorTone[] = [
  { value: "indigo", label: "Indaco", bg: "rgba(99,102,241,0.12)", border: "rgba(99,102,241,0.2)", text: "hsl(245 85% 75%)", gradient: "linear-gradient(90deg, hsl(220 90% 56%), hsl(215 85% 48%))" },
  { value: "rose", label: "Rosso", bg: "rgba(239,68,68,0.12)", border: "rgba(239,68,68,0.2)", text: "hsl(0 80% 75%)", gradient: "linear-gradient(90deg, hsl(350 85% 55%), hsl(340 75% 45%))" },
  { value: "emerald", label: "Smeraldo", bg: "rgba(16,185,129,0.12)", border: "rgba(16,185,129,0.2)", text: "hsl(150 70% 70%)", gradient: "linear-gradient(90deg, hsl(142 70% 45%), hsl(150 60% 40%))" },
  { value: "amber", label: "Ambra", bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.2)", text: "hsl(38 90% 70%)", gradient: "linear-gradient(90deg, hsl(38 90% 50%), hsl(30 80% 45%))" },
  { value: "sky", label: "Cielo", bg: "rgba(14,165,233,0.12)", border: "rgba(14,165,233,0.2)", text: "hsl(200 85% 70%)", gradient: "linear-gradient(90deg, hsl(200 85% 50%), hsl(190 75% 45%))" },
  { value: "pink", label: "Fucsia", bg: "rgba(236,72,153,0.12)", border: "rgba(236,72,153,0.2)", text: "hsl(330 80% 75%)", gradient: "linear-gradient(90deg, hsl(330 85% 55%), hsl(320 75% 45%))" },
  { value: "purple", label: "Viola", bg: "rgba(168,85,247,0.12)", border: "rgba(168,85,247,0.2)", text: "hsl(270 80% 75%)", gradient: "linear-gradient(90deg, hsl(270 80% 55%), hsl(250 75% 50%))" },
  { value: "slate", label: "Grigio", bg: "rgba(107,114,128,0.15)", border: "rgba(107,114,128,0.25)", text: "hsl(215 15% 75%)", gradient: "linear-gradient(90deg, hsl(215 15% 50%), hsl(215 10% 40%))" },
  { value: "orange", label: "Arancione", bg: "rgba(249,115,22,0.12)", border: "rgba(249,115,22,0.2)", text: "hsl(24 94% 70%)", gradient: "linear-gradient(90deg, hsl(25 95% 55%), hsl(20 85% 48%))" },
  { value: "lime", label: "Lime", bg: "rgba(132,204,22,0.12)", border: "rgba(132,204,22,0.2)", text: "hsl(83 70% 65%)", gradient: "linear-gradient(90deg, hsl(83 78% 45%), hsl(90 65% 40%))" },
  { value: "teal", label: "Turchese", bg: "rgba(20,184,166,0.12)", border: "rgba(20,184,166,0.2)", text: "hsl(173 65% 62%)", gradient: "linear-gradient(90deg, hsl(173 80% 40%), hsl(178 70% 35%))" },
];

const TONE_MAP: Record<string, CategoryColorTone> = Object.fromEntries(
  CATEGORY_COLOR_TONES.map((tone) => [tone.value, tone])
);

export interface CategoryBadgeStyle {
  bg: string;
  text: string;
  border: string;
}

export function getCategoryBadgeStyle(color: string | null | undefined): CategoryBadgeStyle {
  const [bgKey, textKey] = (color || "slate").split(":");
  const bgTone = TONE_MAP[bgKey] || TONE_MAP.slate;
  const textTone = textKey ? (TONE_MAP[textKey] || bgTone) : bgTone;
  return { bg: bgTone.bg, border: bgTone.border, text: textTone.text };
}

export function getCategoryGradient(color: string | null | undefined): string {
  const [bgKey] = (color || "slate").split(":");
  return (TONE_MAP[bgKey] || TONE_MAP.slate).gradient;
}

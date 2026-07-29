/**
 * Utility di formattazione condivise (valuta, date, dimensione file).
 * Centralizzate per evitare che una correzione futura ne dimentichi una copia.
 */

export function formatCurrency(val: number): string {
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(val);
}

/** Data breve "gg/mm/aaaa" nel formato italiano. */
export function formatDate(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/**
 * Converte una Date nella stringa "aaaa-mm-gg" usando i suoi componenti
 * *locali* (anno/mese/giorno del fuso orario del browser), a differenza di
 * `date.toISOString().split("T")[0]` che converte prima in UTC: con un fuso
 * orario avanti rispetto a UTC (es. Italia) quest'ultima puo' restituire il
 * giorno sbagliato (es. la mezzanotte locale del 16 diventa le 22:00 UTC del
 * 15), causando calendari/date di default disallineati di un giorno.
 */
export function toLocalDateStr(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function formatFileSize(bytes?: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

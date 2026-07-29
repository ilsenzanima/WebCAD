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

export function formatFileSize(bytes?: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

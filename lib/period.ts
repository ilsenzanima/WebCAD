/**
 * Helper per i campi "Periodo di copertura" (bollette): due <input type="month">
 * (valore "YYYY-MM") convertiti in DATE (primo del mese) per il salvataggio su
 * expenses.period_start/period_end. Un singolo mese ha period_start = period_end.
 */

export function monthInputToDate(value: string): string | null {
  return value ? `${value}-01` : null;
}

export function dateToMonthInput(value: string | null | undefined): string {
  return value ? value.slice(0, 7) : "";
}

/**
 * Quando l'utente cambia il mese di inizio, allinea automaticamente il mese di fine
 * se non era stato personalizzato rispetto all'inizio precedente (cosi' il caso
 * comune "un solo mese" resta un solo campo da compilare, ma resta possibile
 * impostare un periodo di piu' mesi modificando "al" separatamente).
 */
export function syncPeriodEnd(newStart: string, prevStart: string, currentEnd: string): string {
  if (!currentEnd || currentEnd === prevStart) return newStart;
  return currentEnd;
}

export type RecurrenceType = "one-time" | "weekly" | "monthly" | "bimonthly" | "quarterly" | "semiannual" | "yearly";

/**
 * Calcola la prossima data di scadenza per una scadenza ricorrente.
 * Usata sia lato server (paySchedule) sia lato client (aggiornamento ottimistico)
 * per evitare che la logica di ricorrenza diverga tra le due copie.
 */
export function getNextDueDate(dueDate: string, recurrence: RecurrenceType): string {
  const next = new Date(dueDate);
  if (recurrence === "weekly") {
    next.setDate(next.getDate() + 7);
  } else if (recurrence === "monthly") {
    next.setMonth(next.getMonth() + 1);
  } else if (recurrence === "bimonthly") {
    next.setMonth(next.getMonth() + 2);
  } else if (recurrence === "quarterly") {
    next.setMonth(next.getMonth() + 3);
  } else if (recurrence === "semiannual") {
    next.setMonth(next.getMonth() + 6);
  } else if (recurrence === "yearly") {
    next.setFullYear(next.getFullYear() + 1);
  }
  return next.toISOString().split("T")[0];
}

/**
 * Una scadenza ricorrente con una data di fine nota (es. l'ultima rata di un
 * finanziamento) smette di generare occorrenze successive oltre quella data.
 */
export function isRecurrenceEnded(
  dueDate: string,
  endMonth: number | null | undefined,
  endYear: number | null | undefined
): boolean {
  if (!endMonth || !endYear) return false;
  const d = new Date(dueDate);
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  return year > endYear || (year === endYear && month > endMonth);
}

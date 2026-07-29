export type RecurrenceType = "one-time" | "weekly" | "monthly" | "yearly";

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
  } else if (recurrence === "yearly") {
    next.setFullYear(next.getFullYear() + 1);
  }
  return next.toISOString().split("T")[0];
}

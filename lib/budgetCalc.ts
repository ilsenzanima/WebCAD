/**
 * Calcoli condivisi sulle voci di budget (previsioni), usati sia dalla
 * pagina Budget che dalla Panoramica, per non duplicare la logica di
 * mensilizzazione/override/scadenza in piu' componenti.
 */
import type { Budget, BudgetOverride } from "@/lib/types/database";

/** Periodicita' disponibili per una voce di budget, condivisa tra la pagina Budget e i punti
 * (Scadenze, Spese & Entrate) da cui ora si crea una nuova voce di budget collegata. */
export const BUDGET_PERIODS = [
  { value: "weekly", label: "Settimanale" },
  { value: "monthly", label: "Mensile" },
  { value: "bimonthly", label: "Bimestrale" },
  { value: "quarterly", label: "Trimestrale" },
  { value: "semiannual", label: "Semestrale" },
  { value: "annual", label: "Annuale" },
] as const;

/** Converte l'importo di una voce (in base alla sua periodicita') nell'equivalente mensile. */
export function getMonthlyEquivalent(amount: number, periodicity: string): number {
  switch (periodicity) {
    case "weekly": return amount * 4.33;
    case "bimonthly": return amount / 2;
    case "quarterly": return amount / 3;
    case "semiannual": return amount / 6;
    case "annual": return amount / 12;
    case "monthly":
    default:
      return amount;
  }
}

/** Trova l'eventuale override per una voce di budget in un mese/anno specifico. */
export function findBudgetOverride(
  overrides: BudgetOverride[],
  budgetId: string,
  year: number,
  month: number
): BudgetOverride | undefined {
  return overrides.find(o => o.budget_id === budgetId && o.year === year && o.month === month);
}

/** Una voce con scadenza (es. mutuo/finanziamento) e' conclusa se il mese richiesto e' oltre end_year/end_month. */
export function isBudgetEnded(budget: Pick<Budget, "end_year" | "end_month">, year: number, month: number): boolean {
  if (!budget.end_year || !budget.end_month) return false;
  return year > budget.end_year || (year === budget.end_year && month > budget.end_month);
}

/**
 * Importo effettivo previsto per una voce in un mese specifico: usa l'override
 * se presente, altrimenti la stima di base (0 se la voce ha gia' una scadenza
 * superata quel mese).
 */
export function getEffectiveAmount(
  budget: Pick<Budget, "id" | "amount" | "periodicity" | "end_year" | "end_month">,
  overrides: BudgetOverride[],
  year: number,
  month: number
): number {
  const ov = findBudgetOverride(overrides, budget.id, year, month);
  if (ov) return Number(ov.amount);
  if (isBudgetEnded(budget, year, month)) return 0;
  return getMonthlyEquivalent(Number(budget.amount), budget.periodicity);
}

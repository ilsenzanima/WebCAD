/**
 * Abbinamento dei movimenti di un estratto conto importato alle spese/entrate
 * gia' registrate. Funzione pura (nessun accesso al DB), cosi' da poter essere
 * richiamata sia dall'azione di import (per confermare in automatico i match
 * sicuri) sia da chi mostra la schermata di revisione (per gli stessi identici
 * risultati senza doverli ricalcolare in due modi diversi).
 *
 * Il confronto usa sempre la data valuta del movimento (non la data di
 * contabilizzazione), perche' e' quella piu' vicina al momento reale della
 * spesa: i pagamenti POS in particolare vengono spesso contabilizzati con
 * qualche giorno di ritardo.
 */

import { type BankStatementLine, type Expense, type Supplier, type SupplierAccountCode } from "@/lib/types/database";

export type ReconciliationStatus = "confirmed" | "review" | "missing" | "new_code" | "autobook" | "ignored";

export interface ReconciledLine {
  line: BankStatementLine;
  status: ReconciliationStatus;
  supplierId: string | null; // fornitore risolto dal codice rilevato, se noto
  candidateExpense: Expense | null; // spesa proposta per il confronto/conferma (non ancora salvata come match, salvo status "confirmed")
  suggestedSupplier: Supplier | null; // per i codici nuovi: fornitore con un nome simile a quello nella descrizione
  amountDiff: number | null;
  dateDiffDays: number | null;
}

// Entro questa differenza di importo e di giorni, il match e' considerato sicuro
// e viene confermato in automatico senza bisogno di un click.
const AUTO_CONFIRM_AMOUNT_TOLERANCE = 0.05;
const AUTO_CONFIRM_DATE_WINDOW_DAYS = 5;

// Finestra entro cui cercare comunque un candidato da proporre come "da verificare".
const CANDIDATE_DATE_WINDOW_DAYS = 10;

// Tolleranza "larga" oltre la quale un candidato non viene nemmeno proposto: il
// maggiore tra un importo fisso (per le spese piccole) e una percentuale (per quelle grandi).
function candidateAmountTolerance(amount: number): number {
  return Math.max(3, Math.abs(amount) * 0.15);
}

function daysBetween(a: string, b: string): number {
  const diff = Math.abs(new Date(`${a}T00:00:00`).getTime() - new Date(`${b}T00:00:00`).getTime());
  return Math.round(diff / (1000 * 60 * 60 * 24));
}

const FEE_TYPE_KEYWORDS = ["commissio", "competenz", "bollo", "canone", "imposta"];

// Commissioni/bolli bancari non hanno un fornitore da cercare: l'utente non li
// registra mai in anticipo, quindi per questi si propone di registrarli con un
// click invece di cercare (invano) una spesa corrispondente.
function looksLikeBankFee(line: Pick<BankStatementLine, "type" | "description">): boolean {
  const haystack = `${line.type || ""} ${line.description}`.toLowerCase();
  return FEE_TYPE_KEYWORDS.some((k) => haystack.includes(k));
}

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function namesOverlap(a: string, b: string): boolean {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return false;
  return na.includes(nb) || nb.includes(na);
}

function emptyResult(line: BankStatementLine, status: ReconciliationStatus, supplierId: string | null = null): ReconciledLine {
  return { line, status, supplierId, candidateExpense: null, suggestedSupplier: null, amountDiff: null, dateDiffDays: null };
}

export function reconcileStatementLines(
  lines: BankStatementLine[],
  expenses: Expense[],
  supplierAccountCodes: SupplierAccountCode[],
  suppliers: Supplier[]
): ReconciledLine[] {
  const codeToSupplier = new Map(supplierAccountCodes.map((c) => [c.code, c.supplier_id] as const));

  // Le spese gia' collegate a un movimento (di questo import o di importazioni precedenti)
  // non vanno riproposte come candidate per un secondo movimento.
  const usedExpenseIds = new Set(lines.map((l) => l.matched_expense_id).filter((id): id is string => !!id));

  const results: ReconciledLine[] = [];

  for (const line of lines) {
    if (line.is_ignored) {
      results.push(emptyResult(line, "ignored"));
      continue;
    }

    if (line.matched_expense_id) {
      const matched = expenses.find((e) => e.id === line.matched_expense_id) || null;
      results.push({
        line,
        status: "confirmed",
        supplierId: matched?.supplier_id ?? null,
        candidateExpense: matched,
        suggestedSupplier: null,
        amountDiff: matched ? Math.abs(Math.abs(Number(matched.amount)) - Math.abs(Number(line.amount))) : null,
        dateDiffDays: matched ? daysBetween(matched.date, line.value_date) : null,
      });
      continue;
    }

    // Le commissioni/bolli bancari non hanno mai una spesa pre-registrata da
    // trovare: si controllano subito, prima di cercare un candidato, per non
    // rischiare di abbinarli per sbaglio alla spesa piu' vicina per data.
    if (!line.detected_code && looksLikeBankFee(line)) {
      results.push(emptyResult(line, "autobook"));
      continue;
    }

    const lineAmount = Number(line.amount);
    const isIncome = lineAmount > 0;
    // Un codice puo' essere: mai visto (va chiesto), noto e collegato a un fornitore,
    // o noto ma volutamente senza fornitore (l'utente ha gia' detto "non e' un
    // fornitore, non chiedermelo piu'") - in quest'ultimo caso si cerca comunque
    // un abbinamento, solo senza filtrare per fornitore.
    const codeIsKnown = line.detected_code ? codeToSupplier.has(line.detected_code) : false;
    const supplierId = line.detected_code ? codeToSupplier.get(line.detected_code) ?? null : null;

    const pool = expenses.filter(
      (e) =>
        e.account_id === line.account_id &&
        e.is_income === isIncome &&
        !usedExpenseIds.has(e.id) &&
        (supplierId ? e.supplier_id === supplierId : true) &&
        daysBetween(e.date, line.value_date) <= CANDIDATE_DATE_WINDOW_DAYS
    );

    let best: Expense | null = null;
    let bestAmountDiff = Infinity;
    let bestDateDiff = Infinity;
    for (const e of pool) {
      const amountDiff = Math.abs(Math.abs(Number(e.amount)) - Math.abs(lineAmount));
      const dateDiff = daysBetween(e.date, line.value_date);
      if (amountDiff < bestAmountDiff || (amountDiff === bestAmountDiff && dateDiff < bestDateDiff)) {
        best = e;
        bestAmountDiff = amountDiff;
        bestDateDiff = dateDiff;
      }
    }

    // Codice mai visto: va collegato a un fornitore prima di poter cercare un match
    // affidabile. Se il nome nella descrizione somiglia a un fornitore gia' censito,
    // lo si suggerisce direttamente invece di lasciare che l'utente lo cerchi a mano.
    if (line.detected_code && !codeIsKnown) {
      const suggestedSupplier = suppliers.find((s) => namesOverlap(s.name, line.description)) || null;
      const plausible = best && bestAmountDiff <= candidateAmountTolerance(lineAmount);
      results.push({
        line,
        status: "new_code",
        supplierId: null,
        candidateExpense: plausible ? best : null,
        suggestedSupplier,
        amountDiff: plausible ? bestAmountDiff : null,
        dateDiffDays: plausible ? bestDateDiff : null,
      });
      continue;
    }

    if (!best) {
      results.push(emptyResult(line, "missing", supplierId));
      continue;
    }

    if (bestAmountDiff <= AUTO_CONFIRM_AMOUNT_TOLERANCE && bestDateDiff <= AUTO_CONFIRM_DATE_WINDOW_DAYS) {
      usedExpenseIds.add(best.id);
      results.push({
        line,
        status: "confirmed",
        supplierId,
        candidateExpense: best,
        suggestedSupplier: null,
        amountDiff: bestAmountDiff,
        dateDiffDays: bestDateDiff,
      });
      continue;
    }

    if (bestAmountDiff <= candidateAmountTolerance(lineAmount)) {
      results.push({
        line,
        status: "review",
        supplierId,
        candidateExpense: best,
        suggestedSupplier: null,
        amountDiff: bestAmountDiff,
        dateDiffDays: bestDateDiff,
      });
      continue;
    }

    results.push(emptyResult(line, "missing", supplierId));
  }

  return results;
}

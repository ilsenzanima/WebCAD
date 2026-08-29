"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { parseBankStatementCsv } from "@/lib/bankStatementParser";
import { reconcileStatementLines, type ReconciledLine } from "@/lib/bankReconciliation";

// Ampia abbastanza da coprire il ritardo di contabilizzazione dei pagamenti POS
// e degli addebiti SDD, senza tirare dentro spese di mesi non pertinenti.
const RECONCILIATION_MARGIN_DAYS = 15;

function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function revalidateReconciliationPaths() {
  revalidatePath("/dashboard/accounts");
  revalidatePath("/dashboard/reconciliation");
}

// I match "confermati" dal calcolo puro sono sicuri per definizione (tolleranza
// stretta su importo e data): li si scrive subito sul movimento, sia al primo
// import sia ogni volta che la riconciliazione viene ricalcolata (es. dopo aver
// collegato un codice a un fornitore, cosa che puo' sbloccare altri movimenti
// con lo stesso codice), cosi' che il collegamento sia sempre reale e non solo
// mostrato a schermo.
// Best-effort: quando un movimento con un codice mai visto viene confermato su
// una spesa, quella scelta (con o senza fornitore) vale anche per i prossimi
// movimenti con lo stesso codice (es. la commissione collegata allo stesso
// bonifico). Un conflitto (codice gia' noto) e' normale e viene ignorato senza
// far fallire l'azione principale, che a quel punto e' gia' andata a buon fine.
async function rememberDetectedCode(supabase: any, userId: string, code: string | null | undefined, supplierId: string | null) {
  if (!code) return;
  try {
    await supabase.from("supplier_account_codes").insert({ user_id: userId, supplier_id: supplierId, code });
  } catch {
    // ignorato: non e' un'operazione critica
  }
}

async function persistAutoConfirmedMatches(supabase: any, userId: string, reconciled: ReconciledLine[]) {
  const toConfirm = reconciled.filter((r) => r.status === "confirmed" && r.candidateExpense && !r.line.matched_expense_id);
  for (const r of toConfirm) {
    const { error } = await supabase
      .from("bank_statement_lines")
      .update({ matched_expense_id: r.candidateExpense!.id })
      .eq("id", r.line.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
  }
}

export async function importBankStatement(formData: { account_id: string; file_name: string; csv_text: string }) {
  try {
    const supabase = (await createClient()) as any;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Non autenticato");

    const { data: account, error: accountError } = await supabase
      .from("accounts")
      .select("id")
      .eq("id", formData.account_id)
      .eq("user_id", user.id)
      .single();
    if (accountError || !account) throw new Error("Conto non trovato");

    const { rows, errors } = parseBankStatementCsv(formData.csv_text);
    if (rows.length === 0) {
      throw new Error(errors[0] || "Nessun movimento leggibile nel file.");
    }

    const periodStart = rows.reduce((min, r) => (r.valueDate < min ? r.valueDate : min), rows[0].valueDate);
    const periodEnd = rows.reduce((max, r) => (r.valueDate > max ? r.valueDate : max), rows[0].valueDate);

    const { data: importRow, error: importError } = await supabase
      .from("bank_statement_imports")
      .insert({
        user_id: user.id,
        account_id: formData.account_id,
        file_name: formData.file_name || null,
        period_start: periodStart,
        period_end: periodEnd,
        row_count: rows.length,
      })
      .select()
      .single();
    if (importError) throw new Error(importError.message);

    const { data: insertedLines, error: linesError } = await supabase
      .from("bank_statement_lines")
      .insert(
        rows.map((r) => ({
          user_id: user.id,
          import_id: importRow.id,
          account_id: formData.account_id,
          transaction_date: r.transactionDate,
          value_date: r.valueDate,
          amount: r.amount,
          type: r.type,
          description: r.description,
          detected_code: r.detectedCode,
        }))
      )
      .select();
    if (linesError) throw new Error(linesError.message);

    // Recupera cio' che serve per il primo passaggio di abbinamento automatico
    // (le spese sul conto in una finestra piu' ampia del periodo importato, per
    // via del possibile ritardo di contabilizzazione).
    const [{ data: expenses, error: expensesError }, { data: supplierCodes, error: codesError }, { data: suppliers, error: suppliersError }] = await Promise.all([
      supabase
        .from("expenses")
        .select("*")
        .eq("user_id", user.id)
        .eq("account_id", formData.account_id)
        .gte("date", addDays(periodStart, -RECONCILIATION_MARGIN_DAYS))
        .lte("date", addDays(periodEnd, RECONCILIATION_MARGIN_DAYS)),
      supabase.from("supplier_account_codes").select("*").eq("user_id", user.id),
      supabase.from("suppliers").select("*").eq("user_id", user.id),
    ]);
    if (expensesError) throw new Error(expensesError.message);
    if (codesError) throw new Error(codesError.message);
    if (suppliersError) throw new Error(suppliersError.message);

    const reconciled = reconcileStatementLines(insertedLines || [], expenses || [], supplierCodes || [], suppliers || []);
    await persistAutoConfirmedMatches(supabase, user.id, reconciled);

    const summary = reconciled.reduce(
      (acc, r) => {
        acc[r.status] = (acc[r.status] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    revalidateReconciliationPaths();
    return { success: true, data: { importId: importRow.id, rowCount: rows.length, parseErrors: errors, summary } };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function getBankStatementImports(accountId?: string) {
  try {
    const supabase = (await createClient()) as any;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Non autenticato");

    let query = supabase.from("bank_statement_imports").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    if (accountId) query = query.eq("account_id", accountId);

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data || [];
  } catch (err: any) {
    console.error("Errore getBankStatementImports:", err.message);
    return [];
  }
}

// Ricostruisce lo stesso identico esito mostrato durante l'import (nessuno stato
// intermedio salvato a parte i match gia' confermati), cosi' che riaprire la
// pagina di revisione dia sempre risultati coerenti con l'ultimo import.
export async function getReconciliationForImport(importId: string) {
  try {
    const supabase = (await createClient()) as any;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Non autenticato");

    const { data: importRow, error: importError } = await supabase
      .from("bank_statement_imports")
      .select("*")
      .eq("id", importId)
      .eq("user_id", user.id)
      .single();
    if (importError || !importRow) throw new Error("Import non trovato");

    const [{ data: lines, error: linesError }, { data: expenses, error: expensesError }, { data: supplierCodes, error: codesError }, { data: suppliers, error: suppliersError }] = await Promise.all([
      supabase.from("bank_statement_lines").select("*").eq("import_id", importId).eq("user_id", user.id).order("value_date", { ascending: true }),
      supabase
        .from("expenses")
        .select("*")
        .eq("user_id", user.id)
        .eq("account_id", importRow.account_id)
        .gte("date", addDays(importRow.period_start, -RECONCILIATION_MARGIN_DAYS))
        .lte("date", addDays(importRow.period_end, RECONCILIATION_MARGIN_DAYS)),
      supabase.from("supplier_account_codes").select("*").eq("user_id", user.id),
      supabase.from("suppliers").select("*").eq("user_id", user.id),
    ]);
    if (linesError) throw new Error(linesError.message);
    if (expensesError) throw new Error(expensesError.message);
    if (codesError) throw new Error(codesError.message);
    if (suppliersError) throw new Error(suppliersError.message);

    // Raggruppamenti "molte spese = un movimento": le spese coinvolte non sono
    // necessariamente nella finestra dei giorni intorno al periodo (es. una
    // scadenza segnata con largo anticipo), quindi si recuperano a parte.
    const lineIds = (lines || []).map((l: any) => l.id);
    let lineGroups: any[] = [];
    if (lineIds.length > 0) {
      const { data, error } = await supabase.from("bank_statement_line_expenses").select("*").eq("user_id", user.id).in("line_id", lineIds);
      if (error) throw new Error(error.message);
      lineGroups = data || [];
    }
    const groupExpenseIds = Array.from(new Set(lineGroups.map((g: any) => g.expense_id)));
    let groupExpenseRows: any[] = [];
    if (groupExpenseIds.length > 0) {
      const { data, error } = await supabase.from("expenses").select("*").eq("user_id", user.id).in("id", groupExpenseIds);
      if (error) throw new Error(error.message);
      groupExpenseRows = data || [];
    }
    const expensesById = new Map<string, any>();
    (expenses || []).forEach((e: any) => expensesById.set(e.id, e));
    groupExpenseRows.forEach((e: any) => expensesById.set(e.id, e));
    const groupedExpensesByLine: Record<string, any[]> = {};
    lineGroups.forEach((g: any) => {
      const expense = expensesById.get(g.expense_id);
      if (expense) (groupedExpensesByLine[g.line_id] ||= []).push(expense);
    });

    const reconciled = reconcileStatementLines(lines || [], expenses || [], supplierCodes || [], suppliers || [], groupedExpensesByLine);
    await persistAutoConfirmedMatches(supabase, user.id, reconciled);

    // Il set usa "reconciled" (non le righe grezze) cosi' da includere anche i match
    // appena confermati dalla riga sopra, senza dover rileggere le righe dal DB.
    const matchedExpenseIds = new Set(
      reconciled.flatMap((r) => {
        if (r.status === "confirmed" && r.candidateExpense) return [r.candidateExpense.id];
        if (r.status === "grouped" && r.groupExpenses) return r.groupExpenses.map((e) => e.id);
        return [];
      })
    );
    const unmatchedExpenses = (expenses || []).filter(
      (e: any) => e.date >= importRow.period_start && e.date <= importRow.period_end && !matchedExpenseIds.has(e.id)
    );

    return { success: true, data: { import: importRow, reconciled, unmatchedExpenses, suppliers: suppliers || [] } };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// "supplierId" e' opzionale: quando la spesa candidata non aveva ancora un
// fornitore assegnato (es. registrata prima di creare il fornitore, o
// semplicemente dimenticato), permette di assegnarlo nello stesso momento in
// cui si conferma il collegamento, invece di dover poi modificarla a mano in Spese.
export async function confirmLineMatch(lineId: string, expenseId: string, supplierId?: string | null) {
  try {
    const supabase = (await createClient()) as any;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Non autenticato");

    const { data: line, error: lineError } = await supabase
      .from("bank_statement_lines")
      .select("detected_code")
      .eq("id", lineId)
      .eq("user_id", user.id)
      .single();
    if (lineError || !line) throw new Error("Movimento non trovato");

    if (supplierId) {
      const { error: supplierUpdateError } = await supabase
        .from("expenses")
        .update({ supplier_id: supplierId })
        .eq("id", expenseId)
        .eq("user_id", user.id);
      if (supplierUpdateError) throw new Error(supplierUpdateError.message);
    }

    const { error } = await supabase
      .from("bank_statement_lines")
      .update({ matched_expense_id: expenseId, is_ignored: false })
      .eq("id", lineId)
      .eq("user_id", user.id);
    if (error) {
      if (error.code === "23505") throw new Error("Questa spesa è già collegata a un altro movimento.");
      throw new Error(error.message);
    }

    const { data: expense } = await supabase.from("expenses").select("supplier_id").eq("id", expenseId).eq("user_id", user.id).single();
    await rememberDetectedCode(supabase, user.id, line.detected_code, expense?.supplier_id ?? null);

    revalidatePath("/dashboard/expenses");
    revalidateReconciliationPaths();
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// Corregge l'importo di una spesa gia' registrata per farlo combaciare col
// movimento in banca (tipico caso: un errore di battitura al momento della
// registrazione) e la collega, invece di lasciarla sbagliata o duplicarla.
export async function correctExpenseAmountAndConfirm(lineId: string, expenseId: string) {
  try {
    const supabase = (await createClient()) as any;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Non autenticato");

    const { data: line, error: lineError } = await supabase
      .from("bank_statement_lines")
      .select("amount, detected_code")
      .eq("id", lineId)
      .eq("user_id", user.id)
      .single();
    if (lineError || !line) throw new Error("Movimento non trovato");

    const { data: updatedExpense, error: expenseError } = await supabase
      .from("expenses")
      .update({ amount: Math.abs(Number(line.amount)) })
      .eq("id", expenseId)
      .eq("user_id", user.id)
      .select("supplier_id")
      .single();
    if (expenseError) throw new Error(expenseError.message);

    const { error: matchError } = await supabase
      .from("bank_statement_lines")
      .update({ matched_expense_id: expenseId, is_ignored: false })
      .eq("id", lineId)
      .eq("user_id", user.id);
    if (matchError) {
      if (matchError.code === "23505") throw new Error("Questa spesa è già collegata a un altro movimento.");
      throw new Error(matchError.message);
    }

    await rememberDetectedCode(supabase, user.id, line.detected_code, updatedExpense?.supplier_id ?? null);

    revalidatePath("/dashboard/expenses");
    revalidateReconciliationPaths();
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// Quando la differenza e' una commissione/maggiorazione applicata dalla banca
// (tipico di Amazon/PayPal con addebiti in valuta estera), la spesa registrata
// resta corretta cosi' com'e': si crea una spesa separata solo per la
// differenza, invece di alterare l'importo originale come se fosse un errore
// di registrazione.
export async function splitReviewDifferenceAsFee(lineId: string, expenseId: string) {
  try {
    const supabase = (await createClient()) as any;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Non autenticato");

    const { data: line, error: lineError } = await supabase
      .from("bank_statement_lines")
      .select("amount, value_date, account_id, detected_code")
      .eq("id", lineId)
      .eq("user_id", user.id)
      .single();
    if (lineError || !line) throw new Error("Movimento non trovato");

    const { data: expense, error: expenseFetchError } = await supabase
      .from("expenses")
      .select("amount, is_income, supplier_id")
      .eq("id", expenseId)
      .eq("user_id", user.id)
      .single();
    if (expenseFetchError || !expense) throw new Error("Spesa non trovata");

    const diff = Math.abs(Number(line.amount)) - Math.abs(Number(expense.amount));
    if (Math.abs(diff) < 0.005) throw new Error("Gli importi coincidono già: non c'è una differenza da separare.");

    const { error: feeError } = await supabase.from("expenses").insert({
      user_id: user.id,
      amount: Math.abs(diff),
      category: "Commissioni",
      supplier_id: expense.supplier_id || null,
      description: "Commissione applicata dalla banca",
      date: line.value_date,
      account_id: line.account_id,
      is_income: diff > 0 ? expense.is_income : !expense.is_income,
    });
    if (feeError) throw new Error(feeError.message);

    const { error: matchError } = await supabase
      .from("bank_statement_lines")
      .update({ matched_expense_id: expenseId, is_ignored: false })
      .eq("id", lineId)
      .eq("user_id", user.id);
    if (matchError) {
      if (matchError.code === "23505") throw new Error("Questa spesa è già collegata a un altro movimento.");
      throw new Error(matchError.message);
    }

    await rememberDetectedCode(supabase, user.id, line.detected_code, expense.supplier_id ?? null);

    revalidatePath("/dashboard/expenses");
    revalidateReconciliationPaths();
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// Collega piu' spese/scadenze gia' registrate a un unico movimento, per i casi
// in cui la banca le accorpa in un solo addebito (es. due rate di un
// finanziamento SDD, o piu' acquisti ravvicinati). A differenza di
// confirmLineMatch (un movimento = una spesa), qui il movimento risulta
// coperto dalla somma delle spese selezionate.
export async function groupMatchLine(lineId: string, expenseIds: string[]) {
  try {
    const supabase = (await createClient()) as any;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Non autenticato");
    if (expenseIds.length === 0) throw new Error("Seleziona almeno una spesa da raggruppare.");

    const { error } = await supabase
      .from("bank_statement_line_expenses")
      .insert(expenseIds.map((expenseId) => ({ user_id: user.id, line_id: lineId, expense_id: expenseId })));
    if (error) {
      if (error.code === "23505") throw new Error("Una di queste spese è già collegata a un altro movimento o raggruppamento.");
      throw new Error(error.message);
    }

    revalidatePath("/dashboard/expenses");
    revalidateReconciliationPaths();
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function ungroupLine(lineId: string) {
  try {
    const supabase = (await createClient()) as any;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Non autenticato");

    const { error } = await supabase.from("bank_statement_line_expenses").delete().eq("line_id", lineId).eq("user_id", user.id);
    if (error) throw new Error(error.message);

    revalidateReconciliationPaths();
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// Come splitReviewDifferenceAsFee, ma per un movimento raggruppato: la somma
// delle spese gia' raggruppate non basta a coprire l'importo del movimento
// (es. la commissione di un R.I.D./S.D.D.), quindi si crea una spesa separata
// solo per la differenza e la si aggiunge al gruppo, invece di lasciarla come
// semplice numero mostrato a schermo.
export async function addGroupDifferenceAsFee(lineId: string) {
  try {
    const supabase = (await createClient()) as any;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Non autenticato");

    const { data: line, error: lineError } = await supabase
      .from("bank_statement_lines")
      .select("amount, value_date, account_id")
      .eq("id", lineId)
      .eq("user_id", user.id)
      .single();
    if (lineError || !line) throw new Error("Movimento non trovato");

    const { data: groupRows, error: groupError } = await supabase
      .from("bank_statement_line_expenses")
      .select("expense_id")
      .eq("line_id", lineId)
      .eq("user_id", user.id);
    if (groupError) throw new Error(groupError.message);
    const expenseIds = (groupRows || []).map((g: any) => g.expense_id);
    if (expenseIds.length === 0) throw new Error("Nessun raggruppamento su questo movimento.");

    const { data: groupExpenses, error: expensesError } = await supabase
      .from("expenses")
      .select("amount, is_income")
      .eq("user_id", user.id)
      .in("id", expenseIds);
    if (expensesError) throw new Error(expensesError.message);

    const total = (groupExpenses || []).reduce((sum: number, e: any) => sum + Number(e.amount), 0);
    const diff = Math.abs(Number(line.amount)) - total;
    if (Math.abs(diff) < 0.005) throw new Error("Gli importi coincidono già: non c'è una differenza da aggiungere.");

    const referenceIsIncome = groupExpenses?.[0]?.is_income ?? false;
    const { data: feeExpense, error: feeError } = await supabase
      .from("expenses")
      .insert({
        user_id: user.id,
        amount: Math.abs(diff),
        category: "Commissioni",
        description: "Commissione applicata dalla banca",
        date: line.value_date,
        account_id: line.account_id,
        is_income: diff > 0 ? referenceIsIncome : !referenceIsIncome,
      })
      .select()
      .single();
    if (feeError) throw new Error(feeError.message);

    const { error: linkError } = await supabase
      .from("bank_statement_line_expenses")
      .insert({ user_id: user.id, line_id: lineId, expense_id: feeExpense.id });
    if (linkError) throw new Error(linkError.message);

    revalidatePath("/dashboard/expenses");
    revalidateReconciliationPaths();
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function unmatchLine(lineId: string) {
  try {
    const supabase = (await createClient()) as any;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Non autenticato");

    const { error } = await supabase
      .from("bank_statement_lines")
      .update({ matched_expense_id: null })
      .eq("id", lineId)
      .eq("user_id", user.id);
    if (error) throw new Error(error.message);

    revalidateReconciliationPaths();
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function restoreStatementLine(lineId: string) {
  try {
    const supabase = (await createClient()) as any;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Non autenticato");

    const { error } = await supabase
      .from("bank_statement_lines")
      .update({ is_ignored: false })
      .eq("id", lineId)
      .eq("user_id", user.id);
    if (error) throw new Error(error.message);

    revalidateReconciliationPaths();
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function ignoreStatementLine(lineId: string) {
  try {
    const supabase = (await createClient()) as any;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Non autenticato");

    const { error } = await supabase
      .from("bank_statement_lines")
      .update({ is_ignored: true, matched_expense_id: null })
      .eq("id", lineId)
      .eq("user_id", user.id);
    if (error) throw new Error(error.message);

    revalidateReconciliationPaths();
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// Crea una nuova spesa/entrata direttamente da un movimento non trovato (bonifico
// dimenticato) o da registrare (commissione), e la collega subito al movimento.
export async function createExpenseFromStatementLine(
  lineId: string,
  formData: { category_name: string; category_id?: string | null; supplier_id?: string | null; description?: string | null }
) {
  try {
    const supabase = (await createClient()) as any;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Non autenticato");

    const { data: line, error: lineError } = await supabase
      .from("bank_statement_lines")
      .select("*")
      .eq("id", lineId)
      .eq("user_id", user.id)
      .single();
    if (lineError || !line) throw new Error("Movimento non trovato");

    const { data: expense, error: expenseError } = await supabase
      .from("expenses")
      .insert({
        user_id: user.id,
        amount: Math.abs(Number(line.amount)),
        category: formData.category_name,
        category_id: formData.category_id || null,
        supplier_id: formData.supplier_id || null,
        description: formData.description ?? line.description,
        date: line.value_date,
        account_id: line.account_id,
        is_income: Number(line.amount) > 0,
      })
      .select()
      .single();
    if (expenseError) throw new Error(expenseError.message);

    const { error: updateError } = await supabase
      .from("bank_statement_lines")
      .update({ matched_expense_id: expense.id })
      .eq("id", lineId)
      .eq("user_id", user.id);
    if (updateError) throw new Error(updateError.message);

    // Se il movimento aveva un codice mai visto prima, la scelta appena fatta (con o
    // senza fornitore) vale anche per la prossima volta che ricompare: eventuali
    // conflitti (codice gia' noto) sono normali e vengono ignorati.
    if (line.detected_code) {
      await supabase.from("supplier_account_codes").insert({
        user_id: user.id,
        supplier_id: formData.supplier_id || null,
        code: line.detected_code,
      });
    }

    revalidatePath("/dashboard/expenses");
    revalidateReconciliationPaths();
    return { success: true, data: expense };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// Collega un codice (terminale POS o IBAN) mai visto prima a un fornitore, cosi'
// che i prossimi movimenti con lo stesso codice (es. un'altra sede dello stesso
// negozio) si abbinino da soli.
export async function linkSupplierAccountCode(formData: { supplier_id: string; code: string; label?: string | null }) {
  try {
    const supabase = (await createClient()) as any;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Non autenticato");

    const { data, error } = await supabase
      .from("supplier_account_codes")
      .insert({
        user_id: user.id,
        supplier_id: formData.supplier_id,
        code: formData.code,
        label: formData.label || null,
      })
      .select()
      .single();
    if (error) {
      if (error.code === "23505") throw new Error("Questo codice è già collegato a un fornitore.");
      throw new Error(error.message);
    }

    revalidateReconciliationPaths();
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// Segna un codice come "riconosciuto ma non e' un fornitore da tracciare" (es.
// un bonifico personale): i prossimi movimenti con lo stesso codice non verranno
// piu' proposti come "nuovo codice", ma comunque confrontati con le spese registrate.
export async function markCodeWithoutSupplier(code: string) {
  try {
    const supabase = (await createClient()) as any;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Non autenticato");

    const { error } = await supabase.from("supplier_account_codes").insert({
      user_id: user.id,
      supplier_id: null,
      code,
    });
    if (error) {
      if (error.code === "23505") throw new Error("Questo codice è già stato registrato.");
      throw new Error(error.message);
    }

    revalidateReconciliationPaths();
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function deleteBankStatementImport(importId: string) {
  try {
    const supabase = (await createClient()) as any;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Non autenticato");

    const { error } = await supabase
      .from("bank_statement_imports")
      .delete()
      .eq("id", importId)
      .eq("user_id", user.id);
    if (error) throw new Error(error.message);

    revalidateReconciliationPaths();
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { parseBankStatementCsv } from "@/lib/bankStatementParser";
import { reconcileStatementLines } from "@/lib/bankReconciliation";

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

    const autoConfirmed = reconciled.filter((r) => r.status === "confirmed" && r.candidateExpense && !r.line.matched_expense_id);
    for (const r of autoConfirmed) {
      const { error } = await supabase
        .from("bank_statement_lines")
        .update({ matched_expense_id: r.candidateExpense!.id })
        .eq("id", r.line.id)
        .eq("user_id", user.id);
      if (error) throw new Error(error.message);
    }

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

    const reconciled = reconcileStatementLines(lines || [], expenses || [], supplierCodes || [], suppliers || []);

    const matchedExpenseIds = new Set((lines || []).map((l: any) => l.matched_expense_id).filter(Boolean));
    const unmatchedExpenses = (expenses || []).filter(
      (e: any) => e.date >= importRow.period_start && e.date <= importRow.period_end && !matchedExpenseIds.has(e.id)
    );

    return { success: true, data: { import: importRow, reconciled, unmatchedExpenses, suppliers: suppliers || [] } };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function confirmLineMatch(lineId: string, expenseId: string) {
  try {
    const supabase = (await createClient()) as any;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Non autenticato");

    const { error } = await supabase
      .from("bank_statement_lines")
      .update({ matched_expense_id: expenseId, is_ignored: false })
      .eq("id", lineId)
      .eq("user_id", user.id);
    if (error) {
      if (error.code === "23505") throw new Error("Questa spesa è già collegata a un altro movimento.");
      throw new Error(error.message);
    }

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

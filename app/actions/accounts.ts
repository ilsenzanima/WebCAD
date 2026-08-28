"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { computeAccountBalances } from "@/lib/accountBalance";

export async function getAccounts() {
  try {
    const supabase = (await createClient()) as any;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Non autenticato");

    const { data, error } = await supabase
      .from("accounts")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });

    if (error) throw new Error(error.message);
    return data || [];
  } catch (err: any) {
    console.error("Errore getAccounts:", err.message);
    return [];
  }
}

export async function createAccount(formData: {
  name: string;
  type: "checking" | "savings" | "cash" | "credit_card" | "other";
  initial_balance: number;
  color?: string;
}) {
  try {
    const supabase = (await createClient()) as any;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Non autenticato");

    const { data, error } = await supabase.from("accounts").insert({
      user_id: user.id,
      name: formData.name,
      type: formData.type,
      initial_balance: formData.initial_balance,
      color: formData.color || "sky",
    }).select().single();

    if (error) throw new Error(error.message);

    revalidatePath("/dashboard/overview");
    revalidatePath("/dashboard/accounts");
    revalidatePath("/dashboard/expenses");
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function updateAccount(id: string, formData: {
  name: string;
  type: "checking" | "savings" | "cash" | "credit_card" | "other";
  initial_balance: number;
  color?: string;
  is_active?: boolean;
}) {
  try {
    const supabase = (await createClient()) as any;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Non autenticato");

    const { data, error } = await supabase
      .from("accounts")
      .update({
        name: formData.name,
        type: formData.type,
        initial_balance: formData.initial_balance,
        color: formData.color || "sky",
        is_active: formData.is_active ?? true,
      })
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) throw new Error(error.message);

    revalidatePath("/dashboard/overview");
    revalidatePath("/dashboard/accounts");
    revalidatePath("/dashboard/expenses");
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// Imposta un conto come predefinito (uno solo per utente, garantito anche a
// livello DB da un indice unico parziale): usato per precompilare la
// selezione conto in Spese/Entrate e nel saldo delle Scadenze.
export async function setDefaultAccount(id: string) {
  try {
    const supabase = (await createClient()) as any;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Non autenticato");

    const { error: clearError } = await supabase
      .from("accounts")
      .update({ is_default: false })
      .eq("user_id", user.id)
      .neq("id", id);
    if (clearError) throw new Error(clearError.message);

    const { error: setError } = await supabase
      .from("accounts")
      .update({ is_default: true })
      .eq("id", id)
      .eq("user_id", user.id);
    if (setError) throw new Error(setError.message);

    revalidatePath("/dashboard/accounts");
    revalidatePath("/dashboard/expenses");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function getAccountAdjustments() {
  try {
    const supabase = (await createClient()) as any;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Non autenticato");

    const { data, error } = await supabase
      .from("account_balance_adjustments")
      .select("*")
      .eq("user_id", user.id)
      .order("date", { ascending: true });

    if (error) throw new Error(error.message);
    return data || [];
  } catch (err: any) {
    console.error("Errore getAccountAdjustments:", err.message);
    return [];
  }
}

// Aggiornamento manuale del saldo di un conto: l'utente segna il saldo reale osservato
// (es. dall'app della banca) a una certa data, per assorbire spese minori non registrate
// senza doverle cercare una per una. La differenza rispetto al saldo che l'app avrebbe
// calcolato da sola viene registrata anche come spesa/entrata "Rettifica saldo" collegata
// al conto, cosi' che resti visibile e inclusa nei totali lato Spese/Report/Budget (in
// precedenza l'aggiustamento allineava solo il saldo del conto, senza lasciare traccia
// nelle spese). L'aggiustamento resta comunque la fonte di verita' per il saldo: la spesa
// correttiva viene esclusa dal ricalcolo del saldo per non contarla due volte
// (vedi lib/accountBalance.ts).
export async function createAccountAdjustment(formData: {
  account_id: string;
  date: string;
  balance: number;
  note?: string | null;
}) {
  try {
    const supabase = (await createClient()) as any;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Non autenticato");

    const [{ data: accounts, error: accountsError }, { data: expenses, error: expensesError }, { data: existingAdjustments, error: adjustmentsError }] = await Promise.all([
      supabase.from("accounts").select("*").eq("user_id", user.id),
      supabase.from("expenses").select("*").eq("user_id", user.id).eq("account_id", formData.account_id),
      supabase.from("account_balance_adjustments").select("*").eq("user_id", user.id).eq("account_id", formData.account_id),
    ]);
    if (accountsError) throw new Error(accountsError.message);
    if (expensesError) throw new Error(expensesError.message);
    if (adjustmentsError) throw new Error(adjustmentsError.message);

    const account = (accounts || []).find((a: any) => a.id === formData.account_id);
    if (!account) throw new Error("Conto non trovato");

    const previousBalances = computeAccountBalances([account], expenses || [], existingAdjustments || [], formData.date);
    const previousBalance = previousBalances[account.id] ?? Number(account.initial_balance);
    const delta = Math.round((formData.balance - previousBalance) * 100) / 100;

    let expenseId: string | null = null;
    if (delta !== 0) {
      const { data: newExpense, error: expenseError } = await supabase.from("expenses").insert({
        user_id: user.id,
        amount: Math.abs(delta),
        category: "Rettifica saldo",
        description: formData.note ? `Rettifica saldo: ${formData.note}` : "Rettifica saldo conto",
        date: formData.date,
        account_id: formData.account_id,
        is_income: delta > 0,
      }).select().single();
      if (expenseError) throw new Error(expenseError.message);
      expenseId = newExpense.id;
    }

    const { data, error } = await supabase.from("account_balance_adjustments").insert({
      user_id: user.id,
      account_id: formData.account_id,
      date: formData.date,
      balance: formData.balance,
      note: formData.note || null,
      expense_id: expenseId,
    }).select().single();

    if (error) throw new Error(error.message);

    revalidatePath("/dashboard/overview");
    revalidatePath("/dashboard/accounts");
    revalidatePath("/dashboard/expenses");
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function deleteAccountAdjustment(id: string) {
  try {
    const supabase = (await createClient()) as any;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Non autenticato");

    const { data: adjustment, error: fetchError } = await supabase
      .from("account_balance_adjustments")
      .select("expense_id")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();
    if (fetchError) throw new Error(fetchError.message);

    const { error } = await supabase
      .from("account_balance_adjustments")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) throw new Error(error.message);

    if (adjustment?.expense_id) {
      const { error: expenseDeleteError } = await supabase
        .from("expenses")
        .delete()
        .eq("id", adjustment.expense_id)
        .eq("user_id", user.id);
      if (expenseDeleteError) throw new Error(expenseDeleteError.message);
    }

    revalidatePath("/dashboard/overview");
    revalidatePath("/dashboard/accounts");
    revalidatePath("/dashboard/expenses");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function deleteAccount(id: string) {
  try {
    const supabase = (await createClient()) as any;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Non autenticato");

    const { error } = await supabase
      .from("accounts")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) throw new Error(error.message);

    revalidatePath("/dashboard/overview");
    revalidatePath("/dashboard/accounts");
    revalidatePath("/dashboard/expenses");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

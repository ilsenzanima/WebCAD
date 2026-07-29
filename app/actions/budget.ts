"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function getBudgets() {
  try {
    const supabase = (await createClient()) as any;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Non autenticato");

    const { data, error } = await supabase
      .from("budgets")
      .select("*, expense_categories(name, color)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    return data || [];
  } catch (err: any) {
    console.error("Errore getBudgets:", err.message);
    return [];
  }
}

export async function createBudget(formData: {
  amount: number;
  category_id: string | null;
  type: "income" | "need" | "want" | "emergency";
  label: string;
  periodicity?: "weekly" | "monthly" | "bimonthly" | "quarterly" | "semiannual" | "annual";
  is_estimated?: boolean;
  end_month?: number | null;
  end_year?: number | null;
  day_of_month?: number | null;
}) {
  try {
    const supabase = (await createClient()) as any;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Non autenticato");

    const { data, error } = await supabase.from("budgets").insert({
      user_id: user.id,
      amount: formData.amount,
      category_id: formData.category_id || null,
      type: formData.type,
      label: formData.label,
      periodicity: formData.periodicity || "monthly",
      is_estimated: formData.is_estimated ?? false,
      end_month: formData.end_month || null,
      end_year: formData.end_year || null,
      day_of_month: formData.day_of_month || null,
    }).select("*, expense_categories(name, color)").single();

    if (error) throw new Error(error.message);

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/budget");
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function updateBudget(id: string, formData: {
  amount: number;
  category_id: string | null;
  type: "income" | "need" | "want" | "emergency";
  label: string;
  periodicity?: "weekly" | "monthly" | "bimonthly" | "quarterly" | "semiannual" | "annual";
  is_estimated?: boolean;
  end_month?: number | null;
  end_year?: number | null;
  day_of_month?: number | null;
}) {
  try {
    const supabase = (await createClient()) as any;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Non autenticato");

    const { data, error } = await supabase
      .from("budgets")
      .update({
        amount: formData.amount,
        category_id: formData.category_id || null,
        type: formData.type,
        label: formData.label,
        periodicity: formData.periodicity || "monthly",
        is_estimated: formData.is_estimated ?? false,
        end_month: formData.end_month || null,
        end_year: formData.end_year || null,
        day_of_month: formData.day_of_month || null,
      })
      .eq("id", id)
      .eq("user_id", user.id)
      .select("*, expense_categories(name, color)")
      .single();

    if (error) throw new Error(error.message);

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/budget");
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function deleteBudget(id: string) {
  try {
    const supabase = (await createClient()) as any;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Non autenticato");

    const { error } = await supabase
      .from("budgets")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) throw new Error(error.message);

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/budget");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function getBudgetOverrides() {
  try {
    const supabase = (await createClient()) as any;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Non autenticato");

    const { data, error } = await supabase
      .from("budget_overrides")
      .select("*")
      .eq("user_id", user.id);

    if (error) throw new Error(error.message);
    return data || [];
  } catch (err: any) {
    console.error("Errore getBudgetOverrides:", err.message);
    return [];
  }
}

export async function upsertBudgetOverride(formData: {
  budget_id: string;
  year: number;
  month: number;
  amount: number;
  note?: string | null;
}) {
  try {
    const supabase = (await createClient()) as any;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Non autenticato");

    const { data, error } = await supabase
      .from("budget_overrides")
      .upsert({
        user_id: user.id,
        budget_id: formData.budget_id,
        year: formData.year,
        month: formData.month,
        amount: formData.amount,
        note: formData.note || null,
        updated_at: new Date().toISOString(),
      }, { onConflict: "budget_id,year,month" })
      .select()
      .single();

    if (error) throw new Error(error.message);

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/budget");
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// Conferma una voce di budget come spesa/entrata reale del mese: crea la
// riga in expenses collegata alla voce (budget_id), ereditandone categoria e
// tipo, cosi' da non dover reinserire tutto da capo e mantenere il collegamento
// tra previsto e reale.
export async function confirmBudgetExpense(budgetId: string, formData: {
  amount: number;
  date: string;
  account_id?: string | null;
}) {
  try {
    const supabase = (await createClient()) as any;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Non autenticato");

    const { data: budget, error: budgetError } = await supabase
      .from("budgets")
      .select("*")
      .eq("id", budgetId)
      .eq("user_id", user.id)
      .single();

    if (budgetError || !budget) throw new Error(budgetError?.message || "Voce di budget non trovata");

    const { data, error } = await supabase.from("expenses").insert({
      user_id: user.id,
      amount: formData.amount,
      category: budget.label,
      category_id: budget.category_id,
      supplier_id: null,
      budget_id: budget.id,
      description: budget.label,
      date: formData.date,
      is_income: budget.type === "income",
      account_id: formData.account_id || null,
    }).select("*, expense_categories(name, color), suppliers(name)").single();

    if (error) throw new Error(error.message);

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/expenses");
    revalidatePath("/dashboard/budget");
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function deleteBudgetOverride(id: string) {
  try {
    const supabase = (await createClient()) as any;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Non autenticato");

    const { error } = await supabase
      .from("budget_overrides")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) throw new Error(error.message);

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/budget");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

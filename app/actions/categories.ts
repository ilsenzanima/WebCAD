"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

const DEFAULT_CATEGORIES = [
  { name: "🏠 Casa & Affitto", color: "indigo" },
  { name: "🔌 Bollette & Utenze", color: "amber" },
  { name: "🛒 Spesa & Alimentari", color: "emerald" },
  { name: "🚗 Auto & Trasporti", color: "rose" },
  { name: "🍔 Svago & Ristoranti", color: "pink" },
  { name: "💻 Tecnologia & Lavoro", color: "sky" },
  { name: "🏥 Salute & Assicurazioni", color: "green" },
  { name: "💼 Tasse & Servizi", color: "slate" },
  { name: "📦 Altro", color: "purple" }
];

export async function getCategories() {
  try {
    const supabase = (await createClient()) as any;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Non autenticato");

    const { data, error } = await supabase
      .from("expense_categories")
      .select("*")
      .eq("user_id", user.id)
      .order("name", { ascending: true });

    if (error) throw new Error(error.message);

    if (!data || data.length === 0) {
      const payload = DEFAULT_CATEGORIES.map(cat => ({
        user_id: user.id,
        name: cat.name,
        color: cat.color
      }));

      const { data: inserted, error: insertError } = await supabase
        .from("expense_categories")
        .insert(payload)
        .select();

      if (insertError) throw new Error(insertError.message);
      return inserted || [];
    }

    return data;
  } catch (err: any) {
    console.error("Errore getCategories:", err.message);
    return [];
  }
}

export async function createCategory(formData: { name: string; color: string }) {
  try {
    const supabase = (await createClient()) as any;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Non autenticato");

    const { data, error } = await supabase.from("expense_categories").insert({
      user_id: user.id,
      name: formData.name.trim(),
      color: formData.color
    }).select().single();

    if (error) {
      if (error.message.includes("duplicate key")) {
        throw new Error("Una categoria con questo nome esiste già.");
      }
      throw new Error(error.message);
    }

    revalidatePath("/dashboard/settings");
    revalidatePath("/dashboard/expenses");
    revalidatePath("/dashboard/schedules");
    revalidatePath("/dashboard/budget");
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function updateCategory(id: string, formData: { name: string; color: string }) {
  try {
    const supabase = (await createClient()) as any;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Non autenticato");

    const { error } = await supabase
      .from("expense_categories")
      .update({
        name: formData.name.trim(),
        color: formData.color
      })
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) throw new Error(error.message);

    revalidatePath("/dashboard/settings");
    revalidatePath("/dashboard/expenses");
    revalidatePath("/dashboard/schedules");
    revalidatePath("/dashboard/budget");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function updateCategoryBudget(id: string, monthlyBudget: number | null) {
  try {
    const supabase = (await createClient()) as any;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Non autenticato");

    const { data, error } = await supabase
      .from("expense_categories")
      // Il limite in € e la percentuale sulle entrate sono alternativi: impostando l'uno si azzera l'altro.
      .update({ monthly_budget: monthlyBudget, budget_percent: null })
      .eq("id", id)
      .eq("user_id", user.id)
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

export async function updateCategoryBudgetPercent(id: string, budgetPercent: number | null) {
  try {
    const supabase = (await createClient()) as any;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Non autenticato");

    const { data, error } = await supabase
      .from("expense_categories")
      .update({ budget_percent: budgetPercent, monthly_budget: null })
      .eq("id", id)
      .eq("user_id", user.id)
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

export async function updateCategoryBudgetType(id: string, budgetType: "need" | "want" | "emergency" | null) {
  try {
    const supabase = (await createClient()) as any;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Non autenticato");

    const { data, error } = await supabase
      .from("expense_categories")
      .update({ budget_type: budgetType })
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) throw new Error(error.message);

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/budget");
    revalidatePath("/dashboard/settings");
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function deleteCategory(id: string) {
  try {
    const supabase = (await createClient()) as any;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Non autenticato");

    const { error } = await supabase
      .from("expense_categories")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) throw new Error(error.message);

    revalidatePath("/dashboard/settings");
    revalidatePath("/dashboard/expenses");
    revalidatePath("/dashboard/schedules");
    revalidatePath("/dashboard/budget");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

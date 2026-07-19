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
  type: "income" | "fixed" | "variable";
  label: string;
  periodicity?: "weekly" | "monthly" | "bimonthly" | "quarterly" | "semiannual" | "annual";
  is_estimated?: boolean;
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
    }).select("*, expense_categories(name, color)").single();

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

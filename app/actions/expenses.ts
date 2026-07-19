"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function getExpenses() {
  try {
    const supabase = (await createClient()) as any;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Non autenticato");

    const { data, error } = await supabase
      .from("expenses")
      .select("*, expense_categories(name, color), suppliers(name)")
      .order("date", { ascending: false });

    if (error) throw new Error(error.message);
    return data || [];
  } catch (err: any) {
    console.error("Errore getExpenses:", err.message);
    return [];
  }
}

export async function createExpense(formData: {
  amount: number;
  category_id: string | null;
  supplier_id: string | null;
  category_name: string;
  description: string;
  date: string;
  is_income?: boolean;
}) {
  try {
    const supabase = (await createClient()) as any;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Non autenticato");

    const { data, error } = await supabase.from("expenses").insert({
      user_id: user.id,
      amount: formData.amount,
      category: formData.category_name,
      category_id: formData.category_id || null,
      supplier_id: formData.supplier_id || null,
      description: formData.description || null,
      date: formData.date,
      is_income: formData.is_income ?? false,
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

export async function updateExpense(
  id: string,
  formData: {
    amount: number;
    category_id: string | null;
    supplier_id: string | null;
    category_name: string;
    description: string;
    date: string;
    is_income?: boolean;
  }
) {
  try {
    const supabase = (await createClient()) as any;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Non autenticato");

    const { error } = await supabase
      .from("expenses")
      .update({
        amount: formData.amount,
        category: formData.category_name,
        category_id: formData.category_id || null,
        supplier_id: formData.supplier_id || null,
        description: formData.description || null,
        date: formData.date,
        is_income: formData.is_income ?? false,
      })
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) throw new Error(error.message);

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/expenses");
    revalidatePath("/dashboard/budget");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function deleteExpense(id: string) {
  try {
    const supabase = (await createClient()) as any;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Non autenticato");

    const { error } = await supabase
      .from("expenses")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) throw new Error(error.message);

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/expenses");
    revalidatePath("/dashboard/budget");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function getSuppliers() {
  try {
    const supabase = (await createClient()) as any;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Non autenticato");

    const { data, error } = await supabase
      .from("suppliers")
      .select("*")
      .order("name", { ascending: true });

    if (error) throw new Error(error.message);
    return data || [];
  } catch (err: any) {
    console.error("Errore getSuppliers:", err.message);
    return [];
  }
}

export async function getSupplierDetail(supplierId: string) {
  try {
    const supabase = (await createClient()) as any;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Non autenticato");

    // Preleva info fornitore
    const { data: supplier, error: sErr } = await supabase
      .from("suppliers")
      .select("*")
      .eq("id", supplierId)
      .eq("user_id", user.id)
      .single();

    if (sErr || !supplier) throw new Error(sErr?.message || "Fornitore non trovato");

    // Preleva spese collegate
    const { data: expenses } = await supabase
      .from("expenses")
      .select("*, expense_categories(name, color)")
      .eq("supplier_id", supplierId)
      .order("date", { ascending: false });

    // Preleva scadenze collegate
    const { data: schedules } = await supabase
      .from("payment_schedules")
      .select("*, expense_categories(name, color)")
      .eq("supplier_id", supplierId)
      .order("due_date", { ascending: false });

    // Preleva documenti collegati
    const { data: documents } = await supabase
      .from("supplier_documents")
      .select("*")
      .eq("supplier_id", supplierId)
      .order("created_at", { ascending: false });

    return {
      supplier,
      expenses: expenses || [],
      schedules: schedules || [],
      documents: documents || [],
    };
  } catch (err: any) {
    console.error("Errore getSupplierDetail:", err.message);
    return null;
  }
}

export async function createSupplier(formData: {
  name: string;
  notes?: string;
  is_utility?: boolean;
  consumption_unit?: string | null;
}) {
  try {
    const supabase = (await createClient()) as any;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Non autenticato");

    const { data, error } = await supabase.from("suppliers").insert({
      user_id: user.id,
      name: formData.name,
      description: formData.notes || null,
      is_utility: formData.is_utility ?? false,
      consumption_unit: formData.is_utility ? (formData.consumption_unit || null) : null,
    }).select().single();

    if (error) throw new Error(error.message);

    revalidatePath("/dashboard/suppliers");
    revalidatePath("/dashboard/settings");
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function updateSupplier(id: string, formData: {
  name: string;
  notes?: string;
  is_utility?: boolean;
  consumption_unit?: string | null;
  is_active?: boolean;
  contract_closed_at?: string | null;
}) {
  try {
    const supabase = (await createClient()) as any;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Non autenticato");

    const { error } = await supabase
      .from("suppliers")
      .update({
        name: formData.name,
        description: formData.notes || null,
        is_utility: formData.is_utility ?? false,
        consumption_unit: formData.is_utility ? (formData.consumption_unit || null) : null,
        is_active: formData.is_active ?? true,
        contract_closed_at: formData.is_active === false ? (formData.contract_closed_at || null) : null,
      })
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) throw new Error(error.message);

    revalidatePath("/dashboard/suppliers");
    revalidatePath("/dashboard/settings");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function deleteSupplier(id: string) {
  try {
    const supabase = (await createClient()) as any;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Non autenticato");

    const { error } = await supabase
      .from("suppliers")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) throw new Error(error.message);

    revalidatePath("/dashboard/suppliers");
    revalidatePath("/dashboard/settings");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { getMyRole } from "@/app/actions/family";
import type { Store } from "@/lib/types/database";

function revalidateStores() {
  revalidatePath("/dashboard/shopping-stores", "layout");
  revalidatePath("/dashboard/shopping-catalog");
  revalidatePath("/dashboard/shopping-list");
  revalidatePath("/dashboard/suppliers");
}

export async function getStores(): Promise<Store[]> {
  try {
    const supabase = (await createClient()) as any;
    const { data, error } = await supabase
      .from("stores")
      .select("*")
      .order("name", { ascending: true });

    if (error) throw new Error(error.message);
    return data || [];
  } catch (err: any) {
    console.error("Errore getStores:", err.message);
    return [];
  }
}

export async function getStore(id: string): Promise<Store | null> {
  try {
    const supabase = (await createClient()) as any;
    const { data, error } = await supabase.from("stores").select("*").eq("id", id).single();
    if (error) throw new Error(error.message);
    return data;
  } catch (err: any) {
    console.error("Errore getStore:", err.message);
    return null;
  }
}

interface StoreFields {
  name: string;
  category?: string | null;
  address?: string | null;
  loyalty_card_number?: string | null;
  notes?: string | null;
}

export async function createStore(formData: StoreFields) {
  try {
    const supabase = (await createClient()) as any;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Non autenticato");

    const { data, error } = await supabase
      .from("stores")
      .insert({
        name: formData.name.trim(),
        category: formData.category || null,
        address: formData.address || null,
        loyalty_card_number: formData.loyalty_card_number || null,
        notes: formData.notes || null,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);

    revalidateStores();
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function updateStore(id: string, formData: Partial<StoreFields>) {
  try {
    const supabase = (await createClient()) as any;
    const update: Record<string, any> = {};
    if (formData.name !== undefined) update.name = formData.name.trim();
    if (formData.category !== undefined) update.category = formData.category || null;
    if (formData.address !== undefined) update.address = formData.address || null;
    if (formData.loyalty_card_number !== undefined) update.loyalty_card_number = formData.loyalty_card_number || null;
    if (formData.notes !== undefined) update.notes = formData.notes || null;

    const { data, error } = await supabase.from("stores").update(update).eq("id", id).select().single();
    if (error) throw new Error(error.message);

    revalidateStores();
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function deleteStore(id: string) {
  try {
    const supabase = (await createClient()) as any;
    const { error } = await supabase.from("stores").delete().eq("id", id);
    if (error) throw new Error(error.message);

    revalidateStores();
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// Riepilogo spese Finanze per un Negozio: solo per l'admin, passando dal
// Fornitore (privato) eventualmente collegato a questo Negozio condiviso.
// Restituisce null per chi non e' admin, cosi' la scheda del negozio resta
// visibile a tutta la famiglia ma il quadro economico solo a chi ha accesso
// alle Finanze.
export async function getStoreSpendingSummary(storeId: string): Promise<{
  supplierName: string;
  totalAmount: number;
  count: number;
  lastDate: string | null;
} | null> {
  try {
    const role = await getMyRole();
    if (role !== "admin") return null;

    const supabase = (await createClient()) as any;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: supplier } = await supabase
      .from("suppliers")
      .select("id, name")
      .eq("store_id", storeId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!supplier) return null;

    const { data: expenses, error } = await supabase
      .from("expenses")
      .select("amount, date")
      .eq("supplier_id", supplier.id)
      .eq("user_id", user.id)
      .eq("is_income", false);

    if (error) throw new Error(error.message);

    const totalAmount = (expenses || []).reduce((sum: number, e: any) => sum + Number(e.amount), 0);
    const lastDate = (expenses || []).reduce((latest: string | null, e: any) => (!latest || e.date > latest ? e.date : latest), null);

    return { supplierName: supplier.name, totalAmount, count: (expenses || []).length, lastDate };
  } catch (err: any) {
    console.error("Errore getStoreSpendingSummary:", err.message);
    return null;
  }
}

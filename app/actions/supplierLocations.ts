"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function getSupplierLocations() {
  try {
    const supabase = (await createClient()) as any;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Non autenticato");

    const { data, error } = await supabase
      .from("supplier_locations")
      .select("*")
      .eq("user_id", user.id)
      .order("city", { ascending: true });

    if (error) throw new Error(error.message);
    return data || [];
  } catch (err: any) {
    console.error("Errore getSupplierLocations:", err.message);
    return [];
  }
}

export async function createSupplierLocation(formData: {
  supplier_id: string;
  name?: string | null;
  address?: string | null;
  city?: string | null;
}) {
  try {
    const supabase = (await createClient()) as any;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Non autenticato");

    if (!formData.name?.trim() && !formData.address?.trim() && !formData.city?.trim()) {
      throw new Error("Inserisci almeno un nome, un indirizzo o una città");
    }

    const { data, error } = await supabase.from("supplier_locations").insert({
      user_id: user.id,
      supplier_id: formData.supplier_id,
      name: formData.name?.trim() || null,
      address: formData.address?.trim() || null,
      city: formData.city?.trim() || null,
    }).select().single();

    if (error) throw new Error(error.message);

    revalidatePath("/dashboard/suppliers");
    revalidatePath("/dashboard/expenses");
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function deleteSupplierLocation(id: string) {
  try {
    const supabase = (await createClient()) as any;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Non autenticato");

    const { error } = await supabase
      .from("supplier_locations")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) throw new Error(error.message);

    revalidatePath("/dashboard/suppliers");
    revalidatePath("/dashboard/expenses");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

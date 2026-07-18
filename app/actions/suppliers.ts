"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function getSuppliers() {
  const supabase = (await createClient()) as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Non autenticato");

  const { data, error } = await supabase
    .from("suppliers")
    .select("*")
    .order("name", { ascending: true });

  if (error) throw new Error(error.message);
  return data || [];
}

export async function createSupplier(formData: { name: string; description: string }) {
  const supabase = (await createClient()) as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Non autenticato");

  const { error } = await supabase.from("suppliers").insert({
    user_id: user.id,
    name: formData.name.trim(),
    description: formData.description || null
  });

  if (error) {
    if (error.message.includes("duplicate key")) {
      throw new Error("Un fornitore con questo nome esiste già.");
    }
    throw new Error(error.message);
  }

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/expenses");
  revalidatePath("/dashboard/schedules");
  return { success: true };
}

export async function updateSupplier(id: string, formData: { name: string; description: string }) {
  const supabase = (await createClient()) as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Non autenticato");

  const { error } = await supabase
    .from("suppliers")
    .update({
      name: formData.name.trim(),
      description: formData.description || null
    })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/expenses");
  revalidatePath("/dashboard/schedules");
  return { success: true };
}

export async function deleteSupplier(id: string) {
  const supabase = (await createClient()) as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Non autenticato");

  const { error } = await supabase
    .from("suppliers")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/expenses");
  revalidatePath("/dashboard/schedules");
  return { success: true };
}

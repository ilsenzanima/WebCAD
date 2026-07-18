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
  const supabase = (await createClient()) as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Non autenticato");

  // Leggi le categorie dell'utente
  const { data, error } = await supabase
    .from("expense_categories")
    .select("*")
    .order("name", { ascending: true });

  if (error) throw new Error(error.message);

  // Se l'utente non ha categorie (primo accesso), inizializzale con quelle di default
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
}

export async function createCategory(formData: { name: string; color: string }) {
  const supabase = (await createClient()) as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Non autenticato");

  const { error } = await supabase.from("expense_categories").insert({
    user_id: user.id,
    name: formData.name.trim(),
    color: formData.color
  });

  if (error) {
    if (error.message.includes("duplicate key")) {
      throw new Error("Una categoria con questo nome esiste già.");
    }
    throw new Error(error.message);
  }

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/expenses");
  revalidatePath("/dashboard/schedules");
  return { success: true };
}

export async function updateCategory(id: string, formData: { name: string; color: string }) {
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
  return { success: true };
}

export async function deleteCategory(id: string) {
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
  return { success: true };
}

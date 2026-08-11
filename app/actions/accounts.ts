"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

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
// senza doverle cercare una per una.
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

    const { data, error } = await supabase.from("account_balance_adjustments").insert({
      user_id: user.id,
      account_id: formData.account_id,
      date: formData.date,
      balance: formData.balance,
      note: formData.note || null,
    }).select().single();

    if (error) throw new Error(error.message);

    revalidatePath("/dashboard/overview");
    revalidatePath("/dashboard/accounts");
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

    const { error } = await supabase
      .from("account_balance_adjustments")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) throw new Error(error.message);

    revalidatePath("/dashboard/overview");
    revalidatePath("/dashboard/accounts");
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

"use server";

import { createClient } from "@/lib/supabase/server";
import { createIsolatedClient } from "@/lib/supabase/isolated";
import { revalidatePath } from "next/cache";
import type { FamilyMember } from "@/lib/types/database";

// Chi non ha ancora una riga in family_members viene trattato come admin,
// per compatibilita' con l'account esistente prima dell'introduzione di
// questa tabella.
async function requireAdmin() {
  const supabase = (await createClient()) as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Non autenticato");

  const { data: me } = await supabase
    .from("family_members")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  const isAdmin = !me || me.role === "admin";
  if (!isAdmin) throw new Error("Solo un amministratore può gestire i membri della famiglia");

  return { supabase, user };
}

export async function getFamilyMembers(): Promise<FamilyMember[]> {
  try {
    const supabase = (await createClient()) as any;
    const { data, error } = await supabase
      .from("family_members")
      .select("*")
      .order("created_at", { ascending: true });

    if (error) throw new Error(error.message);
    return data || [];
  } catch (err: any) {
    console.error("Errore getFamilyMembers:", err.message);
    return [];
  }
}

export async function getMyRole(): Promise<"admin" | "member"> {
  try {
    const supabase = (await createClient()) as any;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return "member";

    const { data } = await supabase
      .from("family_members")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();

    return !data || data.role === "admin" ? "admin" : "member";
  } catch {
    return "admin";
  }
}

export async function createFamilyMember(formData: {
  full_name: string;
  email: string;
  password: string;
  role: "admin" | "member";
}): Promise<{ success: boolean; error?: string; needsConfirmation?: boolean }> {
  try {
    const { supabase } = await requireAdmin();

    if (formData.password.length < 6) {
      return { success: false, error: "La password deve contenere almeno 6 caratteri" };
    }

    // Client isolato: crea l'account del familiare senza toccare la sessione
    // dell'amministratore che sta eseguendo l'azione.
    const isolated = createIsolatedClient();
    const { data: signUpData, error: signUpError } = await isolated.auth.signUp({
      email: formData.email,
      password: formData.password,
      options: { data: { full_name: formData.full_name } },
    });

    if (signUpError) throw new Error(signUpError.message);
    if (!signUpData.user) throw new Error("Creazione account non riuscita");

    const { error: insertError } = await supabase.from("family_members").insert({
      user_id: signUpData.user.id,
      display_name: formData.full_name,
      role: formData.role,
    });

    if (insertError) throw new Error(insertError.message);

    revalidatePath("/dashboard/settings");
    // Se il progetto Supabase richiede la conferma email, non c'e' ancora una sessione:
    // il familiare dovra' cliccare il link ricevuto prima di poter accedere.
    return { success: true, needsConfirmation: !signUpData.session };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function removeFamilyMember(userId: string) {
  try {
    const { supabase } = await requireAdmin();

    const { error } = await supabase.from("family_members").delete().eq("user_id", userId);
    if (error) throw new Error(error.message);

    revalidatePath("/dashboard/settings");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

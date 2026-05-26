"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export interface UserTag {
  id: string;
  user_id: string;
  section: string;
  name: string;
  created_at: string;
}

export async function getUserTags(section: string): Promise<UserTag[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("user_tags")
    .select("id, user_id, section, name, created_at")
    .eq("section", section)
    .order("name", { ascending: true });

  if (error) return [];
  return data ?? [];
}

export async function createUserTag(
  section: string,
  name: string,
): Promise<{ success: boolean; tag?: UserTag; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Non autenticato" };

  const trimmed = name.trim();
  if (!trimmed) return { success: false, error: "Nome non valido" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("user_tags")
    .insert({ user_id: user.id, section, name: trimmed })
    .select("id, user_id, section, name, created_at")
    .single();

  if (error) {
    if (error.code === "23505") return { success: false, error: "Tag già esistente" };
    return { success: false, error: error.message };
  }

  revalidatePath("/catalog/configurazione");
  revalidatePath("/catalog/new");
  return { success: true, tag: data };
}

export async function deleteUserTag(
  id: string,
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("user_tags")
    .delete()
    .eq("id", id);

  if (error) return { success: false, error: error.message };

  revalidatePath("/catalog/configurazione");
  revalidatePath("/catalog/new");
  return { success: true };
}

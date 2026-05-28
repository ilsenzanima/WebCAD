"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export interface Sketch {
  id: string;
  name: string;
  user_id: string;
  level_id: string | null;
  image_data: string | null;
  created_at: string;
  updated_at: string;
  levels?: {
    name: string;
    piano: string | null;
    projects?: {
      name: string;
    };
  } | null;
}

// ============================================================
// QUERY: Recupera tutti gli sketch dell'utente
// ============================================================
export async function getSketches(): Promise<Sketch[]> {
  const supabaseTyped = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = supabaseTyped as any;
  const { data: { user } } = await supabaseTyped.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("sketches")
    .select(`
      id, 
      name, 
      user_id, 
      level_id, 
      image_data, 
      created_at, 
      updated_at,
      levels:level_id (
        name,
        piano,
        projects:project_id (
          name
        )
      )
    `)
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("Errore recupero sketches:", error);
    return [];
  }

  return (data ?? []) as Sketch[];
}

// ============================================================
// QUERY: Recupera un singolo sketch per ID
// ============================================================
export async function getSketch(id: string): Promise<Sketch | null> {
  const supabaseTyped = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = supabaseTyped as any;
  const { data: { user } } = await supabaseTyped.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("sketches")
    .select(`
      id, 
      name, 
      user_id, 
      level_id, 
      image_data, 
      created_at, 
      updated_at,
      levels:level_id (
        name,
        piano,
        projects:project_id (
          name
        )
      )
    `)
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error) {
    console.error(`Errore recupero sketch ${id}:`, error);
    return null;
  }

  return data as Sketch;
}

// ============================================================
// ACTION: Crea un nuovo sketch
// ============================================================
export async function createSketch(
  name: string,
  levelId: string | null = null,
  imageData: string | null = null
): Promise<{ success: boolean; id?: string; error?: string }> {
  const supabaseTyped = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = supabaseTyped as any;
  const { data: { user } } = await supabaseTyped.auth.getUser();
  if (!user) return { success: false, error: "Non autenticato" };

  const trimmedName = name.trim() || "Nuovo Sketch";

  const { data, error } = await supabase
    .from("sketches")
    .insert({
      name: trimmedName,
      user_id: user.id,
      level_id: levelId || null,
      image_data: imageData || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error) {
    console.error("Errore creazione sketch:", error);
    return { success: false, error: error.message };
  }

  revalidatePath("/sketches");
  return { success: true, id: data.id };
}

// ============================================================
// ACTION: Aggiorna uno sketch esistente (es. disegno o nome)
// ============================================================
export async function updateSketch(
  id: string,
  updates: {
    name?: string;
    level_id?: string | null;
    image_data?: string | null;
  }
): Promise<{ success: boolean; error?: string }> {
  const supabaseTyped = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = supabaseTyped as any;
  const { data: { user } } = await supabaseTyped.auth.getUser();
  if (!user) return { success: false, error: "Non autenticato" };

  const fieldsToUpdate: any = {
    updated_at: new Date().toISOString()
  };

  if (updates.name !== undefined) {
    fieldsToUpdate.name = updates.name.trim() || "Sketch Senza Nome";
  }
  if (updates.level_id !== undefined) {
    fieldsToUpdate.level_id = updates.level_id || null;
  }
  if (updates.image_data !== undefined) {
    fieldsToUpdate.image_data = updates.image_data;
  }

  const { error } = await supabase
    .from("sketches")
    .update(fieldsToUpdate)
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    console.error(`Errore aggiornamento sketch ${id}:`, error);
    return { success: false, error: error.message };
  }

  revalidatePath("/sketches");
  revalidatePath(`/sketches/${id}`);
  return { success: true };
}

// ============================================================
// ACTION: Elimina uno sketch
// ============================================================
export async function deleteSketch(id: string): Promise<{ success: boolean; error?: string }> {
  const supabaseTyped = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = supabaseTyped as any;
  const { data: { user } } = await supabaseTyped.auth.getUser();
  if (!user) return { success: false, error: "Non autenticato" };

  const { error } = await supabase
    .from("sketches")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    console.error(`Errore eliminazione sketch ${id}:`, error);
    return { success: false, error: error.message };
  }

  revalidatePath("/sketches");
  return { success: true };
}

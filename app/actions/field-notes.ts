"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// ============================================
// Tipi TypeScript
// ============================================

export interface FieldNoteType {
  id: string;
  name: string;
  created_at: string;
}

export interface FieldNoteItem {
  id: string;
  item_type: "base" | "altezza" | "spessore" | "lana_interna" | "dipintura" | "nota";
  value_num?: number | null;
  value_unit?: string | null;
  value_bool?: boolean | null;
  value_text?: string | null;
  sort_order: number;
}

export interface FieldNote {
  id: string;
  project_id: string;
  level_id: string | null;
  note_number: number;
  type_id: string | null;
  type_name: string | null;
  created_at: string;
  updated_at: string;
  field_note_items?: FieldNoteItem[];
}

// ============================================
// TIPI APPUNTO
// ============================================

export async function getNoteTypes(): Promise<FieldNoteType[]> {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("field_note_types")
    .select("id, name, created_at")
    .order("name", { ascending: true });

  if (error) return [];
  return data ?? [];
}

export async function createNoteType(
  name: string
): Promise<{ success: boolean; type?: FieldNoteType; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Non autenticato" };

  const trimmed = name.trim();
  if (!trimmed) return { success: false, error: "Nome non valido" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("field_note_types")
    .insert({ user_id: user.id, name: trimmed })
    .select("id, name, created_at")
    .single();

  if (error) {
    if (error.code === "23505")
      return { success: false, error: "Tipo già esistente" };
    return { success: false, error: error.message };
  }

  revalidatePath("/catalog");
  return { success: true, type: data };
}

export async function deleteNoteType(
  typeId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("field_note_types")
    .delete()
    .eq("id", typeId);

  if (error) return { success: false, error: error.message };

  revalidatePath("/catalog");
  return { success: true };
}

// ============================================
// APPUNTI
// ============================================

/**
 * Restituisce gli appunti di un LIVELLO specifico (piano 2D/3D).
 */
export async function getFieldNotes(
  levelId: string
): Promise<FieldNote[]> {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("field_notes")
    .select("id, project_id, level_id, note_number, type_id, type_name, created_at, updated_at, field_note_items(id, item_type, value_num, value_unit, value_bool, value_text, sort_order)")
    .eq("level_id", levelId)
    .order("note_number", { ascending: true });

  if (error) return [];
  return data ?? [];
}

/**
 * Restituisce TUTTI gli appunti di un progetto (panoramica, tutti i livelli).
 */
export async function getAllProjectFieldNotes(
  projectId: string
): Promise<FieldNote[]> {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("field_notes")
    .select("id, project_id, level_id, note_number, type_id, type_name, created_at, updated_at, field_note_items(id, item_type, value_num, value_unit, value_bool, value_text, sort_order)")
    .eq("project_id", projectId)
    .order("note_number", { ascending: true });

  if (error) return [];
  return data ?? [];
}

export async function getFieldNote(
  noteId: string
): Promise<FieldNote | null> {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("field_notes")
    .select("id, project_id, note_number, type_id, type_name, created_at, updated_at, field_note_items(*)")
    .eq("id", noteId)
    .single();

  if (error) return null;
  return data;
}

export async function createFieldNote(formData: {
  project_id: string;
  level_id: string;          // livello (piano 2D/3D) obbligatorio
  type_id?: string | null;
  type_name?: string | null;
  items: Array<{
    item_type: FieldNoteItem["item_type"];
    value_num?: number | null;
    value_unit?: string | null;
    value_bool?: boolean | null;
    value_text?: string | null;
    sort_order: number;
  }>;
}): Promise<{ success: boolean; note?: FieldNote; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Non autenticato" };

  // Ottieni numero progressivo atomico
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: numData, error: numError } = await (supabase as any)
    .rpc("next_field_note_number", { p_user_id: user.id });

  if (numError) return { success: false, error: "Errore numerazione: " + numError.message };

  const note_number: number = numData;

  // Inserisci l'appunto
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: note, error: noteError } = await (supabase as any)
    .from("field_notes")
    .insert({
      project_id: formData.project_id,
      level_id: formData.level_id,
      user_id: user.id,
      note_number,
      type_id: formData.type_id ?? null,
      type_name: formData.type_name ?? null,
    })
    .select("id, project_id, note_number, type_id, type_name, created_at, updated_at")
    .single();

  if (noteError) return { success: false, error: noteError.message };

  // Inserisci le voci
  if (formData.items.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: itemsError } = await (supabase as any)
      .from("field_note_items")
      .insert(
        formData.items.map((item) => ({
          note_id: note.id,
          ...item,
        }))
      );
    if (itemsError) return { success: false, error: itemsError.message };
  }

  revalidatePath(`/projects/${formData.project_id}/levels/${formData.level_id}/appunti`);
  return { success: true, note };
}

export async function deleteFieldNote(
  noteId: string,
  projectId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("field_notes")
    .delete()
    .eq("id", noteId);

  if (error) return { success: false, error: error.message };

  revalidatePath(`/projects/${projectId}/appunti`);
  return { success: true };
}

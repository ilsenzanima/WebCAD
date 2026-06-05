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
  item_type: "base" | "altezza" | "spessore" | "lana_interna" | "dipintura" | "nota" | "foto" | "dim_quadrata" | "dim_cubica" | "posizione" | "materiale";
  // misura singola (base, altezza, spessore)
  value_num?: number | null;
  value_unit?: string | null;
  // misure composite JSON: { b, h, d?, unit }
  value_text?: string | null;
  value_bool?: boolean | null;
  composite?: any;
  sort_order: number;
}

export interface FieldNote {
  id: string;
  project_id: string;
  level_id: string | null;
  note_number: number;
  type_id: string | null;
  type_name: string | null;
  completed?: boolean;
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
    .select("id, project_id, level_id, note_number, type_id, type_name, completed, created_at, updated_at, field_note_items(id, item_type, value_num, value_unit, value_bool, value_text, sort_order)")
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
    .select("id, project_id, level_id, note_number, type_id, type_name, completed, created_at, updated_at, field_note_items(id, item_type, value_num, value_unit, value_bool, value_text, sort_order)")
    .eq("project_id", projectId)
    .order("note_number", { ascending: true });

  if (error) return [];
  return data ?? [];
}

export async function getFieldNote(
  noteId: string
): Promise<FieldNote | null> {
  // Verifica se noteId è un UUID Postgres valido (36 caratteri, formato xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
  const isUuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(noteId);
  if (!isUuid) {
    console.log(`ℹ️ [getFieldNote] ID temporaneo o non UUID rilevato: "${noteId}". Ritorno null in sicurezza.`);
    return null;
  }

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("field_notes")
    .select("id, project_id, level_id, note_number, type_id, type_name, completed, created_at, updated_at, field_note_items(*)")
    .eq("id", noteId)
    .single();

  if (error) return null;
  return data;
}

export async function updateFieldNote(noteId: string, formData: {
  project_id: string;
  level_id: string | null;
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
}): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Non autenticato" };

  // Aggiorna l'appunto
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: noteError } = await (supabase as any)
    .from("field_notes")
    .update({
      level_id: formData.level_id,
      type_id: formData.type_id ?? null,
      type_name: formData.type_name ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", noteId)
    .eq("user_id", user.id);

  if (noteError) return { success: false, error: noteError.message };

  // Sostituisci tutte le voci (cancella vecchie, inserisci nuove)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any)
    .from("field_note_items")
    .delete()
    .eq("note_id", noteId);

  if (formData.items.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: itemsError } = await (supabase as any)
      .from("field_note_items")
      .insert(
        formData.items.map((item) => ({
          note_id: noteId,
          ...item,
        }))
      );
    if (itemsError) return { success: false, error: itemsError.message };
  }

  revalidatePath(`/projects/${formData.project_id}/levels/${formData.level_id}/appunti`);
  return { success: true };
}

export async function createFieldNote(formData: {
  project_id: string;
  level_id: string | null;          // livello (piano 2D/3D) opzionale
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

export async function getOrCreateLevelNote(
  projectId: string,
  levelId: string
): Promise<{ success: boolean; noteId?: string; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Utente non autenticato" };

  try {
    // Cerca nota esistente per questo livello
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existing, error: searchError } = await (supabase as any)
      .from("field_notes")
      .select("id")
      .eq("level_id", levelId)
      .limit(1);

    if (searchError) {
      console.error("🔴 [getOrCreateLevelNote] search error:", searchError);
      return { success: false, error: searchError.message };
    }

    if (existing && existing.length > 0) {
      return { success: true, noteId: existing[0].id };
    }

    // Se non esiste, creala al volo
    const res = await createFieldNote({
      project_id: projectId,
      level_id: levelId,
      type_id: null,
      type_name: "Appunti Cantiere",
      items: [
        {
          item_type: "nota",
          value_text: "",
          sort_order: 0
        }
      ]
    });

    if (res.success && res.note) {
      return { success: true, noteId: res.note.id };
    }

    return { success: false, error: res.error || "Impossibile creare l'appunto." };
  } catch (err: any) {
    console.error("🔴 [getOrCreateLevelNote] unexpected error:", err);
    return { success: false, error: err.message || String(err) };
  }
}


export async function getLevelNoteText(levelId: string): Promise<string> {
  const supabase = await createClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("field_notes")
    .select("field_note_items(item_type, value_text, value_num, value_unit, value_bool)")
    .eq("level_id", levelId)
    .order("created_at", { ascending: true });

  if (error || !data || data.length === 0) return "";

  const technicalItems: string[] = [];
  const noteTexts: string[] = [];

  for (const note of data) {
    const items = note.field_note_items ?? [];
    for (const item of items) {
      if (item.item_type === "nota") {
        if (item.value_text) noteTexts.push(item.value_text.trim());
      } else {
        let desc = "";
        const valNum = item.value_num;
        const valUnit = item.value_unit || "";
        const valBool = item.value_bool;
        const valText = item.value_text || "";

        switch (item.item_type) {
          case "base":
            desc = `Base: ${valNum} ${valUnit || "mm"}`;
            break;
          case "altezza":
            desc = `Altezza: ${valNum} ${valUnit || "mm"}`;
            break;
          case "spessore":
            desc = `Spessore: ${valNum} ${valUnit || "mm"}`;
            break;
          case "lana_interna":
            desc = `Lana Interna: ${valBool ? "Sì" : "No"}`;
            break;
          case "dipintura":
            desc = `Dipintura: ${valBool ? "Sì" : "No"}`;
            break;
          case "dim_quadrata":
            try {
              const parsed = valText ? JSON.parse(valText) : {};
              if (parsed.isCutPiece || (parsed.q !== undefined && parsed.q !== null)) {
                desc = `Pezzo da tagliare: ${parsed.b || 0} x ${parsed.h || 0} ${parsed.unit || "cm"} (Qtà: ${parsed.q})`;
              } else {
                desc = `Dimensione Quadrata: ${parsed.b || 0} x ${parsed.h || 0} ${parsed.unit || "cm"}`;
              }
            } catch {
              desc = `Dimensione Quadrata: ${valNum || 0} ${valUnit || "cm"}`;
            }
            break;
          case "dim_cubica":
            try {
              const parsed = valText ? JSON.parse(valText) : {};
              desc = `Sezione 3D: ${parsed.b || 0} x ${parsed.h || 0} x ${parsed.d || 0} ${parsed.unit || "cm"}`;
            } catch {
              desc = `Dimensione Cubica: ${valNum || 0} ${valUnit || "cm"}`;
            }
            break;
          case "materiale":
            desc = `Materiale: ${valText}`;
            break;
          case "foto":
            desc = `Foto allegata: ${valText}`;
            break;
          case "posizione":
            desc = `Posizione segnata: ${valText}`;
            break;
          default:
            desc = `${item.item_type}: ${valText || valNum || ""}`;
        }
        if (desc) technicalItems.push(`• ${desc}`);
      }
    }
  }

  const sections: string[] = [];
  if (technicalItems.length > 0) {
    sections.push(
      `=== MISURE & VOCI DA MOBILE ===\n${technicalItems.join("\n")}\n==============================`
    );
  }
  
  const mergedNotes = noteTexts.filter(Boolean).join("\n\n");
  if (mergedNotes) {
    sections.push(mergedNotes);
  }

  return sections.join("\n\n");
}

export async function updateLevelNoteText(
  levelId: string,
  text: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Utente non autenticato" };

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: noteData, error: noteError } = await (supabase as any)
      .from("field_notes")
      .select("id, project_id")
      .eq("level_id", levelId)
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .limit(1);

    if (noteError) return { success: false, error: noteError.message };

    let noteId = noteData?.[0]?.id as string | undefined;
    let projectId = noteData?.[0]?.project_id as string | undefined;

    if (!noteId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: levelData, error: levelError } = await (supabase as any)
        .from("levels")
        .select("project_id")
        .eq("id", levelId)
        .single();

      if (levelError || !levelData?.project_id) {
        return { success: false, error: levelError?.message || "Livello non trovato" };
      }

      projectId = levelData.project_id;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: numData, error: numError } = await (supabase as any)
        .rpc("next_field_note_number", { p_user_id: user.id });

      if (numError) return { success: false, error: numError.message };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: newNote, error: newNoteError } = await (supabase as any)
        .from("field_notes")
        .insert({
          project_id: projectId,
          level_id: levelId,
          user_id: user.id,
          note_number: numData,
          type_name: "Appunti Cantiere",
        })
        .select("id")
        .single();

      if (newNoteError) return { success: false, error: newNoteError.message };
      noteId = newNote.id;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: items, error: itemsError } = await (supabase as any)
      .from("field_note_items")
      .select("id")
      .eq("note_id", noteId)
      .eq("item_type", "nota")
      .order("sort_order", { ascending: true })
      .limit(1);

    if (itemsError) return { success: false, error: itemsError.message };

    if (items && items.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: updError } = await (supabase as any)
        .from("field_note_items")
        .update({ value_text: text })
        .eq("id", items[0].id);
      if (updError) return { success: false, error: updError.message };
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: insError } = await (supabase as any)
        .from("field_note_items")
        .insert({
          note_id: noteId,
          item_type: "nota",
          value_text: text,
          sort_order: 0,
        });
      if (insError) return { success: false, error: insError.message };
    }

    if (projectId) {
      revalidatePath(`/projects/${projectId}/levels/${levelId}/appunti`);
    }

    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}

export async function toggleFieldNoteCompleted(
  noteId: string,
  completed: boolean
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Non autenticato" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("field_notes")
    .update({ completed })
    .eq("id", noteId)
    .eq("user_id", user.id);

  if (error) {
    console.error("🔴 [toggleFieldNoteCompleted] error:", error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

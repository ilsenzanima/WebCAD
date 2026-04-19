"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// ============================================================
// Helpers privati
// ============================================================

async function getAuthUser() {
  const supabaseTyped = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = supabaseTyped as any;
  const {
    data: { user },
  } = await supabaseTyped.auth.getUser();
  return { supabase, user };
}

// ============================================================
// ACTION: Crea un nuovo progetto e redirige all'editor
// ============================================================

export async function createProject(customName?: string) {
  const { supabase, user } = await getAuthUser();

  if (!user) {
    throw new Error("Devi essere autenticato per creare un progetto.");
  }

  let projectName = customName?.trim() || "";

  if (!projectName) {
    // Conteggio progetti dell'utente per nome incrementale
    const { count } = await supabase
      .from("projects")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id);

    projectName =
      count && count > 0
        ? `Nuovo Progetto Antincendio #${count + 1}`
        : "Nuovo Progetto Antincendio";
  }

  const { data, error } = (await supabase
    .from("projects")
    .insert({
      name: projectName,
      user_id: user.id,
      client_info: {},
    } as any)
    .select("id")
    .single()) as any;

  if (error || !data) {
    console.error("Errore creazione progetto:", error);
    throw new Error("Impossibile creare il progetto");
  }

  // Creazione del primo livello base associato al progetto
  const { error: levelError } = await supabase.from("levels").insert({
    project_id: data.id,
    name: "Piano Terra",
    elevation_z: 0,
    scale_ratio: null,
    plan_image_url: null,
  } as any);

  if (levelError) {
    console.error("Errore creazione level 0:", levelError);
  }

  // Redirigi alla pagina di dettaglio del progetto
  revalidatePath("/projects");
  redirect(`/projects/${data.id}`);
}

// ============================================================
// ACTION: Aggiorna note del progetto
// ============================================================

export async function updateProjectNotes(projectId: string, notes: string) {
  const { supabase, user } = await getAuthUser();
  if (!user) throw new Error("Non autenticato.");

  const { error } = await supabase
    .from("projects")
    .update({ notes, updated_at: new Date().toISOString() })
    .eq("id", projectId)
    .eq("user_id", user.id);

  if (error) {
    console.error("Errore salvataggio note progetto:", error);
    return { error: "Impossibile salvare le note." };
  }

  return { success: true };
}

// ============================================================
// ACTION: Rinomina un progetto
// ============================================================

export async function renameProject(projectId: string, newName: string) {
  const { supabase, user } = await getAuthUser();
  if (!user) throw new Error("Non autenticato.");

  const trimmed = newName.trim();
  if (!trimmed) return { error: "Il nome non può essere vuoto." };

  const updatePayload: Record<string, unknown> = {
    name: trimmed,
    updated_at: new Date().toISOString(),
  };

  const { error } = await (supabase as any)
    .from("projects")
    .update(updatePayload)
    .eq("id", projectId)
    .eq("user_id", user.id);

  if (error) {
    console.error("Errore rinomina progetto:", error);
    return { error: "Impossibile rinominare il progetto." };
  }

  revalidatePath("/projects");
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/editor`);
  return { success: true };
}

// ============================================================
// ACTION: Elimina un progetto (cascade su livelli ed elementi)
// ============================================================

export async function deleteProject(projectId: string) {
  const { supabase, user } = await getAuthUser();
  if (!user) throw new Error("Non autenticato.");

  const { error } = await supabase
    .from("projects")
    .delete()
    .eq("id", projectId)
    .eq("user_id", user.id);

  if (error) {
    console.error("Errore eliminazione progetto:", error);
    return { error: "Impossibile eliminare il progetto." };
  }

  revalidatePath("/projects");
  return { success: true };
}

// ============================================================
// QUERY: Recupera i livelli di un progetto
// ============================================================

export async function getLevels(projectId: string) {
  const { supabase, user } = await getAuthUser();
  if (!user) throw new Error("Non autenticato.");

  const { data, error } = await supabase
    .from("levels")
    .select("id, project_id, name, elevation_z, scale_ratio, plan_image_url, created_at")
    .eq("project_id", projectId)
    .order("elevation_z", { ascending: true });

  if (error) {
    console.error("Errore recupero livelli:", error);
    return [];
  }

  return (data ?? []) as any[];
}

// ============================================================
// ACTION: Aggiunge un nuovo livello al progetto
// ============================================================

export async function addLevel(projectId: string) {
  const { supabase, user } = await getAuthUser();
  if (!user) throw new Error("Non autenticato.");

  // Calcola la nuova elevation_z come max + 1
  const { data: existing } = await supabase
    .from("levels")
    .select("elevation_z, name")
    .eq("project_id", projectId)
    .order("elevation_z", { ascending: false })
    .limit(1);

  const maxZ = existing && existing.length > 0 ? existing[0].elevation_z : 0;
  const newZ = maxZ + 1;
  const levelCount = await supabase
    .from("levels")
    .select("*", { count: "exact", head: true })
    .eq("project_id", projectId);
  const count = levelCount.count ?? 1;
  const newName = `Piano ${count}`;

  const { data, error } = await supabase
    .from("levels")
    .insert({
      project_id: projectId,
      name: newName,
      elevation_z: newZ,
      scale_ratio: null,
      plan_image_url: null,
    } as any)
    .select("id, project_id, name, elevation_z, scale_ratio, plan_image_url, created_at")
    .single();

  if (error) {
    console.error("Errore aggiunta livello:", error);
    return { error: "Impossibile aggiungere il piano." };
  }

  revalidatePath(`/projects/${projectId}/editor`);
  return { success: true, level: data };
}

// ============================================================
// ACTION: Rinomina un livello
// ============================================================

export async function renameLevel(
  levelId: string,
  projectId: string,
  newName: string
) {
  const { supabase, user } = await getAuthUser();
  if (!user) throw new Error("Non autenticato.");

  const trimmed = newName.trim();
  if (!trimmed) return { error: "Il nome non può essere vuoto." };

  const { error } = await supabase
    .from("levels")
    .update({ name: trimmed } as any)
    .eq("id", levelId);

  if (error) {
    console.error("Errore rinomina livello:", error);
    return { error: "Impossibile rinominare il piano." };
  }

  revalidatePath(`/projects/${projectId}/editor`);
  return { success: true };
}

// ============================================================
// ACTION: Elimina un livello (solo se ne rimane almeno 1)
// ============================================================

export async function deleteLevel(levelId: string, projectId: string) {
  const { supabase, user } = await getAuthUser();
  if (!user) throw new Error("Non autenticato.");

  // Verifica che ne rimanga almeno uno
  const { count } = await supabase
    .from("levels")
    .select("*", { count: "exact", head: true })
    .eq("project_id", projectId);

  if (!count || count <= 1) {
    return { error: "Non puoi eliminare l'unico piano del progetto." };
  }

  const { error } = await supabase.from("levels").delete().eq("id", levelId);

  if (error) {
    console.error("Errore eliminazione livello:", error);
    return { error: "Impossibile eliminare il piano." };
  }

  revalidatePath(`/projects/${projectId}/editor`);
  return { success: true };
}

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

  // Creazione del primo disegno base associato al progetto
  const { error: levelError } = await supabase.from("levels").insert({
    project_id: data.id,
    name: "Piano Terra (2D)",
    elevation_z: 0,
    scale_ratio: null,
    plan_image_url: null,
    drawing_type: "2d_wall",
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
    .select("id, project_id, name, elevation_z, scale_ratio, plan_image_url, drawing_type, created_at")
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

export async function addLevel(
  projectId: string,
  customName?: string,
  elevationZ?: number,
  drawingType: "2d_wall" | "3d_box" = "2d_wall",
  piano: string = "Generico"
) {
  const { supabase, user } = await getAuthUser();
  if (!user) throw new Error("Non autenticato.");

  let finalName = customName;
  let finalZ = elevationZ;

  if (finalName === undefined || finalZ === undefined) {
    const { data: existing } = await supabase
      .from("levels")
      .select("elevation_z, name")
      .eq("project_id", projectId)
      .order("elevation_z", { ascending: false })
      .limit(1);

    const maxZ = existing && existing.length > 0 ? existing[0].elevation_z : 0;
    if (finalZ === undefined) finalZ = maxZ + 1;

    if (finalName === undefined) {
      const levelCount = await supabase
        .from("levels")
        .select("*", { count: "exact", head: true })
        .eq("project_id", projectId);
      const count = levelCount.count ?? 1;
      finalName = drawingType === "2d_wall" ? `Parete 2D ${count}` : `Cavedio 3D ${count}`;
    }
  }

  const { data, error } = await supabase
    .from("levels")
    .insert({
      project_id: projectId,
      name: finalName,
      elevation_z: finalZ,
      scale_ratio: null,
      plan_image_url: null,
      drawing_type: drawingType,
      piano: piano.trim() || "Generico",
    } as any)
    .select("id, project_id, name, elevation_z, scale_ratio, plan_image_url, drawing_type, created_at, piano, completed")
    .single();

  if (error) {
    console.error("Errore aggiunta livello:", error);
    return { error: "Impossibile aggiungere il piano." };
  }

  revalidatePath(`/projects/${projectId}/editor`);
  revalidatePath(`/projects/${projectId}`);
  return { success: true, level: data };
}

// ============================================================
// ACTION: Rinomina un livello
// ============================================================

export async function updateLevelDetails(
  levelId: string,
  projectId: string,
  newName: string,
  elevationZ: number
) {
  const { supabase, user } = await getAuthUser();
  if (!user) throw new Error("Non autenticato.");

  const trimmed = newName.trim();
  if (!trimmed) return { error: "Il nome non può essere vuoto." };

  const { error } = await supabase
    .from("levels")
    .update({ name: trimmed, elevation_z: elevationZ } as any)
    .eq("id", levelId);

  if (error) {
    console.error("Errore aggiornamento livello:", error);
    return { error: "Impossibile aggiornare il piano." };
  }

  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/editor`);
  return { success: true };
}

// ============================================================
// ACTION: Aggiorna metadati di un livello (scala, immagine)
// ============================================================

export async function updateLevelMetadata(
  levelId: string,
  projectId: string,
  data: { scale_ratio?: number | null; plan_image_url?: string | null }
) {
  const { supabase, user } = await getAuthUser();
  if (!user) throw new Error("Non autenticato.");

  const { error } = await supabase
    .from("levels")
    .update(data as any)
    .eq("id", levelId)
    .eq("project_id", projectId);

  if (error) {
    console.error("Errore aggiornamento metadati livello:", error);
    return { error: "Impossibile salvare i dati del livello." };
  }

  revalidatePath(`/projects/${projectId}/editor`);
  return { success: true };
}

// ============================================================
// ACTION: Elimina un livello (solo se ne rimane almeno 1)
// =======================================================================================================================

export async function deleteLevel(levelId: string, projectId: string) {
  const { supabase, user } = await getAuthUser();
  if (!user) throw new Error("Non autenticato.");

  const { error } = await supabase.from("levels").delete().eq("id", levelId);

  if (error) {
    console.error("Errore eliminazione livello:", error);
    return { error: "Impossibile eliminare il piano." };
  }

  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/editor`);
  return { success: true };
}

// ============================================================
// ACTION: Salva le pareti 2D nel database elements_master
// ============================================================

export async function saveWalls(levelId: string, projectId: string, walls: any[]) {
  const { supabase, user } = await getAuthUser();
  if (!user) throw new Error("Non autenticato.");

  // 1. Elimina le pareti esistenti per questo livello
  const { error: deleteError } = await supabase
    .from("elements_master")
    .delete()
    .eq("level_id", levelId)
    .eq("type", "wall");

  if (deleteError) {
    console.error("Errore durante l'eliminazione delle pareti:", deleteError);
    return { error: "Impossibile salvare le pareti." };
  }

  if (walls.length === 0) {
    revalidatePath(`/projects/${projectId}/editor`);
    return { success: true };
  }

  // 2. Inserisci le nuove pareti
  const rows = walls.map((w) => {
    const dx = w.x2 - w.x1;
    const dy = w.y2 - w.y1;
    const total_length = Math.sqrt(dx * dx + dy * dy) * 10; // in mm (scala 1px = 10mm)

    return {
      level_id: levelId,
      type: "wall",
      total_length,
      thickness: w.thickness,
      geometry: { x1: w.x1, y1: w.y1, x2: w.x2, y2: w.y2 },
      structural_settings: { 
        pitch: w.pitch, 
        height: w.height,
        materialId: w.materialId ?? null,
        offsetSide: w.offsetSide ?? "left"
      },
    };
  });

  const { error: insertError } = await supabase
    .from("elements_master")
    .insert(rows);

  if (insertError) {
    console.error("Errore inserimento pareti:", insertError);
    return { error: "Errore durante il salvataggio." };
  }

  revalidatePath(`/projects/${projectId}/editor`);
  return { success: true };
}

// ============================================================
// QUERY: Carica le pareti 2D dal database
// ============================================================

export async function getWalls(levelId: string) {
  const { supabase, user } = await getAuthUser();
  if (!user) throw new Error("Non autenticato.");

  const { data, error } = await supabase
    .from("elements_master")
    .select("id, thickness, geometry, structural_settings")
    .eq("level_id", levelId)
    .eq("type", "wall");

  if (error) {
    console.error("Errore caricamento pareti:", error);
    return [];
  }

  return (data ?? []).map((row: any) => {
    const geom = row.geometry || {};
    const settings = row.structural_settings || {};
    return {
      id: row.id,
      x1: geom.x1 ?? 0,
      y1: geom.y1 ?? 0,
      x2: geom.x2 ?? 0,
      y2: geom.y2 ?? 0,
      thickness: row.thickness ?? 15,
      height: settings.height ?? 3000,
      pitch: settings.pitch ?? 600,
      materialId: settings.materialId ?? null,
      offsetSide: settings.offsetSide ?? "left"
    };
  });
}

// ============================================================
// ACTION: Salva un cavedio/scatola 3D nel database elements_master
// ============================================================

export async function save3DBox(
  levelId: string,
  projectId: string,
  boxData: { w: number; h: number; d: number; thickness: number }
) {
  const { supabase, user } = await getAuthUser();
  if (!user) throw new Error("Non autenticato.");

  // Elimina vecchi dati 3D per questo livello
  const { error: deleteError } = await supabase
    .from("elements_master")
    .delete()
    .eq("level_id", levelId)
    .eq("type", "duct");

  if (deleteError) {
    console.error("Errore durante l'eliminazione dei dati 3D:", deleteError);
    return { error: "Impossibile salvare i dati 3D." };
  }

  // Inserisci il nuovo cavedio 3D
  const { error: insertError } = await supabase.from("elements_master").insert({
    level_id: levelId,
    type: "duct",
    total_length: boxData.h, // Usiamo l'altezza come lunghezza totale
    thickness: boxData.thickness,
    geometry: { w: boxData.w, h: boxData.h, d: boxData.d },
    structural_settings: {},
  } as any);

  if (insertError) {
    console.error("Errore inserimento dati 3D:", insertError);
    return { error: "Errore durante il salvataggio." };
  }

  revalidatePath(`/projects/${projectId}/editor-3d`);
  return { success: true };
}

// ============================================================
// QUERY: Carica il cavedio/scatola 3D dal database
// ============================================================

export async function get3DBox(levelId: string) {
  const { supabase, user } = await getAuthUser();
  if (!user) throw new Error("Non autenticato.");

  const { data, error } = await supabase
    .from("elements_master")
    .select("id, thickness, geometry")
    .eq("level_id", levelId)
    .eq("type", "duct")
    .maybeSingle();

  if (error) {
    console.error("Errore caricamento dati 3D:", error);
    return null;
  }

  if (!data) return null;

  const geom = (data.geometry as any) || {};
  return {
    id: data.id,
    w: geom.w ?? 1000,
    h: geom.h ?? 2000,
    d: geom.d ?? 1000,
    thickness: data.thickness ?? 15,
  };
}

// ============================================================
// ACTION: Aggiorna lo stato di completamento di una nota/livello
// ============================================================

export async function toggleLevelCompleted(levelId: string, completed: boolean) {
  const { supabase, user } = await getAuthUser();
  if (!user) throw new Error("Non autenticato.");

  const { error } = await supabase
    .from("levels")
    .update({ completed } as any)
    .eq("id", levelId);

  if (error) {
    console.error("Errore aggiornamento completed livello:", error);
    return { error: "Impossibile aggiornare lo stato della nota." };
  }

  return { success: true };
}

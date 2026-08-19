"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { Project, ProjectMaterial, ProjectSketch, ProjectModel, SketchStroke } from "@/lib/types/database";
import { getValidAccessToken } from "@/app/actions/google";
import { getOrCreateProjectSketchFolderId, getOrCreateProjectModelFolderId, uploadFileToGoogleDrive, updateFileContent } from "@/lib/gdrive";

const DEFAULT_MODEL_CODE = `let box = Box(20, 20, 20);
FilletEdges(box, 3, Edges(box).max([0,0,1]).indices());`;

function revalidateProjects() {
  revalidatePath("/dashboard/projects", "layout");
}

export async function getProjects(): Promise<Project[]> {
  try {
    const supabase = (await createClient()) as any;
    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    return data || [];
  } catch (err: any) {
    console.error("Errore getProjects:", err.message);
    return [];
  }
}

export async function getProject(id: string): Promise<Project | null> {
  try {
    const supabase = (await createClient()) as any;
    const { data, error } = await supabase.from("projects").select("*").eq("id", id).single();
    if (error) throw new Error(error.message);
    return data;
  } catch (err: any) {
    console.error("Errore getProject:", err.message);
    return null;
  }
}

export async function createProject(formData: { name: string; description?: string | null }) {
  try {
    const supabase = (await createClient()) as any;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Non autenticato");

    const { data, error } = await supabase
      .from("projects")
      .insert({
        user_id: user.id,
        name: formData.name.trim(),
        description: formData.description || null,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);

    revalidateProjects();
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function updateProject(id: string, formData: { name?: string; description?: string | null }) {
  try {
    const supabase = (await createClient()) as any;
    const update: Record<string, any> = {};
    if (formData.name !== undefined) update.name = formData.name.trim();
    if (formData.description !== undefined) update.description = formData.description || null;

    const { data, error } = await supabase.from("projects").update(update).eq("id", id).select().single();
    if (error) throw new Error(error.message);

    revalidateProjects();
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function updateProjectStatus(id: string, status: "bozza" | "in_corso" | "finito") {
  try {
    const supabase = (await createClient()) as any;
    const { error } = await supabase.from("projects").update({ status }).eq("id", id);
    if (error) throw new Error(error.message);

    revalidateProjects();
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function updateProjectNotes(id: string, notesHtml: string) {
  try {
    const supabase = (await createClient()) as any;
    const { error } = await supabase.from("projects").update({ notes_html: notesHtml }).eq("id", id);
    if (error) throw new Error(error.message);

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function deleteProject(id: string) {
  try {
    const supabase = (await createClient()) as any;
    const { error } = await supabase.from("projects").delete().eq("id", id);
    if (error) throw new Error(error.message);

    revalidateProjects();
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ============================================
// Lista materiali
// ============================================

export async function getProjectMaterials(projectId: string): Promise<ProjectMaterial[]> {
  try {
    const supabase = (await createClient()) as any;
    const { data, error } = await supabase
      .from("project_materials")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: true });

    if (error) throw new Error(error.message);
    return data || [];
  } catch (err: any) {
    console.error("Errore getProjectMaterials:", err.message);
    return [];
  }
}

export async function createProjectMaterial(projectId: string, formData: { name: string }) {
  try {
    const supabase = (await createClient()) as any;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Non autenticato");

    const { data, error } = await supabase
      .from("project_materials")
      .insert({ project_id: projectId, user_id: user.id, name: formData.name.trim() || "Nuovo materiale" })
      .select()
      .single();

    if (error) throw new Error(error.message);

    revalidateProjects();
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

interface ProjectMaterialFields {
  name: string;
  quantity: number;
  unit_price: number | null;
  link: string | null;
  notes: string | null;
  purchased: boolean;
}

export async function updateProjectMaterial(id: string, formData: Partial<ProjectMaterialFields>) {
  try {
    const supabase = (await createClient()) as any;
    const update: Record<string, any> = {};
    if (formData.name !== undefined) update.name = formData.name.trim() || "Materiale";
    if (formData.quantity !== undefined) update.quantity = formData.quantity;
    if (formData.unit_price !== undefined) update.unit_price = formData.unit_price;
    if (formData.link !== undefined) update.link = formData.link || null;
    if (formData.notes !== undefined) update.notes = formData.notes || null;
    if (formData.purchased !== undefined) update.purchased = formData.purchased;

    const { error } = await supabase.from("project_materials").update(update).eq("id", id);
    if (error) throw new Error(error.message);

    revalidateProjects();
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function deleteProjectMaterial(id: string) {
  try {
    const supabase = (await createClient()) as any;
    const { error } = await supabase.from("project_materials").delete().eq("id", id);
    if (error) throw new Error(error.message);

    revalidateProjects();
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ============================================
// Disegni (vetrina)
// ============================================

export async function getProjectSketches(projectId: string): Promise<ProjectSketch[]> {
  try {
    const supabase = (await createClient()) as any;
    const { data, error } = await supabase
      .from("project_sketches")
      .select("*")
      .eq("project_id", projectId)
      .order("updated_at", { ascending: false });

    if (error) throw new Error(error.message);
    return data || [];
  } catch (err: any) {
    console.error("Errore getProjectSketches:", err.message);
    return [];
  }
}

export async function getProjectSketch(id: string): Promise<ProjectSketch | null> {
  try {
    const supabase = (await createClient()) as any;
    const { data, error } = await supabase.from("project_sketches").select("*").eq("id", id).single();
    if (error) throw new Error(error.message);
    return data;
  } catch (err: any) {
    console.error("Errore getProjectSketch:", err.message);
    return null;
  }
}

export async function createProjectSketch(projectId: string) {
  try {
    const supabase = (await createClient()) as any;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Non autenticato");

    const { data, error } = await supabase
      .from("project_sketches")
      .insert({ project_id: projectId, user_id: user.id })
      .select()
      .single();

    if (error) throw new Error(error.message);

    revalidateProjects();
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function renameProjectSketch(id: string, name: string) {
  try {
    const supabase = (await createClient()) as any;
    const { error } = await supabase
      .from("project_sketches")
      .update({ name: name.trim() || "Disegno senza titolo", updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw new Error(error.message);

    revalidateProjects();
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function updateProjectSketchStrokes(id: string, strokes: SketchStroke[]) {
  try {
    const supabase = (await createClient()) as any;
    const { error } = await supabase
      .from("project_sketches")
      .update({ strokes, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw new Error(error.message);

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// Esporta il disegno (PNG) su Google Drive, in Progetti/<Progetto>/Disegni.
// Se il disegno era gia' stato salvato su Drive in precedenza, sovrascrive
// lo stesso file invece di crearne uno nuovo ad ogni backup.
export async function saveProjectSketchToDrive(sketchId: string, formData: FormData) {
  try {
    const supabase = (await createClient()) as any;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Non autenticato");

    const file = formData.get("file") as File | null;
    if (!file) throw new Error("Immagine del disegno mancante");

    const { data: sketch, error: sketchError } = await supabase
      .from("project_sketches")
      .select("id, name, project_id, drive_file_id")
      .eq("id", sketchId)
      .single();
    if (sketchError || !sketch) throw new Error("Disegno non trovato");

    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("name")
      .eq("id", sketch.project_id)
      .single();
    if (projectError || !project) throw new Error("Progetto non trovato");

    const accessToken = await getValidAccessToken(supabase, user.id);
    const fileName = `${sketch.name || "Disegno"}.png`;

    const result = sketch.drive_file_id
      ? await updateFileContent({ fileId: sketch.drive_file_id, file, accessToken })
      : await uploadFileToGoogleDrive({
          file,
          fileName,
          accessToken,
          folderId: await getOrCreateProjectSketchFolderId({ projectName: project.name, accessToken }),
        });

    const driveLink = result.webViewLink || `https://drive.google.com/file/d/${result.id}/view`;

    const { error: updateError } = await supabase
      .from("project_sketches")
      .update({ drive_file_id: result.id, drive_link: driveLink, drive_synced_at: new Date().toISOString() })
      .eq("id", sketchId);
    if (updateError) throw new Error(updateError.message);

    revalidateProjects();
    return { success: true, data: { driveFileId: result.id as string, driveLink } };
  } catch (err: any) {
    return { success: false, error: err.message || "Errore durante il salvataggio su Google Drive" };
  }
}

export async function deleteProjectSketch(id: string) {
  try {
    const supabase = (await createClient()) as any;
    const { error } = await supabase.from("project_sketches").delete().eq("id", id);
    if (error) throw new Error(error.message);

    revalidateProjects();
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ============================================
// Modelli CAD 3D (motore cascade-core, solo da PC)
// ============================================

export async function getProjectModels(projectId: string): Promise<ProjectModel[]> {
  try {
    const supabase = (await createClient()) as any;
    const { data, error } = await supabase
      .from("project_models")
      .select("*")
      .eq("project_id", projectId)
      .order("updated_at", { ascending: false });

    if (error) throw new Error(error.message);
    return data || [];
  } catch (err: any) {
    console.error("Errore getProjectModels:", err.message);
    return [];
  }
}

export async function getProjectModel(id: string): Promise<ProjectModel | null> {
  try {
    const supabase = (await createClient()) as any;
    const { data, error } = await supabase.from("project_models").select("*").eq("id", id).single();
    if (error) throw new Error(error.message);
    return data;
  } catch (err: any) {
    console.error("Errore getProjectModel:", err.message);
    return null;
  }
}

export async function createProjectModel(projectId: string) {
  try {
    const supabase = (await createClient()) as any;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Non autenticato");

    const { data, error } = await supabase
      .from("project_models")
      .insert({ project_id: projectId, user_id: user.id, code: DEFAULT_MODEL_CODE })
      .select()
      .single();

    if (error) throw new Error(error.message);

    revalidateProjects();
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function renameProjectModel(id: string, name: string) {
  try {
    const supabase = (await createClient()) as any;
    const { error } = await supabase
      .from("project_models")
      .update({ name: name.trim() || "Modello senza titolo", updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw new Error(error.message);

    revalidateProjects();
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function updateProjectModel(id: string, formData: { code?: string; thumbnail?: string | null }) {
  try {
    const supabase = (await createClient()) as any;
    const update: Record<string, any> = { updated_at: new Date().toISOString() };
    if (formData.code !== undefined) update.code = formData.code;
    if (formData.thumbnail !== undefined) update.thumbnail = formData.thumbnail;

    const { error } = await supabase.from("project_models").update(update).eq("id", id);
    if (error) throw new Error(error.message);

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function deleteProjectModel(id: string) {
  try {
    const supabase = (await createClient()) as any;
    const { error } = await supabase.from("project_models").delete().eq("id", id);
    if (error) throw new Error(error.message);

    revalidateProjects();
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// Esporta il modello (file STEP, il formato di interscambio CAD nativo del
// motore) su Google Drive, in Progetti/<Progetto>/Modelli 3D. Come per i
// disegni, sovrascrive lo stesso file invece di accumulare copie.
export async function saveProjectModelToDrive(modelId: string, formData: FormData) {
  try {
    const supabase = (await createClient()) as any;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Non autenticato");

    const file = formData.get("file") as File | null;
    if (!file) throw new Error("File del modello mancante");

    const { data: model, error: modelError } = await supabase
      .from("project_models")
      .select("id, name, project_id, drive_file_id")
      .eq("id", modelId)
      .single();
    if (modelError || !model) throw new Error("Modello non trovato");

    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("name")
      .eq("id", model.project_id)
      .single();
    if (projectError || !project) throw new Error("Progetto non trovato");

    const accessToken = await getValidAccessToken(supabase, user.id);
    const fileName = `${model.name || "Modello"}.step`;

    const result = model.drive_file_id
      ? await updateFileContent({ fileId: model.drive_file_id, file, accessToken })
      : await uploadFileToGoogleDrive({
          file,
          fileName,
          accessToken,
          folderId: await getOrCreateProjectModelFolderId({ projectName: project.name, accessToken }),
        });

    const driveLink = result.webViewLink || `https://drive.google.com/file/d/${result.id}/view`;

    const { error: updateError } = await supabase
      .from("project_models")
      .update({ drive_file_id: result.id, drive_link: driveLink, drive_synced_at: new Date().toISOString() })
      .eq("id", modelId);
    if (updateError) throw new Error(updateError.message);

    revalidateProjects();
    return { success: true, data: { driveFileId: result.id as string, driveLink } };
  } catch (err: any) {
    return { success: false, error: err.message || "Errore durante il salvataggio su Google Drive" };
  }
}

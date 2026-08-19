"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { Project, ProjectMaterial, SketchStroke } from "@/lib/types/database";

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

export async function updateProjectSketch(id: string, sketchData: SketchStroke[]) {
  try {
    const supabase = (await createClient()) as any;
    const { error } = await supabase.from("projects").update({ sketch_data: sketchData }).eq("id", id);
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

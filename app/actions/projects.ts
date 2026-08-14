"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { Project, ProjectNote } from "@/lib/types/database";

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
// Note del progetto
// ============================================

export async function getProjectNotes(projectId: string): Promise<ProjectNote[]> {
  try {
    const supabase = (await createClient()) as any;
    const { data, error } = await supabase
      .from("project_notes")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    return data || [];
  } catch (err: any) {
    console.error("Errore getProjectNotes:", err.message);
    return [];
  }
}

export async function createProjectNote(projectId: string, content: string) {
  try {
    const supabase = (await createClient()) as any;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Non autenticato");

    const { data, error } = await supabase
      .from("project_notes")
      .insert({ project_id: projectId, user_id: user.id, content: content.trim() })
      .select()
      .single();

    if (error) throw new Error(error.message);

    revalidateProjects();
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function updateProjectNote(id: string, content: string) {
  try {
    const supabase = (await createClient()) as any;
    const { data, error } = await supabase
      .from("project_notes")
      .update({ content: content.trim() })
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);

    revalidateProjects();
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function deleteProjectNote(id: string) {
  try {
    const supabase = (await createClient()) as any;
    const { error } = await supabase.from("project_notes").delete().eq("id", id);
    if (error) throw new Error(error.message);

    revalidateProjects();
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

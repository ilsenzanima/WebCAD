"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function createProject(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Devi essere autenticato per creare un progetto.");
  }

  // Nome predefinito incrementale o fisso per MVP
  const projectName = "Nuovo Progetto Antincendio";

  const { data, error } = await supabase
    .from("projects")
    .insert({
      name: projectName,
      user_id: user.id,
      client_info: {},
    } as any)
    .select("id")
    .single();

  if (error || !data) {
    console.error("Errore creazione progetto:", error);
    throw new Error("Impossibile creare il progetto");
  }

  // Creazione del primo livello base associato al progetto
  const { error: levelError } = await supabase.from("levels").insert({
    project_id: data.id,
    elevation_z: 0,
    scale_ratio: null,
    plan_image_url: null,
  } as any);

  if (levelError) {
    console.error("Errore creazione level 0:", levelError);
  }

  // Redirigi subito all'editor
  revalidatePath("/dashboard");
  redirect(`/projects/${data.id}/editor`);
}

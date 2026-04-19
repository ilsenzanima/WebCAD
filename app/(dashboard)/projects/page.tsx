import { createClient } from "@/lib/supabase/server";
import ProjectsClientPage from "@/app/ui/dashboard/ProjectsClientPage";

/**
 * Pagina Progetti (Server Component).
 * Recupera i progetti dell'utente e li passa al Client Component
 * che gestisce la ricerca, il filtro e il modale di creazione.
 */
export default async function ProjectsPage() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("projects")
    .select("id, name, created_at, updated_at")
    .order("updated_at", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Errore recupero progetti:", error);
  }

  const projects = (data ?? []) as Array<{
    id: string;
    name: string;
    created_at: string;
    updated_at?: string;
  }>;

  return <ProjectsClientPage projects={projects} />;
}

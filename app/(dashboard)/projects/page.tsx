import ProjectsClientPage from "@/app/ui/dashboard/ProjectsClientPage";

/**
 * Pagina Progetti (Server Component).
 * Non esegue più query bloccanti sul server.
 * Restituisce direttamente il Client Component che caricherà
 * immediatamente i progetti dalla cache locale e li sincronizzerà
 * in background dal database Supabase.
 */
export default async function ProjectsPage() {
  return <ProjectsClientPage projects={[]} />;
}

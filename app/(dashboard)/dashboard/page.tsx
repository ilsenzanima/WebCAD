import { redirect } from "next/navigation";

/**
 * /dashboard → reindirizza automaticamente a /projects.
 * La pagina Progetti è ora il punto di ingresso principale dopo il login.
 */
export default function DashboardPage() {
  redirect("/projects");
}

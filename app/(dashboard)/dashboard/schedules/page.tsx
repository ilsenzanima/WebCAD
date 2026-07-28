import { redirect } from "next/navigation";

/**
 * Le Scadenze sono state unificate nella pagina Spese, Entrate e Scadenze
 * (tab "Scadenze"). Questo redirect mantiene validi i vecchi link/bookmark.
 */
export default function SchedulesRedirectPage() {
  redirect("/dashboard/expenses?tab=scadenze");
}

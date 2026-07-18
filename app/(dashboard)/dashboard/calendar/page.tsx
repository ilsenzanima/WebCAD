import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getExpenses } from "@/app/actions/expenses";
import { getSchedules } from "@/app/actions/schedules";
import CalendarClient from "@/app/ui/dashboard/CalendarClient";

export const metadata = {
  title: "Calendario Finanziario - Finanza Privata",
  description: "Visualizza spese e scadenze in modo integrato",
};

export default async function CalendarPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Caricamento in parallelo delle spese e delle scadenze
  const [expenses, schedules] = await Promise.all([
    getExpenses().catch(() => []),
    getSchedules().catch(() => []),
  ]);

  return <CalendarClient expenses={expenses} schedules={schedules} />;
}

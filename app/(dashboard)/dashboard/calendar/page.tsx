import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getExpenses } from "@/app/actions/expenses";
import { getSchedules } from "@/app/actions/schedules";
import { getSuppliers } from "@/app/actions/suppliers";
import { getExpenseDocuments } from "@/app/actions/documents";
import { getGoogleConnectionStatus } from "@/app/actions/google";
import CalendarClient from "@/app/ui/dashboard/CalendarClient";

export const metadata = {
  title: "Calendario Finanziario - Finanza Privata",
  description: "Visualizza spese e scadenze in modo integrato",
};

export default async function CalendarPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Caricamento in parallelo delle spese, scadenze, fornitori e documenti
  const [expenses, schedules, suppliers, documents, { connected: googleConnected }] = await Promise.all([
    getExpenses().catch(() => []),
    getSchedules().catch(() => []),
    getSuppliers().catch(() => []),
    getExpenseDocuments().catch(() => []),
    getGoogleConnectionStatus(),
  ]);

  return (
    <CalendarClient
      expenses={expenses}
      schedules={schedules}
      suppliers={suppliers}
      initialDocuments={documents}
      googleConnected={googleConnected}
    />
  );
}

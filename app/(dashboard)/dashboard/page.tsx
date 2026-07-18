import { getExpenses } from "@/app/actions/expenses";
import { getSchedules } from "@/app/actions/schedules";
import OverviewClient from "@/app/ui/dashboard/OverviewClient";

export const metadata = {
  title: "Panoramica - Finanza Privata",
  description: "Riepilogo spese e scadenze dei pagamenti",
};

export default async function DashboardPage() {
  // Caricamento dei dati in parallelo dal server
  const [expenses, schedules] = await Promise.all([
    getExpenses().catch(() => []),
    getSchedules().catch(() => []),
  ]);

  return <OverviewClient expenses={expenses} schedules={schedules} />;
}

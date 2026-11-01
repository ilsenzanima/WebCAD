import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getExpenses } from "@/app/actions/expenses";
import { getCategories } from "@/app/actions/categories";
import { getSuppliers } from "@/app/actions/suppliers";
import { getSchedules } from "@/app/actions/schedules";
import { getExpenseDocuments } from "@/app/actions/documents";
import { getGoogleConnectionStatus } from "@/app/actions/google";
import { getAccounts } from "@/app/actions/accounts";
import ExpensesClient from "@/app/ui/dashboard/ExpensesClient";

export const metadata = {
  title: "Spese, Entrate e Scadenze - Finanza Privata",
  description: "Registra spese, entrate e scadenze e allega le bollette",
};

export default async function ExpensesPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  // Le scadenze hanno di nuovo la loro pagina: i vecchi link ?tab=scadenze continuano a funzionare
  if ((await searchParams).tab === "scadenze") redirect("/dashboard/schedules");

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Caricamento in parallelo per la massima velocità
  const [expenses, categories, suppliers, schedules, documents, accounts, { connected: googleConnected }] = await Promise.all([
    getExpenses().catch(() => []),
    getCategories().catch(() => []),
    getSuppliers().catch(() => []),
    getSchedules().catch(() => []),
    getExpenseDocuments().catch(() => []),
    getAccounts().catch(() => []),
    getGoogleConnectionStatus(),
  ]);

  return (
    <ExpensesClient
      initialExpenses={expenses}
      categories={categories}
      suppliers={suppliers}
      initialSchedules={schedules}
      initialDocuments={documents}
      initialAccounts={accounts}
      googleConnected={googleConnected}
    />
  );
}

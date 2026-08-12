import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSuppliers } from "@/app/actions/suppliers";
import { getExpenses } from "@/app/actions/expenses";
import { getStores } from "@/app/actions/stores";
import SuppliersClient from "@/app/ui/dashboard/SuppliersClient";

export const metadata = {
  title: "Gestione Fornitori - Finanza Privata",
  description: "Visualizza e gestisci i fornitori, analizza le bollette ed accedi alle schede dettagliate.",
};

export default async function SuppliersPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [suppliers, expenses, stores] = await Promise.all([
    getSuppliers().catch(() => []),
    getExpenses().catch(() => []),
    getStores().catch(() => []),
  ]);

  return (
    <SuppliersClient
      initialSuppliers={suppliers}
      expenses={expenses}
      stores={stores}
    />
  );
}

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAccounts } from "@/app/actions/accounts";
import { getSuppliers } from "@/app/actions/suppliers";
import { getCategories } from "@/app/actions/categories";
import { getBankStatementImports } from "@/app/actions/bankReconciliation";
import ReconciliationClient from "@/app/ui/dashboard/ReconciliationClient";

export const metadata = {
  title: "Riscontro Bancario - Finanza Privata",
  description: "Confronta l'estratto conto con le spese registrate",
};

export default async function ReconciliationPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [accounts, suppliers, categories, imports] = await Promise.all([
    getAccounts().catch(() => []),
    getSuppliers().catch(() => []),
    getCategories().catch(() => []),
    getBankStatementImports().catch(() => []),
  ]);

  return (
    <ReconciliationClient
      initialAccounts={accounts}
      suppliers={suppliers}
      categories={categories}
      initialImports={imports}
    />
  );
}

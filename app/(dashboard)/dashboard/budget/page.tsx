import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getBudgets, getBudgetOverrides } from "@/app/actions/budget";
import { getCategories } from "@/app/actions/categories";
import { getExpenses } from "@/app/actions/expenses";
import { getSuppliers } from "@/app/actions/suppliers";
import BudgetClient from "@/app/ui/dashboard/BudgetClient";

export const metadata = {
  title: "Pianificazione Budget - Finanza Privata",
  description: "Pianifica le entrate e uscite mensili e analizza il potere di spesa",
};

export default async function BudgetPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Caricamento in parallelo delle risorse necessarie
  const [budgets, categories, expenses, overrides, suppliers] = await Promise.all([
    getBudgets().catch(() => []),
    getCategories().catch(() => []),
    getExpenses().catch(() => []),
    getBudgetOverrides().catch(() => []),
    getSuppliers().catch(() => []),
  ]);

  return (
    <BudgetClient
      initialBudgets={budgets}
      categories={categories}
      initialExpenses={expenses}
      initialOverrides={overrides}
      suppliers={suppliers}
    />
  );
}

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getExpenses } from "@/app/actions/expenses";
import { getCategories } from "@/app/actions/categories";
import { getSuppliers } from "@/app/actions/suppliers";
import ExpensesClient from "@/app/ui/dashboard/ExpensesClient";

export const metadata = {
  title: "Gestione Spese - Finanza Privata",
  description: "Traccia ed analizza le tue spese personali",
};

export default async function ExpensesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Caricamento in parallelo per la massima velocità
  const [expenses, categories, suppliers] = await Promise.all([
    getExpenses().catch(() => []),
    getCategories().catch(() => []),
    getSuppliers().catch(() => [])
  ]);

  return (
    <ExpensesClient 
      initialExpenses={expenses} 
      categories={categories} 
      suppliers={suppliers} 
    />
  );
}

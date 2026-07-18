import { getExpenses } from "@/app/actions/expenses";
import ExpensesClient from "@/app/ui/dashboard/ExpensesClient";

export const metadata = {
  title: "Spese - Finanza Privata",
  description: "Gestione delle spese personali",
};

export default async function ExpensesPage() {
  const expenses = await getExpenses().catch(() => []);

  return <ExpensesClient initialExpenses={expenses} />;
}

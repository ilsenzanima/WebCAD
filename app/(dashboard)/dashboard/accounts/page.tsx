import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAccounts } from "@/app/actions/accounts";
import { getExpenses } from "@/app/actions/expenses";
import AccountsClient from "@/app/ui/dashboard/AccountsClient";

export const metadata = {
  title: "Conti - Finanza Privata",
  description: "Traccia il saldo reale dei tuoi conti",
};

export default async function AccountsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [accounts, expenses] = await Promise.all([
    getAccounts().catch(() => []),
    getExpenses().catch(() => []),
  ]);

  return <AccountsClient initialAccounts={accounts} expenses={expenses} />;
}

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSchedules } from "@/app/actions/schedules";
import { getCategories } from "@/app/actions/categories";
import { getSuppliers } from "@/app/actions/suppliers";
import { getGoogleConnectionStatus } from "@/app/actions/google";
import SchedulesClient from "@/app/ui/dashboard/SchedulesClient";

export const metadata = {
  title: "Scadenze - Finanza Privata",
  description: "Pianifica le prossime uscite ed evita ritardi sulle bollette",
};

export default async function SchedulesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [schedules, categories, suppliers, { connected: googleConnected }] = await Promise.all([
    getSchedules().catch(() => []),
    getCategories().catch(() => []),
    getSuppliers().catch(() => []),
    getGoogleConnectionStatus(),
  ]);

  return (
    <SchedulesClient
      initialSchedules={schedules}
      categories={categories}
      suppliers={suppliers}
      googleConnected={googleConnected}
    />
  );
}

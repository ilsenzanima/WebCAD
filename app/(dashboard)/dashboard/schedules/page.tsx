import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSchedules } from "@/app/actions/schedules";
import { getCategories } from "@/app/actions/categories";
import { getSuppliers } from "@/app/actions/suppliers";
import SchedulesClient from "@/app/ui/dashboard/SchedulesClient";

export const metadata = {
  title: "Scadenziario Pagamenti - Finanza Privata",
  description: "Pianifica le uscite future",
};

export default async function SchedulesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [schedules, categories, suppliers] = await Promise.all([
    getSchedules().catch(() => []),
    getCategories().catch(() => []),
    getSuppliers().catch(() => [])
  ]);

  return (
    <SchedulesClient 
      initialSchedules={schedules} 
      categories={categories} 
      suppliers={suppliers} 
    />
  );
}

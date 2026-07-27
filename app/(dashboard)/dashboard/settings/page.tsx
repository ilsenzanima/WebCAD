import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCategories } from "@/app/actions/categories";
import SettingsClient from "@/app/ui/dashboard/SettingsClient";

export const metadata = {
  title: "Impostazioni - Finanza Privata",
  description: "Configura categorie di spesa e sicurezza account",
};

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const categories = await getCategories().catch(() => []);

  return <SettingsClient categories={categories} />;
}

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getCategories } from "@/app/actions/categories";
import { getSuppliers } from "@/app/actions/suppliers";
import SettingsClient from "@/app/ui/dashboard/SettingsClient";

export const metadata = {
  title: "Impostazioni - Finanza Privata",
  description: "Gestione del profilo, categorie e fornitori",
};

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [categories, suppliers] = await Promise.all([
    getCategories().catch(() => []),
    getSuppliers().catch(() => [])
  ]);

  const userData = {
    id: user.id,
    email: user.email,
    fullName: user.user_metadata?.full_name || user.email?.split("@")[0] || "Utente",
  };

  return (
    <SettingsClient 
      user={userData} 
      initialCategories={categories} 
      initialSuppliers={suppliers} 
    />
  );
}

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import SettingsClient from "@/app/ui/dashboard/SettingsClient";

export const metadata = {
  title: "Impostazioni - Finanza Privata",
  description: "Gestione del profilo e della sicurezza",
};

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const userData = {
    id: user.id,
    email: user.email,
    fullName: user.user_metadata?.full_name || user.email?.split("@")[0] || "Utente",
  };

  return <SettingsClient user={userData} />;
}

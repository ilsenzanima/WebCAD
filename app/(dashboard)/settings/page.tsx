import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getNoteTypes } from "@/app/actions/field-notes";
import { getUserTags } from "@/app/actions/settings";
import SettingsClient from "@/app/ui/projects/SettingsClient";

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [noteTypes, materialCategories, materialUnits] = await Promise.all([
    getNoteTypes(),
    getUserTags("material_category"),
    getUserTags("material_unit"),
  ]);

  const userData = {
    id: user.id,
    email: user.email,
    fullName: user.user_metadata?.full_name || user.email?.split("@")[0] || "Utente",
  };

  return (
    <SettingsClient
      user={userData}
      initialNoteTypes={noteTypes}
      initialMaterialCategories={materialCategories}
      initialMaterialUnits={materialUnits}
    />
  );
}

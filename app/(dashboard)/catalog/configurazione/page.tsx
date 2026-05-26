import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getNoteTypes } from "@/app/actions/field-notes";
import { getUserTags } from "@/app/actions/settings";
import UnifiedSettingsManager from "@/app/ui/projects/UnifiedSettingsManager";

export default async function UnifiedSettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [noteTypes, materialCategories, materialUnits] = await Promise.all([
    getNoteTypes(),
    getUserTags("material_category"),
    getUserTags("material_unit"),
  ]);

  return <UnifiedSettingsManager initialNoteTypes={noteTypes} initialMaterialCategories={materialCategories} initialMaterialUnits={materialUnits} />;
}

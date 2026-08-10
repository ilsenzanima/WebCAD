import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getCategories } from "@/app/actions/categories";
import { getGoogleConnectionStatus } from "@/app/actions/google";
import { DEFAULT_FONT_ID, isValidFontId } from "@/lib/fonts";
import SettingsClient from "@/app/ui/dashboard/SettingsClient";
import appVersion from "@/public/version.json";

export const metadata = {
  title: "Impostazioni - Finanza Privata",
  description: "Configura categorie di spesa e sicurezza account",
};

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [categories, { connected: googleConnected }] = await Promise.all([
    getCategories().catch(() => []),
    getGoogleConnectionStatus(),
  ]);

  const cookieStore = await cookies();
  const fontCookie = cookieStore.get("font-preference")?.value;
  const currentFontId = isValidFontId(fontCookie) ? fontCookie : DEFAULT_FONT_ID;

  return (
    <SettingsClient
      categories={categories}
      googleConnected={googleConnected}
      currentFontId={currentFontId}
      appVersion={appVersion}
    />
  );
}

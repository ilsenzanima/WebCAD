import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSuppliers } from "@/app/actions/suppliers";
import { getGoogleConnectionStatus, listScansioniDocuments } from "@/app/actions/google";
import { getGoogleDriveFolderUrl, GOOGLE_CONFIG } from "@/lib/gdrive";
import ScansioniClient from "@/app/ui/dashboard/ScansioniClient";

export const metadata = {
  title: "Smistamento Scansioni - Finanza Privata",
  description: "Assegna ai fornitori i documenti scansionati e organizzali per anno su Google Drive",
};

export default async function ScansioniPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { connected: googleConnected } = await getGoogleConnectionStatus();

  const [suppliers, scansioniRes] = await Promise.all([
    getSuppliers().catch(() => []),
    googleConnected ? listScansioniDocuments() : Promise.resolve({ success: true, data: [] }),
  ]);

  return (
    <ScansioniClient
      initialDocuments={scansioniRes.data || []}
      suppliers={suppliers}
      googleConnected={googleConnected}
      loadError={scansioniRes.success ? null : scansioniRes.error || null}
      scansioniFolderUrl={getGoogleDriveFolderUrl(GOOGLE_CONFIG.scansioniFolderId)}
    />
  );
}

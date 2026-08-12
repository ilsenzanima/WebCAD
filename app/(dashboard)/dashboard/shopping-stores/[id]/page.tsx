import { notFound } from "next/navigation";
import { getStore, getStoreSpendingSummary } from "@/app/actions/stores";
import { getMyRole } from "@/app/actions/family";
import StoreDetailClient from "@/app/ui/dashboard/StoreDetailClient";

export const metadata = {
  title: "Scheda negozio - Finanza Privata",
  description: "Dettaglio negozio, tessera fedeltà e totale spese collegate",
};

export default async function StoreDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [store, role] = await Promise.all([getStore(id), getMyRole()]);
  if (!store) notFound();

  const isAdmin = role === "admin";
  const spendingSummary = isAdmin ? await getStoreSpendingSummary(id) : null;

  return <StoreDetailClient store={store} isAdmin={isAdmin} spendingSummary={spendingSummary} />;
}

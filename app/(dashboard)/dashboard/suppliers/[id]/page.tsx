import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSupplierDetail } from "@/app/actions/suppliers";
import SupplierDetailClient from "@/app/ui/dashboard/SupplierDetailClient";

interface SupplierDetailPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: SupplierDetailPageProps) {
  const { id } = await params;
  const data = await getSupplierDetail(id);
  if (!data || !data.supplier) return { title: "Fornitore non trovato" };

  return {
    title: `${data.supplier.name} - Scheda Dettaglio Fornitore`,
    description: `Statistiche spese, frequenza bollette e storico per ${data.supplier.name}`,
  };
}

export default async function SupplierDetailPage({ params }: SupplierDetailPageProps) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const data = await getSupplierDetail(id);
  if (!data || !data.supplier) return notFound();

  return (
    <SupplierDetailClient
      supplier={data.supplier}
      expenses={data.expenses}
      schedules={data.schedules}
      documents={data.documents}
    />
  );
}

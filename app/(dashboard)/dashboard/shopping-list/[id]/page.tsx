import { notFound } from "next/navigation";
import { getShoppingList, getShoppingProducts } from "@/app/actions/shopping";
import { getMyRole } from "@/app/actions/family";
import { getStores } from "@/app/actions/stores";
import ShoppingListDetailClient from "@/app/ui/dashboard/ShoppingListDetailClient";

export const metadata = {
  title: "Lista della spesa - Finanza Privata",
  description: "Dettaglio della lista della spesa: articoli, negozio e totale",
};

export default async function ShoppingListDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [list, products, role, stores] = await Promise.all([
    getShoppingList(id),
    getShoppingProducts(),
    getMyRole(),
    getStores(),
  ]);

  if (!list) notFound();

  return <ShoppingListDetailClient initialList={list} initialProducts={products} stores={stores} isAdmin={role === "admin"} />;
}

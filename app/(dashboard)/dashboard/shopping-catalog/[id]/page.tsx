import { notFound } from "next/navigation";
import { getShoppingProduct, getProductBrands } from "@/app/actions/shopping";
import { getStores } from "@/app/actions/stores";
import ShoppingProductDetailClient from "@/app/ui/dashboard/ShoppingProductDetailClient";

export const metadata = {
  title: "Scheda prodotto - Finanza Privata",
  description: "Dettaglio prodotto della vetrina, marche e valutazioni",
};

export default async function ShoppingProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [product, brands, stores] = await Promise.all([
    getShoppingProduct(id),
    getProductBrands(id),
    getStores(),
  ]);

  if (!product) notFound();

  return <ShoppingProductDetailClient product={product} initialBrands={brands} stores={stores} />;
}

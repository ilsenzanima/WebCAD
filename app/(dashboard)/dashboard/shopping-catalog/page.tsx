import { getShoppingProducts } from "@/app/actions/shopping";
import ShoppingCatalogClient from "@/app/ui/dashboard/ShoppingCatalogClient";

export const metadata = {
  title: "Vetrina prodotti - Finanza Privata",
  description: "Catalogo dei prodotti riutilizzabili per la lista della spesa",
};

export default async function ShoppingCatalogPage() {
  const products = await getShoppingProducts();

  return <ShoppingCatalogClient initialProducts={products} />;
}

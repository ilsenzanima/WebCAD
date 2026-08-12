import { getShoppingProducts } from "@/app/actions/shopping";
import { getStores } from "@/app/actions/stores";
import ShoppingCatalogClient from "@/app/ui/dashboard/ShoppingCatalogClient";

export const metadata = {
  title: "Vetrina prodotti - Finanza Privata",
  description: "Catalogo dei prodotti riutilizzabili per la lista della spesa",
};

export default async function ShoppingCatalogPage() {
  const [products, stores] = await Promise.all([getShoppingProducts(), getStores()]);

  return <ShoppingCatalogClient initialProducts={products} stores={stores} />;
}

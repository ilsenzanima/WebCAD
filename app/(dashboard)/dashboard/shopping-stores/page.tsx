import { getStores } from "@/app/actions/stores";
import ShoppingStoresClient from "@/app/ui/dashboard/ShoppingStoresClient";

export const metadata = {
  title: "Negozi - Finanza Privata",
  description: "Negozi condivisi dalla famiglia per vetrina e lista della spesa",
};

export default async function ShoppingStoresPage() {
  const stores = await getStores();

  return <ShoppingStoresClient initialStores={stores} />;
}

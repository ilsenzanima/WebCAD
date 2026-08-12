import {
  getActiveShoppingList,
  getShoppingListHistory,
  getShoppingProducts,
} from "@/app/actions/shopping";
import { getMyRole } from "@/app/actions/family";
import { getStores } from "@/app/actions/stores";
import ShoppingListClient from "@/app/ui/dashboard/ShoppingListClient";

export const metadata = {
  title: "Lista della spesa - Finanza Privata",
  description: "Lista della spesa e vetrina prodotti condivise con la famiglia",
};

export default async function ShoppingListPage() {
  const [activeList, history, products, role, stores] = await Promise.all([
    getActiveShoppingList(),
    getShoppingListHistory(),
    getShoppingProducts(),
    getMyRole(),
    getStores(),
  ]);

  return (
    <ShoppingListClient
      initialActiveList={activeList}
      initialHistory={history}
      initialProducts={products}
      stores={stores}
      isAdmin={role === "admin"}
    />
  );
}

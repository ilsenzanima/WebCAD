import {
  getActiveShoppingList,
  getShoppingListHistory,
  getShoppingProducts,
} from "@/app/actions/shopping";
import { getMyRole } from "@/app/actions/family";
import ShoppingListClient from "@/app/ui/dashboard/ShoppingListClient";

export const metadata = {
  title: "Lista della spesa - Finanza Privata",
  description: "Lista della spesa e vetrina prodotti condivise con la famiglia",
};

export default async function ShoppingListPage() {
  const [activeList, history, products, role] = await Promise.all([
    getActiveShoppingList(),
    getShoppingListHistory(),
    getShoppingProducts(),
    getMyRole(),
  ]);

  return (
    <ShoppingListClient
      initialActiveList={activeList}
      initialHistory={history}
      initialProducts={products}
      isAdmin={role === "admin"}
    />
  );
}

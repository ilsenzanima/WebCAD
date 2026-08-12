import { getShoppingLists } from "@/app/actions/shopping";
import { getMyRole } from "@/app/actions/family";
import { getStores } from "@/app/actions/stores";
import ShoppingListsGalleryClient from "@/app/ui/dashboard/ShoppingListsGalleryClient";

export const metadata = {
  title: "Liste della spesa - Finanza Privata",
  description: "Liste della spesa condivise con la famiglia",
};

export default async function ShoppingListPage() {
  const [lists, role, stores] = await Promise.all([
    getShoppingLists(),
    getMyRole(),
    getStores(),
  ]);

  return <ShoppingListsGalleryClient initialLists={lists} stores={stores} isAdmin={role === "admin"} />;
}

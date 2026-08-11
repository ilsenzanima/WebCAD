"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { getMyRole } from "@/app/actions/family";
import { toLocalDateStr } from "@/lib/format";
import type { ShoppingProduct, ShoppingList, ShoppingListItem } from "@/lib/types/database";

const ITEM_SELECT = "*, shopping_products(*)";

function revalidateShoppingList() {
  revalidatePath("/dashboard/shopping-list");
  revalidatePath("/dashboard");
}

// ============================================
// Vetrina prodotti
// ============================================

export async function getShoppingProducts(): Promise<ShoppingProduct[]> {
  try {
    const supabase = (await createClient()) as any;
    const { data, error } = await supabase
      .from("shopping_products")
      .select("*")
      .order("category", { ascending: true })
      .order("name", { ascending: true });

    if (error) throw new Error(error.message);
    return data || [];
  } catch (err: any) {
    console.error("Errore getShoppingProducts:", err.message);
    return [];
  }
}

export async function createShoppingProduct(formData: {
  name: string;
  category?: string | null;
  default_store?: string | null;
  aisle?: string | null;
  default_unit?: string | null;
  shelf_life_days?: number | null;
}) {
  try {
    const supabase = (await createClient()) as any;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Non autenticato");

    const { data, error } = await supabase
      .from("shopping_products")
      .insert({
        name: formData.name.trim(),
        category: formData.category || null,
        default_store: formData.default_store || null,
        aisle: formData.aisle || null,
        default_unit: formData.default_unit || null,
        shelf_life_days: formData.shelf_life_days ?? null,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);

    revalidateShoppingList();
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function updateShoppingProduct(id: string, formData: {
  name: string;
  category?: string | null;
  default_store?: string | null;
  aisle?: string | null;
  default_unit?: string | null;
  shelf_life_days?: number | null;
}) {
  try {
    const supabase = (await createClient()) as any;
    const { data, error } = await supabase
      .from("shopping_products")
      .update({
        name: formData.name.trim(),
        category: formData.category || null,
        default_store: formData.default_store || null,
        aisle: formData.aisle || null,
        default_unit: formData.default_unit || null,
        shelf_life_days: formData.shelf_life_days ?? null,
      })
      .eq("id", id)
      .select()
      .single();

    if (error) throw new Error(error.message);

    revalidateShoppingList();
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function deleteShoppingProduct(id: string) {
  try {
    const supabase = (await createClient()) as any;
    const { error } = await supabase.from("shopping_products").delete().eq("id", id);
    if (error) throw new Error(error.message);

    revalidateShoppingList();
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ============================================
// Liste della spesa
// ============================================

export async function getActiveShoppingList(): Promise<(ShoppingList & { items: ShoppingListItem[] }) | null> {
  try {
    const supabase = (await createClient()) as any;
    const { data: list, error } = await supabase
      .from("shopping_lists")
      .select("*")
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!list) return null;

    const { data: items, error: itemsError } = await supabase
      .from("shopping_list_items")
      .select(ITEM_SELECT)
      .eq("shopping_list_id", list.id)
      .order("created_at", { ascending: true });

    if (itemsError) throw new Error(itemsError.message);

    return { ...list, items: items || [] };
  } catch (err: any) {
    console.error("Errore getActiveShoppingList:", err.message);
    return null;
  }
}

export async function getShoppingListHistory(): Promise<ShoppingList[]> {
  try {
    const supabase = (await createClient()) as any;
    const { data, error } = await supabase
      .from("shopping_lists")
      .select("*")
      .eq("status", "completed")
      .order("completed_at", { ascending: false })
      .limit(20);

    if (error) throw new Error(error.message);
    return data || [];
  } catch (err: any) {
    console.error("Errore getShoppingListHistory:", err.message);
    return [];
  }
}

export async function createShoppingList(name?: string) {
  try {
    const supabase = (await createClient()) as any;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Non autenticato");

    const { data, error } = await supabase
      .from("shopping_lists")
      .insert({ name: name?.trim() || "Lista della spesa", created_by: user.id })
      .select()
      .single();

    if (error) throw new Error(error.message);

    revalidateShoppingList();
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function updateShoppingListMeta(id: string, formData: {
  name?: string;
  shopping_date?: string | null;
  store?: string | null;
}) {
  try {
    const supabase = (await createClient()) as any;
    const update: Record<string, any> = {};
    if (formData.name !== undefined) update.name = formData.name.trim();
    if (formData.shopping_date !== undefined) update.shopping_date = formData.shopping_date || null;
    if (formData.store !== undefined) update.store = formData.store || null;

    const { error } = await supabase.from("shopping_lists").update(update).eq("id", id);
    if (error) throw new Error(error.message);

    revalidateShoppingList();
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function completeShoppingList(id: string, formData: { total_amount: number }) {
  try {
    const supabase = (await createClient()) as any;
    const { error } = await supabase
      .from("shopping_lists")
      .update({
        status: "completed",
        total_amount: formData.total_amount,
        completed_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) throw new Error(error.message);

    revalidateShoppingList();
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function deleteShoppingList(id: string) {
  try {
    const supabase = (await createClient()) as any;
    const { error } = await supabase.from("shopping_lists").delete().eq("id", id);
    if (error) throw new Error(error.message);

    revalidateShoppingList();
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// Solo un admin puo' collegare il totale di una spesa completata alle
// Finanze, che restano private e scoperte per user_id: la spesa viene
// registrata sotto l'utente admin che esegue l'azione.
export async function registerListExpense(listId: string) {
  try {
    const role = await getMyRole();
    if (role !== "admin") throw new Error("Solo un amministratore può registrare la spesa in Finanze");

    const supabase = (await createClient()) as any;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Non autenticato");

    const { data: list, error: listError } = await supabase
      .from("shopping_lists")
      .select("*")
      .eq("id", listId)
      .single();

    if (listError) throw new Error(listError.message);
    if (!list) throw new Error("Lista non trovata");
    if (list.expense_id) throw new Error("Questa lista è già collegata a una spesa");
    if (list.total_amount == null) throw new Error("Manca il totale della spesa");

    const { data: expense, error: expenseError } = await supabase
      .from("expenses")
      .insert({
        user_id: user.id,
        amount: list.total_amount,
        category: "🛒 Spesa",
        description: [list.name, list.store].filter(Boolean).join(" — "),
        date: list.shopping_date || list.completed_at?.slice(0, 10) || toLocalDateStr(),
      })
      .select()
      .single();

    if (expenseError) throw new Error(expenseError.message);

    const { error: linkError } = await supabase
      .from("shopping_lists")
      .update({ expense_id: expense.id })
      .eq("id", listId);

    if (linkError) throw new Error(linkError.message);

    revalidateShoppingList();
    revalidatePath("/dashboard/overview");
    revalidatePath("/dashboard/expenses");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ============================================
// Voci della lista
// ============================================

// Aggiunge un articolo per nome: se non esiste ancora in vetrina lo crea al
// volo (cosi' la vetrina si arricchisce automaticamente mentre si prepara
// la lista), altrimenti riusa il prodotto gia' presente.
export async function addShoppingListItemByName(shoppingListId: string, formData: {
  product_name: string;
  quantity?: number | null;
  unit?: string | null;
}) {
  try {
    const supabase = (await createClient()) as any;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Non autenticato");

    const trimmedName = formData.product_name.trim();
    if (!trimmedName) throw new Error("Inserisci il nome dell'articolo");

    let { data: product } = await supabase
      .from("shopping_products")
      .select("*")
      .ilike("name", trimmedName)
      .maybeSingle();

    if (!product) {
      const { data: newProduct, error: createError } = await supabase
        .from("shopping_products")
        .insert({ name: trimmedName, created_by: user.id })
        .select()
        .single();
      if (createError) throw new Error(createError.message);
      product = newProduct;
    }

    return await addShoppingListItemFromProduct(shoppingListId, product.id, formData);
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function addShoppingListItemFromProduct(shoppingListId: string, productId: string, formData?: {
  quantity?: number | null;
  unit?: string | null;
}) {
  try {
    const supabase = (await createClient()) as any;

    const { data, error } = await supabase
      .from("shopping_list_items")
      .insert({
        shopping_list_id: shoppingListId,
        product_id: productId,
        quantity: formData?.quantity ?? null,
        unit: formData?.unit ?? null,
      })
      .select(ITEM_SELECT)
      .single();

    if (error) throw new Error(error.message);

    revalidateShoppingList();
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function toggleShoppingListItemChecked(itemId: string, checked: boolean) {
  try {
    const supabase = (await createClient()) as any;

    if (!checked) {
      const { error } = await supabase
        .from("shopping_list_items")
        .update({ is_checked: false, checked_at: null, expiry_date: null })
        .eq("id", itemId);
      if (error) throw new Error(error.message);
      revalidateShoppingList();
      return { success: true };
    }

    const { data: item, error: itemError } = await supabase
      .from("shopping_list_items")
      .select("id, shopping_list_id, shopping_products(shelf_life_days)")
      .eq("id", itemId)
      .single();
    if (itemError) throw new Error(itemError.message);

    const { data: list, error: listError } = await supabase
      .from("shopping_lists")
      .select("shopping_date")
      .eq("id", item.shopping_list_id)
      .single();
    if (listError) throw new Error(listError.message);

    const shelfLifeDays = item.shopping_products?.shelf_life_days;
    let expiryDate: string | null = null;
    if (shelfLifeDays != null) {
      const baseDate = list.shopping_date ? new Date(`${list.shopping_date}T00:00:00`) : new Date();
      baseDate.setDate(baseDate.getDate() + shelfLifeDays);
      expiryDate = toLocalDateStr(baseDate);
    }

    const { error } = await supabase
      .from("shopping_list_items")
      .update({ is_checked: true, checked_at: new Date().toISOString(), expiry_date: expiryDate })
      .eq("id", itemId);
    if (error) throw new Error(error.message);

    revalidateShoppingList();
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function updateShoppingListItem(itemId: string, formData: {
  quantity?: number | null;
  unit?: string | null;
  price?: number | null;
  notes?: string | null;
}) {
  try {
    const supabase = (await createClient()) as any;
    const update: Record<string, any> = {};
    if (formData.quantity !== undefined) update.quantity = formData.quantity;
    if (formData.unit !== undefined) update.unit = formData.unit;
    if (formData.price !== undefined) update.price = formData.price;
    if (formData.notes !== undefined) update.notes = formData.notes;

    const { error } = await supabase.from("shopping_list_items").update(update).eq("id", itemId);
    if (error) throw new Error(error.message);

    revalidateShoppingList();
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function removeShoppingListItem(itemId: string) {
  try {
    const supabase = (await createClient()) as any;
    const { error } = await supabase.from("shopping_list_items").delete().eq("id", itemId);
    if (error) throw new Error(error.message);

    revalidateShoppingList();
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

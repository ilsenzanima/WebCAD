"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { getMyRole } from "@/app/actions/family";
import { toLocalDateStr } from "@/lib/format";
import type { ShoppingProduct, ShoppingList, ShoppingListItem, ShoppingProductBrand, NutrimentsSummary } from "@/lib/types/database";

const ITEM_SELECT = "*, shopping_products(*)";

function revalidateShoppingList() {
  revalidatePath("/dashboard/shopping-list");
  revalidatePath("/dashboard");
}

function revalidateCatalog() {
  revalidatePath("/dashboard/shopping-catalog", "layout");
  revalidatePath("/dashboard/shopping-list");
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
  store_id?: string | null;
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
        store_id: formData.store_id || null,
        aisle: formData.aisle || null,
        default_unit: formData.default_unit || null,
        shelf_life_days: formData.shelf_life_days ?? null,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);

    revalidateShoppingList();
    revalidateCatalog();
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function updateShoppingProduct(id: string, formData: {
  name: string;
  category?: string | null;
  store_id?: string | null;
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
        store_id: formData.store_id || null,
        aisle: formData.aisle || null,
        default_unit: formData.default_unit || null,
        shelf_life_days: formData.shelf_life_days ?? null,
      })
      .eq("id", id)
      .select()
      .single();

    if (error) throw new Error(error.message);

    revalidateShoppingList();
    revalidateCatalog();
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
    revalidateCatalog();
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function getShoppingProduct(id: string): Promise<ShoppingProduct | null> {
  try {
    const supabase = (await createClient()) as any;
    const { data, error } = await supabase.from("shopping_products").select("*").eq("id", id).maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  } catch (err: any) {
    console.error("Errore getShoppingProduct:", err.message);
    return null;
  }
}

// ============================================
// Marche di un prodotto
// ============================================

export async function getProductBrands(productId: string): Promise<ShoppingProductBrand[]> {
  try {
    const supabase = (await createClient()) as any;
    const { data, error } = await supabase
      .from("shopping_product_brands")
      .select("*")
      .eq("product_id", productId)
      .order("rating", { ascending: false, nullsFirst: false })
      .order("brand_name", { ascending: true });

    if (error) throw new Error(error.message);
    return data || [];
  } catch (err: any) {
    console.error("Errore getProductBrands:", err.message);
    return [];
  }
}

interface ProductBrandFields {
  brand_name: string;
  barcode?: string | null;
  rating?: number | null;
  nutri_score?: "A" | "B" | "C" | "D" | "E" | null;
  nova_group?: 1 | 2 | 3 | 4 | null;
  eco_score?: "A" | "B" | "C" | "D" | "E" | null;
  image_url?: string | null;
  ingredients_text?: string | null;
  allergens?: string | null;
  nutriments?: NutrimentsSummary | null;
  additives?: string | null;
  traces?: string | null;
  labels?: string | null;
  package_quantity?: string | null;
  off_categories?: string | null;
  image_packaging_url?: string | null;
  notes?: string | null;
}

export async function createProductBrand(productId: string, formData: ProductBrandFields) {
  try {
    const supabase = (await createClient()) as any;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Non autenticato");

    const { data, error } = await supabase
      .from("shopping_product_brands")
      .insert({
        product_id: productId,
        brand_name: formData.brand_name.trim(),
        barcode: formData.barcode || null,
        rating: formData.rating ?? null,
        nutri_score: formData.nutri_score || null,
        nova_group: formData.nova_group ?? null,
        eco_score: formData.eco_score || null,
        image_url: formData.image_url || null,
        ingredients_text: formData.ingredients_text || null,
        allergens: formData.allergens || null,
        nutriments: formData.nutriments || null,
        additives: formData.additives || null,
        traces: formData.traces || null,
        labels: formData.labels || null,
        package_quantity: formData.package_quantity || null,
        off_categories: formData.off_categories || null,
        image_packaging_url: formData.image_packaging_url || null,
        notes: formData.notes || null,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);

    revalidateCatalog();
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function updateProductBrand(id: string, formData: Partial<ProductBrandFields>) {
  try {
    const supabase = (await createClient()) as any;
    const update: Record<string, any> = {};
    if (formData.brand_name !== undefined) update.brand_name = formData.brand_name.trim();
    if (formData.barcode !== undefined) update.barcode = formData.barcode || null;
    if (formData.rating !== undefined) update.rating = formData.rating;
    if (formData.nutri_score !== undefined) update.nutri_score = formData.nutri_score;
    if (formData.nova_group !== undefined) update.nova_group = formData.nova_group;
    if (formData.eco_score !== undefined) update.eco_score = formData.eco_score;
    if (formData.image_url !== undefined) update.image_url = formData.image_url || null;
    if (formData.ingredients_text !== undefined) update.ingredients_text = formData.ingredients_text || null;
    if (formData.allergens !== undefined) update.allergens = formData.allergens || null;
    if (formData.nutriments !== undefined) update.nutriments = formData.nutriments || null;
    if (formData.additives !== undefined) update.additives = formData.additives || null;
    if (formData.traces !== undefined) update.traces = formData.traces || null;
    if (formData.labels !== undefined) update.labels = formData.labels || null;
    if (formData.package_quantity !== undefined) update.package_quantity = formData.package_quantity || null;
    if (formData.off_categories !== undefined) update.off_categories = formData.off_categories || null;
    if (formData.image_packaging_url !== undefined) update.image_packaging_url = formData.image_packaging_url || null;
    if (formData.notes !== undefined) update.notes = formData.notes || null;

    const { data, error } = await supabase
      .from("shopping_product_brands")
      .update(update)
      .eq("id", id)
      .select()
      .single();

    if (error) throw new Error(error.message);

    revalidateCatalog();
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function deleteProductBrand(id: string) {
  try {
    const supabase = (await createClient()) as any;
    const { error } = await supabase.from("shopping_product_brands").delete().eq("id", id);
    if (error) throw new Error(error.message);

    revalidateCatalog();
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// Ricerca rapida per codice a barre: usata nella vetrina per saltare
// direttamente alla scheda del prodotto corrispondente.
export async function findProductBrandByBarcode(barcode: string): Promise<{ product_id: string; brand_name: string } | null> {
  try {
    const trimmed = barcode.trim();
    if (!trimmed) return null;

    const supabase = (await createClient()) as any;
    const { data, error } = await supabase
      .from("shopping_product_brands")
      .select("product_id, brand_name")
      .eq("barcode", trimmed)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data;
  } catch (err: any) {
    console.error("Errore findProductBrandByBarcode:", err.message);
    return null;
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
  store_id?: string | null;
}) {
  try {
    const supabase = (await createClient()) as any;
    const update: Record<string, any> = {};
    if (formData.name !== undefined) update.name = formData.name.trim();
    if (formData.shopping_date !== undefined) update.shopping_date = formData.shopping_date || null;
    if (formData.store_id !== undefined) update.store_id = formData.store_id || null;

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
      .select("*, stores(name)")
      .eq("id", listId)
      .single();

    if (listError) throw new Error(listError.message);
    if (!list) throw new Error("Lista non trovata");
    if (list.expense_id) throw new Error("Questa lista è già collegata a una spesa");
    if (list.total_amount == null) throw new Error("Manca il totale della spesa");

    // Se il negozio della lista e' collegato a un Fornitore (privato,
    // Finanze), la spesa registrata viene gia' assegnata a quel fornitore:
    // niente da ricopiare a mano e il totale per negozio in Finanze resta
    // aggiornato in automatico.
    let supplierId: string | null = null;
    if (list.store_id) {
      const { data: linkedSupplier } = await supabase
        .from("suppliers")
        .select("id")
        .eq("store_id", list.store_id)
        .eq("user_id", user.id)
        .maybeSingle();
      supplierId = linkedSupplier?.id || null;
    }

    const { data: expense, error: expenseError } = await supabase
      .from("expenses")
      .insert({
        user_id: user.id,
        amount: list.total_amount,
        category: "🛒 Spesa",
        description: [list.name, list.stores?.name].filter(Boolean).join(" — "),
        date: list.shopping_date || list.completed_at?.slice(0, 10) || toLocalDateStr(),
        supplier_id: supplierId,
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

// ============================================
// Open Food/Beauty/Products Facts (dati pubblici, gratuiti, senza chiave)
// ============================================

export interface OpenFactsResult {
  source: string;
  product_name: string | null;
  brand_name: string | null;
  nutri_score: "A" | "B" | "C" | "D" | "E" | null;
  nova_group: 1 | 2 | 3 | 4 | null;
  eco_score: "A" | "B" | "C" | "D" | "E" | null;
  image_url: string | null;
  image_packaging_url: string | null;
  ingredients_text: string | null;
  allergens: string | null;
  traces: string | null;
  labels: string | null;
  additives: string | null;
  package_quantity: string | null;
  off_categories: string | null;
  nutriments: NutrimentsSummary | null;
}

// Stesso software (Product Opener) e stessa API dietro domini diversi per
// tipo di prodotto: proviamo prima quello alimentare (il piu' popolato),
// poi cosmesi/igiene, poi il contenitore generico per tutto il resto
// (es. detersivi), fermandoci al primo che conosce il codice a barre.
const OPEN_FACTS_SOURCES = [
  { domain: "world.openfoodfacts.org", label: "Open Food Facts" },
  { domain: "world.openbeautyfacts.org", label: "Open Beauty Facts" },
  { domain: "world.openproductsfacts.org", label: "Open Products Facts" },
];

const GRADE_LETTERS = ["A", "B", "C", "D", "E"];

function normalizeGrade(value: unknown): "A" | "B" | "C" | "D" | "E" | null {
  if (typeof value !== "string") return null;
  const upper = value.toUpperCase();
  return (GRADE_LETTERS.includes(upper) ? upper : null) as "A" | "B" | "C" | "D" | "E" | null;
}

// Le liste (allergeni, tracce, etichette) arrivano come "en:milk,en:gluten":
// ripulisce il prefisso di lingua e le riunisce in un testo leggibile.
function cleanTagList(value: unknown): string | null {
  if (typeof value !== "string" || !value) return null;
  return value.split(",").map((tag) => tag.trim().replace(/^\w{2}:/, "")).filter(Boolean).join(", ");
}

// Gli additivi arrivano come tag ["en:e322","en:e500"]: li trasforma in "E322, E500".
function cleanAdditives(value: unknown): string | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  return value
    .map((tag) => String(tag).replace(/^\w{2}:/, "").toUpperCase())
    .filter(Boolean)
    .join(", ");
}

// I valori nutrizionali di Open Facts usano chiavi eterogenee (es.
// "saturated-fat_100g"): estrae solo quelli comparabili che mostriamo.
function extractNutriments(raw: unknown, servingSize: string | null): NutrimentsSummary | null {
  if (!raw || typeof raw !== "object") return null;
  const dict = raw as Record<string, unknown>;
  const num = (key: string): number | null => (typeof dict[key] === "number" ? (dict[key] as number) : null);

  const summary: NutrimentsSummary = {
    serving_size: servingSize,
    energy_kcal_100g: num("energy-kcal_100g"),
    fat_100g: num("fat_100g"),
    saturated_fat_100g: num("saturated-fat_100g"),
    carbohydrates_100g: num("carbohydrates_100g"),
    sugars_100g: num("sugars_100g"),
    fiber_100g: num("fiber_100g"),
    proteins_100g: num("proteins_100g"),
    salt_100g: num("salt_100g"),
    energy_kcal_serving: num("energy-kcal_serving"),
    fat_serving: num("fat_serving"),
    saturated_fat_serving: num("saturated-fat_serving"),
    carbohydrates_serving: num("carbohydrates_serving"),
    sugars_serving: num("sugars_serving"),
    fiber_serving: num("fiber_serving"),
    proteins_serving: num("proteins_serving"),
    salt_serving: num("salt_serving"),
  };

  const hasAnyValue = Object.entries(summary).some(([key, val]) => key !== "serving_size" && val != null);
  return hasAnyValue ? summary : null;
}

// Interroga i database pubblici Open Food/Beauty/Products Facts per
// pre-compilare marca, Nutri-Score, NOVA, Eco-Score, foto, ingredienti,
// allergeni, tracce, etichette, additivi, formato confezione e valori
// nutrizionali a partire dal codice a barre, cosi' non vanno ricopiati a
// mano quando il prodotto e' gia' censito.
export async function lookupProductInfo(barcode: string): Promise<OpenFactsResult | null> {
  const trimmed = barcode.trim();
  if (!trimmed) return null;

  const fields = [
    "product_name", "brands", "nutriscore_grade", "nova_group", "ecoscore_grade",
    "image_front_small_url", "image_packaging_small_url", "ingredients_text",
    "allergens", "traces", "labels", "additives_tags", "quantity", "categories",
    "nutriments", "serving_size",
  ].join(",");

  for (const src of OPEN_FACTS_SOURCES) {
    try {
      const res = await fetch(
        `https://${src.domain}/api/v2/product/${encodeURIComponent(trimmed)}.json?fields=${fields}`,
        { headers: { "User-Agent": "WebCAD-FamilyApp/1.0 (gestionale famiglia privato)" } }
      );
      if (!res.ok) continue;

      const json: any = await res.json();
      if (!json || json.status !== 1 || !json.product) continue;

      const p = json.product;
      const novaGroup = typeof p.nova_group === "number" ? p.nova_group : null;
      const servingSize = typeof p.serving_size === "string" && p.serving_size ? p.serving_size : null;

      return {
        source: src.label,
        product_name: p.product_name || null,
        brand_name: typeof p.brands === "string" && p.brands ? p.brands.split(",")[0].trim() : null,
        nutri_score: normalizeGrade(p.nutriscore_grade),
        nova_group: (novaGroup && [1, 2, 3, 4].includes(novaGroup) ? novaGroup : null) as OpenFactsResult["nova_group"],
        eco_score: normalizeGrade(p.ecoscore_grade),
        image_url: p.image_front_small_url || null,
        image_packaging_url: p.image_packaging_small_url || null,
        ingredients_text: p.ingredients_text || null,
        allergens: cleanTagList(p.allergens),
        traces: cleanTagList(p.traces),
        labels: cleanTagList(p.labels),
        additives: cleanAdditives(p.additives_tags),
        package_quantity: p.quantity || null,
        off_categories: typeof p.categories === "string" && p.categories ? p.categories : null,
        nutriments: extractNutriments(p.nutriments, servingSize),
      };
    } catch (err: any) {
      console.error(`Errore lookupProductInfo (${src.label}):`, err.message);
      // prova il prossimo database della lista
    }
  }

  return null;
}

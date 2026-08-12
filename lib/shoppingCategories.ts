export const GROCERY_CATEGORIES = [
  "Frutta e Verdura", "Latticini e Uova", "Carne e Pesce", "Panetteria",
  "Dispensa", "Surgelati", "Bevande", "Snack e Dolci", "Igiene Casa",
  "Igiene Persona", "Altro",
];

// Categorie per cui ha senso tracciare una scadenza stimata dall'acquisto
// (prodotti freschi/deperibili). Per le altre il campo "dura gg" non viene
// mostrato: non avrebbe senso per un detersivo o una bibita.
export const PERISHABLE_CATEGORIES = ["Frutta e Verdura", "Latticini e Uova", "Carne e Pesce", "Panetteria"];

// Prova a indovinare la categoria della vetrina a partire dalle categorie
// (in inglese, tipo "Beverages, Sodas, Colas") restituite da Open Food/
// Beauty/Products Facts in fase di scansione. E' solo un punto di partenza:
// resta sempre modificabile prima di salvare.
const CATEGORY_GUESS_RULES: { keywords: string[]; category: string }[] = [
  { keywords: ["frozen", "surgelat"], category: "Surgelati" },
  { keywords: ["bread", "bakery", "viennoiserie", "pastr"], category: "Panetteria" },
  { keywords: ["dairy", "milk", "cheese", "yogurt", "yoghurt", "cream", "butter", "egg"], category: "Latticini e Uova" },
  { keywords: ["meat", "poultry", "chicken", "beef", "pork", "fish", "seafood", "salmon", "tuna", "charcuterie"], category: "Carne e Pesce" },
  { keywords: ["fruit", "vegetable", "produce", "legume"], category: "Frutta e Verdura" },
  { keywords: ["beverage", "soda", "juice", "water", "soft drink", "cola", "drink"], category: "Bevande" },
  { keywords: ["snack", "candy", "chocolate", "sweet", "confectionery", "dessert", "biscuit", "cookie", "chips", "crisps"], category: "Snack e Dolci" },
  { keywords: ["clean", "detergent", "household", "laundry"], category: "Igiene Casa" },
  { keywords: ["cosmetic", "beauty", "hygiene", "personal care", "shampoo", "soap", "toothpaste"], category: "Igiene Persona" },
];

export function guessCategoryFromOffCategories(offCategories: string | null): string {
  if (!offCategories) return "";
  const lower = offCategories.toLowerCase();
  for (const rule of CATEGORY_GUESS_RULES) {
    if (rule.keywords.some((k) => lower.includes(k))) return rule.category;
  }
  return "";
}

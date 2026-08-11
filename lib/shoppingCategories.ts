export const GROCERY_CATEGORIES = [
  "Frutta e Verdura", "Latticini e Uova", "Carne e Pesce", "Panetteria",
  "Dispensa", "Surgelati", "Bevande", "Snack e Dolci", "Igiene Casa",
  "Igiene Persona", "Altro",
];

// Categorie per cui ha senso tracciare una scadenza stimata dall'acquisto
// (prodotti freschi/deperibili). Per le altre il campo "dura gg" non viene
// mostrato: non avrebbe senso per un detersivo o una bibita.
export const PERISHABLE_CATEGORIES = ["Frutta e Verdura", "Latticini e Uova", "Carne e Pesce", "Panetteria"];

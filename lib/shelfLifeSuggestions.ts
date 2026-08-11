/**
 * Stime generiche (in giorni, da frigorifero/dispensa a temperatura
 * ambiente a seconda del prodotto) di quanto dura tipicamente un alimento
 * fresco dall'acquisto, ispirate a indicazioni di conservazione comuni
 * (es. USDA FoodKeeper). Non sono un dato scaricato in tempo reale ne'
 * specifico per marca/lotto: sono solo un suggerimento di partenza,
 * sempre modificabile a mano in base alla propria esperienza.
 */
const SHELF_LIFE_KEYWORDS: { keywords: string[]; days: number }[] = [
  { keywords: ["mela", "mele", "pera", "pere"], days: 21 },
  { keywords: ["banana"], days: 5 },
  { keywords: ["insalata", "lattuga", "spinaci", "rucola"], days: 5 },
  { keywords: ["pomodoro", "pomodori"], days: 7 },
  { keywords: ["zucchina", "zucchine", "melanzana", "melanzane", "peperone", "peperoni"], days: 7 },
  { keywords: ["carota", "carote"], days: 21 },
  { keywords: ["patata", "patate"], days: 30 },
  { keywords: ["limone", "limoni", "arancia", "arance"], days: 14 },
  { keywords: ["fragola", "fragole", "lampone", "mirtillo", "mirtilli"], days: 3 },
  { keywords: ["uva"], days: 7 },
  { keywords: ["latte"], days: 7 },
  { keywords: ["yogurt"], days: 10 },
  { keywords: ["uovo", "uova"], days: 21 },
  { keywords: ["burro"], days: 30 },
  { keywords: ["panna"], days: 5 },
  { keywords: ["mozzarella", "formaggio fresco", "ricotta", "stracchino"], days: 5 },
  { keywords: ["formaggio stagionato", "parmigiano", "grana"], days: 30 },
  { keywords: ["pollo", "tacchino"], days: 2 },
  { keywords: ["manzo", "maiale", "carne macinata", "trita", "salsiccia"], days: 2 },
  { keywords: ["pesce", "salmone", "branzino", "orata"], days: 2 },
  { keywords: ["prosciutto cotto", "affettato", "affettati", "salumi"], days: 5 },
  { keywords: ["pane"], days: 4 },
  { keywords: ["focaccia", "piadina"], days: 4 },
];

/** Cerca una stima in base al nome del prodotto (match parziale, case-insensitive). */
export function suggestShelfLifeDays(productName: string): number | null {
  const name = productName.trim().toLowerCase();
  if (!name) return null;

  for (const entry of SHELF_LIFE_KEYWORDS) {
    if (entry.keywords.some((k) => name.includes(k))) return entry.days;
  }
  return null;
}

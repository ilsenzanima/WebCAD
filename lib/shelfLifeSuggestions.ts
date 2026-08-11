/**
 * Stime (in giorni dall'acquisto/conservazione in frigorifero) di quanto
 * dura tipicamente un alimento fresco, tratte dal dataset ufficiale
 * USDA FoodKeeper (FoodSafety.gov / FSIS, "FMA-Data", v128).
 *
 * Per ogni voce il valore riportato e' il punto medio dell'intervallo
 * Refrigerate/DOP_Refrigerate (giorni-dall'acquisto) indicato dal dataset,
 * arrotondato all'intero piu' vicino. Dove il dataset non copre un
 * prodotto (es. "pane fresco" da panetteria, non confezionato) resta una
 * stima generica basata su prassi comune.
 *
 * Non e' un dato scaricato in tempo reale ne' specifico per marca/lotto:
 * e' solo un suggerimento di partenza, sempre modificabile a mano.
 */
const SHELF_LIFE_KEYWORDS: { keywords: string[]; days: number }[] = [
  // --- Frutta (Produce/Fresh Fruits) ---
  { keywords: ["mela", "mele"], days: 35 },
  { keywords: ["albicocca", "albicocche"], days: 4 },
  { keywords: ["avocado"], days: 4 },
  { keywords: ["banana", "banane"], days: 3 },
  { keywords: ["ciliegia", "ciliegie"], days: 3 },
  { keywords: ["mirtillo", "mirtilli"], days: 10 },
  { keywords: ["mirtillo rosso", "cranberry", "cranberries"], days: 60 },
  { keywords: ["limone", "limoni", "lime", "arancia", "arance", "pompelmo", "mandarino", "mandarini", "clementina", "clementine"], days: 15 },
  { keywords: ["cocco", "cocchi"], days: 18 },
  { keywords: ["dattero", "datteri"], days: 180 },
  { keywords: ["uva"], days: 7 },
  { keywords: ["guava"], days: 3 },
  { keywords: ["kiwi"], days: 5 },
  { keywords: ["anguria", "cocomero"], days: 4 },
  { keywords: ["melone"], days: 12 },
  { keywords: ["papaya", "mango", "frutto della passione"], days: 7 },
  { keywords: ["pesca", "pesche", "nettarina", "nettarine", "susina", "susine", "prugna", "prugne", "pera", "pere"], days: 4 },
  { keywords: ["ananas"], days: 6 },
  { keywords: ["platano", "platani"], days: 4 },
  { keywords: ["melagrana", "melograno"], days: 60 },
  { keywords: ["fragola", "fragole"], days: 3 },
  { keywords: ["lampone", "lamponi"], days: 3 },
  { keywords: ["carambola", "frutto stella"], days: 10 },
  { keywords: ["fico d'india", "fichi d'india"], days: 10 },
  { keywords: ["frutto del drago", "pitaya"], days: 17 },

  // --- Verdura (Produce/Fresh Vegetables) ---
  { keywords: ["carciofo", "carciofi"], days: 10 },
  { keywords: ["asparago", "asparagi"], days: 4 },
  { keywords: ["fagiolino", "fagiolini", "pisello", "piselli", "fava", "fave"], days: 4 },
  { keywords: ["barbabietola", "barbabietole"], days: 10 },
  { keywords: ["bok choy", "cavolo cinese"], days: 3 },
  { keywords: ["broccolo", "broccoli"], days: 4 },
  { keywords: ["cavoletto di bruxelles", "cavoletti di bruxelles"], days: 4 },
  { keywords: ["cavolo cappuccio", "cavolo verza", "cavolo"], days: 10 },
  { keywords: ["cavolo rapa", "kohlrabi"], days: 7 },
  { keywords: ["cavolo riccio", "kale"], days: 4 },
  { keywords: ["carota", "carote"], days: 18 },
  { keywords: ["cavolfiore"], days: 4 },
  { keywords: ["sedano"], days: 10 },
  { keywords: ["mais", "pannocchia", "pannocchie"], days: 2 },
  { keywords: ["cetriolo", "cetrioli"], days: 5 },
  { keywords: ["melanzana", "melanzane"], days: 5 },
  { keywords: ["aglio"], days: 10 },
  { keywords: ["zenzero"], days: 17 },
  { keywords: ["erbe aromatiche", "prezzemolo", "basilico"], days: 8 },
  { keywords: ["porro", "porri"], days: 10 },
  { keywords: ["lattuga", "insalata", "rucola"], days: 7 },
  { keywords: ["spinaci"], days: 5 },
  { keywords: ["insalata in busta", "insalata mista", "insalata lavata"], days: 4 },
  { keywords: ["fungo", "funghi", "champignon"], days: 5 },
  { keywords: ["okra", "gombo"], days: 3 },
  { keywords: ["cipolla", "cipolle"], days: 60 },
  { keywords: ["cipollotto", "cipollotti"], days: 7 },
  { keywords: ["peperone", "peperoni"], days: 9 },
  { keywords: ["patata", "patate"], days: 10 },
  { keywords: ["patata dolce", "patate dolci", "patata americana"], days: 18 },
  { keywords: ["zucca"], days: 100 },
  { keywords: ["ravanello", "ravanelli"], days: 12 },
  { keywords: ["rabarbaro"], days: 5 },
  { keywords: ["zucchina", "zucchine"], days: 5 },
  { keywords: ["tamarindo"], days: 180 },
  { keywords: ["pomodoro", "pomodori"], days: 7 },
  { keywords: ["rapa", "rape"], days: 14 },
  { keywords: ["yuca", "cassava"], days: 3 },
  { keywords: ["jicama"], days: 18 },
  { keywords: ["kimchi"], days: 270 },

  // --- Latticini e Uova (Dairy Products & Eggs) ---
  { keywords: ["burro"], days: 45 },
  { keywords: ["latticello"], days: 10 },
  { keywords: ["parmigiano grattugiato", "grana grattugiato"], days: 360 },
  { keywords: ["formaggio stagionato", "parmigiano", "grana"], days: 180 },
  { keywords: ["formaggio a fette", "sottilette"], days: 24 },
  { keywords: ["formaggio morbido", "brie", "caprino"], days: 10 },
  { keywords: ["formaggio grattugiato"], days: 30 },
  { keywords: ["mozzarella", "formaggio fresco", "stracchino"], days: 5 },
  { keywords: ["fiocchi di latte", "cottage"], days: 14 },
  { keywords: ["philadelphia", "formaggio spalmabile", "ricotta"], days: 14 },
  { keywords: ["panna fresca", "panna liquida"], days: 7 },
  { keywords: ["panna da montare", "panna montata"], days: 10 },
  { keywords: ["latte"], days: 7 },
  { keywords: ["uovo", "uova"], days: 28 },
  { keywords: ["uova sode"], days: 7 },
  { keywords: ["kefir"], days: 7 },
  { keywords: ["margarina"], days: 180 },
  { keywords: ["yogurt"], days: 10 },

  // --- Carne (Meat) ---
  { keywords: ["manzo", "vitello", "agnello", "capra", "selvaggina", "cervo"], days: 4 },
  { keywords: ["manzo macinato", "carne macinata", "trita", "carne trita"], days: 2 },
  { keywords: ["maiale", "lonza", "braciola", "braciole", "costine"], days: 4 },
  { keywords: ["maiale macinato"], days: 2 },
  { keywords: ["frattaglie", "fegato"], days: 2 },
  { keywords: ["pancetta"], days: 7 },
  { keywords: ["prosciutto cotto"], days: 7 },
  { keywords: ["prosciutto affettato", "affettato", "affettati"], days: 4 },
  { keywords: ["wurstel"], days: 14 },
  { keywords: ["salsiccia fresca", "salsiccia"], days: 2 },
  { keywords: ["salsiccia cotta", "salsiccia affumicata"], days: 7 },
  { keywords: ["salame", "salamino", "salumi"], days: 17 },

  // --- Pollame (Poultry) ---
  { keywords: ["pollo intero"], days: 2 },
  { keywords: ["tacchino intero"], days: 2 },
  { keywords: ["pollo macinato", "tacchino macinato"], days: 2 },
  { keywords: ["petto di pollo", "petto di tacchino", "cosce di pollo", "sovracosce", "pollo", "tacchino"], days: 2 },
  { keywords: ["anatra"], days: 2 },
  { keywords: ["oca"], days: 2 },
  { keywords: ["quaglia", "quaglie"], days: 2 },
  { keywords: ["pollo arrosto", "pollo rosolato", "pollo rosticceria"], days: 4 },

  // --- Pesce e Molluschi (Seafood) ---
  { keywords: ["merluzzo", "platessa", "sogliola", "nasello"], days: 2 },
  { keywords: ["salmone", "tonno", "sgombro", "pesce spada"], days: 2 },
  { keywords: ["pesce cotto"], days: 4 },
  { keywords: ["capasanta", "capesante"], days: 2 },
  { keywords: ["gambero", "gamberi", "gamberetto", "gamberetti"], days: 2 },
  { keywords: ["calamaro", "calamari"], days: 2 },
  { keywords: ["cozza", "cozze", "vongola", "vongole", "ostrica", "ostriche"], days: 6 },
  { keywords: ["granchio"], days: 3 },
  { keywords: ["aragosta"], days: 1 },
  { keywords: ["salmone affumicato", "pesce affumicato"], days: 25 },
  { keywords: ["pesce"], days: 2 },

  // --- Panetteria (Bakery) --- (nessuna voce diretta per pane fresco non confezionato: prassi comune)
  { keywords: ["pane confezionato", "pancarrè", "pan carre"], days: 16 },
  { keywords: ["pane"], days: 4 },
  { keywords: ["focaccia", "piadina"], days: 4 },
  { keywords: ["torta", "ciambellone"], days: 5 },
  { keywords: ["biscotti morbidi"], days: 75 },
  { keywords: ["biscotti"], days: 150 },
  { keywords: ["ciambella", "ciambelle", "donut", "krapfen"], days: 2 },
  { keywords: ["pasticcino", "pasticcini", "danese", "danesi"], days: 8 },
  { keywords: ["bagel"], days: 2 },
  { keywords: ["muffin"], days: 5 },
  { keywords: ["crostata"], days: 2 },
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

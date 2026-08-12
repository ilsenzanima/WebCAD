"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ShoppingProduct } from "@/lib/types/database";
import {
  createShoppingProduct, deleteShoppingProduct, findProductBrandByBarcode,
  createProductBrand, lookupProductInfo, type OpenFactsResult,
} from "@/app/actions/shopping";
import { GROCERY_CATEGORIES, PERISHABLE_CATEGORIES, guessCategoryFromOffCategories } from "@/lib/shoppingCategories";
import { GROCERY_UNITS } from "@/lib/shoppingUnits";
import { suggestShelfLifeDays } from "@/lib/shelfLifeSuggestions";
import { DeleteIcon, ArrowRightIcon } from "./icons";
import BarcodeScannerModal from "./BarcodeScannerModal";
import { isValidBarcodeChecksum } from "@/lib/barcodeChecksum";

interface ShoppingCatalogClientProps {
  initialProducts: ShoppingProduct[];
}

export default function ShoppingCatalogClient({ initialProducts }: ShoppingCatalogClientProps) {
  const [products, setProducts] = useState<ShoppingProduct[]>(initialProducts);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const [showProductModal, setShowProductModal] = useState(false);
  const [prodName, setProdName] = useState("");
  const [prodCategory, setProdCategory] = useState("");
  const [prodStore, setProdStore] = useState("");
  const [prodAisle, setProdAisle] = useState("");
  const [prodUnit, setProdUnit] = useState("");
  const [prodShelfLife, setProdShelfLife] = useState("");

  const [barcodeQuery, setBarcodeQuery] = useState("");
  const [searchingBarcode, setSearchingBarcode] = useState(false);
  const [showScanner, setShowScanner] = useState(false);

  // Codice non ancora in vetrina ma trovato su Open Food/Beauty/Products
  // Facts: proponiamo di creare prodotto + marca in un colpo solo.
  const [scanCreateData, setScanCreateData] = useState<OpenFactsResult | null>(null);
  const [scanBarcode, setScanBarcode] = useState("");
  const [scanProductName, setScanProductName] = useState("");
  const [scanCategory, setScanCategory] = useState("");
  const [scanBrandName, setScanBrandName] = useState("");

  const resetScanCreateForm = () => {
    setScanCreateData(null); setScanBarcode(""); setScanProductName(""); setScanCategory(""); setScanBrandName("");
  };

  const resetProductForm = () => {
    setProdName(""); setProdCategory(""); setProdStore(""); setProdAisle(""); setProdUnit(""); setProdShelfLife("");
    setShowProductModal(false);
  };

  const handleProductSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prodName.trim()) { alert("Inserisci il nome del prodotto"); return; }

    startTransition(async () => {
      const res = await createShoppingProduct({
        name: prodName.trim(),
        category: prodCategory || null,
        default_store: prodStore || null,
        aisle: prodAisle || null,
        default_unit: prodUnit || null,
        shelf_life_days: prodShelfLife ? Number(prodShelfLife) : null,
      });
      if (!res.success || !res.data) { alert(res.error); return; }
      setProducts((prev) => [...prev, res.data as ShoppingProduct]);
      resetProductForm();
    });
  };

  const handleDeleteProduct = (id: string) => {
    if (!confirm("Rimuovere questo prodotto (e le sue marche) dalla vetrina?")) return;
    startTransition(async () => {
      const res = await deleteShoppingProduct(id);
      if (!res.success) { alert(res.error); return; }
      setProducts((prev) => prev.filter((p) => p.id !== id));
    });
  };

  const runBarcodeSearch = (code: string) => {
    const trimmed = code.trim();
    if (!trimmed) return;
    setSearchingBarcode(true);
    startTransition(async () => {
      const result = await findProductBrandByBarcode(trimmed);
      if (result) {
        setSearchingBarcode(false);
        router.push(`/dashboard/shopping-catalog/${result.product_id}`);
        return;
      }
      // Non e' ancora in vetrina: proviamo a recuperarlo da Open Food/Beauty/Products Facts
      // cosi' non va cercato e ricopiato tutto a mano.
      const offResult = await lookupProductInfo(trimmed);
      setSearchingBarcode(false);
      if (!offResult) { alert("Nessun prodotto trovato con questo codice a barre."); return; }
      setScanBarcode(trimmed);
      setScanCreateData(offResult);
      setScanProductName(offResult.product_name || "");
      setScanCategory(guessCategoryFromOffCategories(offResult.off_categories));
      setScanBrandName(offResult.brand_name || "");
    });
  };

  const handleScanCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!scanProductName.trim() || !scanBrandName.trim() || !scanCreateData) { alert("Nome prodotto e marca sono obbligatori"); return; }

    startTransition(async () => {
      const productRes = await createShoppingProduct({
        name: scanProductName.trim(),
        category: scanCategory || null,
        default_store: null,
        aisle: null,
        default_unit: null,
        shelf_life_days: null,
      });
      if (!productRes.success || !productRes.data) { alert(productRes.error); return; }
      const newProduct = productRes.data as ShoppingProduct;

      const brandRes = await createProductBrand(newProduct.id, {
        brand_name: scanBrandName.trim(),
        barcode: scanBarcode,
        image_url: scanCreateData.image_url,
        image_packaging_url: scanCreateData.image_packaging_url,
        nutri_score: scanCreateData.nutri_score,
        nova_group: scanCreateData.nova_group,
        eco_score: scanCreateData.eco_score,
        ingredients_text: scanCreateData.ingredients_text,
        allergens: scanCreateData.allergens,
        traces: scanCreateData.traces,
        labels: scanCreateData.labels,
        additives: scanCreateData.additives,
        package_quantity: scanCreateData.package_quantity,
        off_categories: scanCreateData.off_categories,
        nutriments: scanCreateData.nutriments,
      });
      if (!brandRes.success) { alert(brandRes.error); return; }

      setProducts((prev) => [...prev, newProduct]);
      resetScanCreateForm();
      router.push(`/dashboard/shopping-catalog/${newProduct.id}`);
    });
  };

  const handleBarcodeSearch = (e: React.FormEvent) => {
    e.preventDefault();
    runBarcodeSearch(barcodeQuery);
  };

  const handleScanDetected = (code: string) => {
    setShowScanner(false);
    setBarcodeQuery(code);
    runBarcodeSearch(code);
  };

  const productsByCategory = products.reduce<Record<string, ShoppingProduct[]>>((acc, p) => {
    const cat = p.category || "Senza categoria";
    (acc[cat] ||= []).push(p);
    return acc;
  }, {});

  const isPerishable = PERISHABLE_CATEGORIES.includes(prodCategory);
  const shelfLifeSuggestion = isPerishable ? suggestShelfLifeDays(prodName) : null;

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="animate-fade-in flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
            🗂️ Vetrina prodotti
          </h1>
          <p className="text-sm text-slate-400 mt-1">Ogni prodotto ha una scheda con le marche e la loro valutazione.</p>
        </div>

        <div className="flex flex-col items-end gap-1">
          <form onSubmit={handleBarcodeSearch} className="flex gap-2">
            <input value={barcodeQuery} onChange={(e) => setBarcodeQuery(e.target.value)} placeholder="Cerca per codice a barre"
              className="px-3 py-2.5 rounded-xl text-xs text-white border border-zinc-800 bg-zinc-950/80 w-48"
              style={barcodeQuery.trim() && !isValidBarcodeChecksum(barcodeQuery.trim()) ? { borderColor: "rgba(245,158,11,0.5)" } : undefined} />
            <button type="button" onClick={() => setShowScanner(true)}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-zinc-800 hover:bg-zinc-700 transition-all" title="Scansiona con la fotocamera">
              📷
            </button>
            <button type="submit" disabled={searchingBarcode}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-zinc-800 hover:bg-zinc-700 transition-all">
              🔍
            </button>
          </form>
          {barcodeQuery.trim() && !isValidBarcodeChecksum(barcodeQuery.trim()) && (
            <p className="text-[9px] font-semibold text-amber-400">⚠️ Codice non valido: controlla le cifre</p>
          )}
        </div>
      </div>

      {showScanner && <BarcodeScannerModal onDetected={handleScanDetected} onClose={() => setShowScanner(false)} />}

      {/* Elenco Prodotti a piena larghezza */}
      <div className="rounded-2xl p-6 border shadow-2xl backdrop-blur-xl animate-fade-in"
        style={{ background: "linear-gradient(135deg, hsla(240, 10%, 12%, 0.5), hsla(240, 10%, 10%, 0.8))", borderColor: "hsla(240, 5%, 18%, 0.7)" }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-extrabold text-white">Prodotti in vetrina</h3>
          <button
            type="button"
            onClick={() => setShowProductModal(true)}
            className="px-4 py-2.5 rounded-xl text-xs font-extrabold text-white transition-all shadow-lg active:scale-98 flex items-center gap-2"
            style={{ background: "linear-gradient(135deg, hsl(245 70% 60%), hsl(255 60% 50%))" }}
          >
            <span>＋</span> Nuovo prodotto
          </button>
        </div>
        <div className="space-y-5">
          {Object.entries(productsByCategory).map(([category, items]) => (
            <div key={category}>
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-2">{category}</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {items.map((p) => (
                  <div key={p.id} className="relative group">
                    <Link
                      href={`/dashboard/shopping-catalog/${p.id}`}
                      className="p-3 rounded-xl border border-zinc-800/80 bg-zinc-950/40 flex items-center justify-between hover:border-zinc-600 transition-all"
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-white truncate">{p.name}</div>
                        <div className="text-[10px] text-zinc-500 truncate">
                          {[p.default_store, p.aisle, p.shelf_life_days ? `dura ${p.shelf_life_days}g` : null].filter(Boolean).join(" · ") || "Apri la scheda →"}
                        </div>
                      </div>
                      <ArrowRightIcon size={12} className="text-zinc-600 flex-shrink-0 ml-2" />
                    </Link>
                    <button
                      onClick={(e) => { e.preventDefault(); handleDeleteProduct(p.id); }}
                      className="absolute top-2 right-7 p-1 rounded text-slate-500 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity bg-zinc-950/80"
                      title="Rimuovi prodotto"
                    >
                      <DeleteIcon size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {products.length === 0 && <p className="text-[11px] text-zinc-500">Nessun prodotto ancora in vetrina.</p>}
        </div>
      </div>

      {/* Modale Nuovo Prodotto */}
      {showProductModal && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4 animate-fade-in overflow-y-auto"
          onClick={resetProductForm}
        >
          <div
            className="relative w-full max-w-lg my-8 rounded-2xl p-6 border shadow-2xl backdrop-blur-xl animate-fade-in max-h-[90vh] overflow-y-auto"
            style={{ background: "linear-gradient(135deg, hsla(245, 60%, 15%, 0.1), hsla(240, 10%, 10%, 0.97))", borderColor: "hsla(245, 60%, 50%, 0.15)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={resetProductForm}
              className="absolute top-4 right-4 text-zinc-400 hover:text-white text-lg leading-none z-20"
              aria-label="Chiudi"
            >
              ✕
            </button>

            <h2 className="text-base font-extrabold text-white mb-4">Nuovo prodotto</h2>

            <form onSubmit={handleProductSubmit} className="space-y-3">
              <input value={prodName} onChange={(e) => setProdName(e.target.value)} placeholder="Nome (es. Mele)" required
                className="w-full px-4 py-3 rounded-xl text-xs text-white border border-zinc-800 bg-zinc-950/80" />
              <select value={prodCategory} onChange={(e) => setProdCategory(e.target.value)}
                className="w-full px-4 py-3 rounded-xl text-xs text-white border border-zinc-800 bg-zinc-950/80">
                <option value="">Categoria...</option>
                {GROCERY_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <input value={prodStore} onChange={(e) => setProdStore(e.target.value)} placeholder="Negozio abituale (opzionale)"
                className="w-full px-4 py-3 rounded-xl text-xs text-white border border-zinc-800 bg-zinc-950/80" />
              <input value={prodAisle} onChange={(e) => setProdAisle(e.target.value)} placeholder="Corsia (opzionale)"
                className="w-full px-4 py-3 rounded-xl text-xs text-white border border-zinc-800 bg-zinc-950/80" />
              <select value={prodUnit} onChange={(e) => setProdUnit(e.target.value)}
                className="w-full px-4 py-3 rounded-xl text-xs text-white border border-zinc-800 bg-zinc-950/80">
                <option value="">Unità (opzionale)</option>
                {GROCERY_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>

              {isPerishable && (
                <div className="space-y-1.5 animate-fade-in">
                  <input type="number" value={prodShelfLife} onChange={(e) => setProdShelfLife(e.target.value)} placeholder="Dura gg (giorni dall'acquisto)"
                    className="w-full px-4 py-3 rounded-xl text-xs text-white border border-zinc-800 bg-zinc-950/80" />
                  {shelfLifeSuggestion && !prodShelfLife && (
                    <button type="button" onClick={() => setProdShelfLife(shelfLifeSuggestion.toString())}
                      className="text-[10px] font-bold text-indigo-300 hover:text-indigo-200 transition-all">
                      💡 Suggerimento USDA FoodKeeper: {shelfLifeSuggestion} giorni — usa questo valore
                    </button>
                  )}
                  <p className="text-[9px] text-zinc-500">Solo per le categorie deperibili (Frutta e Verdura, Latticini e Uova, Carne e Pesce, Panetteria). Il suggerimento si basa sul dataset USDA FoodKeeper: modificalo pure in base alla tua esperienza.</p>
                </div>
              )}

              <p className="text-[9px] text-zinc-500">Marche, valutazioni, allergeni e codici a barre si aggiungono aprendo la scheda del prodotto.</p>
              <button type="submit" disabled={isPending} className="w-full py-3 rounded-xl text-xs font-extrabold text-white bg-indigo-600 hover:bg-indigo-500 transition-all">
                Crea prodotto
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modale: codice scansionato non in vetrina, trovato su Open Facts */}
      {scanCreateData && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4 animate-fade-in overflow-y-auto"
          onClick={resetScanCreateForm}
        >
          <div
            className="relative w-full max-w-lg my-8 rounded-2xl p-6 border shadow-2xl backdrop-blur-xl animate-fade-in max-h-[90vh] overflow-y-auto"
            style={{ background: "linear-gradient(135deg, hsla(245, 60%, 15%, 0.1), hsla(240, 10%, 10%, 0.97))", borderColor: "hsla(245, 60%, 50%, 0.15)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <button type="button" onClick={resetScanCreateForm}
              className="absolute top-4 right-4 text-zinc-400 hover:text-white text-lg leading-none z-20" aria-label="Chiudi">
              ✕
            </button>

            <h2 className="text-base font-extrabold text-white mb-1">Prodotto trovato su {scanCreateData.source}</h2>
            <p className="text-[10px] text-zinc-500 mb-4 font-mono">{scanBarcode}</p>

            <div className="flex items-center gap-3 mb-4">
              {scanCreateData.image_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={scanCreateData.image_url} alt="" className="w-14 h-14 object-cover rounded-lg border border-zinc-800 flex-shrink-0" />
              )}
              <div className="flex flex-wrap gap-1">
                {scanCreateData.nutri_score && <span className="px-2 py-0.5 rounded text-[9px] font-extrabold bg-zinc-800 text-white">Nutri-Score {scanCreateData.nutri_score}</span>}
                {scanCreateData.eco_score && <span className="px-2 py-0.5 rounded text-[9px] font-extrabold bg-zinc-800 text-white">Eco-Score {scanCreateData.eco_score}</span>}
                {scanCreateData.allergens && <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-amber-500/10 text-amber-300 border border-amber-500/20">⚠️ {scanCreateData.allergens}</span>}
              </div>
            </div>

            <form onSubmit={handleScanCreateSubmit} className="space-y-3">
              <input value={scanProductName} onChange={(e) => setScanProductName(e.target.value)} placeholder="Nome prodotto generico (es. Bibita gassata)" required
                className="w-full px-4 py-3 rounded-xl text-xs text-white border border-zinc-800 bg-zinc-950/80" />
              <select value={scanCategory} onChange={(e) => setScanCategory(e.target.value)}
                className="w-full px-4 py-3 rounded-xl text-xs text-white border border-zinc-800 bg-zinc-950/80">
                <option value="">Categoria...</option>
                {GROCERY_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <input value={scanBrandName} onChange={(e) => setScanBrandName(e.target.value)} placeholder="Marca (es. Coca-Cola)" required
                className="w-full px-4 py-3 rounded-xl text-xs text-white border border-zinc-800 bg-zinc-950/80" />
              <p className="text-[9px] text-zinc-500">Categoria e nome sono precompilati da Open Facts: correggili pure prima di salvare. Ingredienti, allergeni, valori nutrizionali e foto vengono salvati automaticamente sulla marca.</p>
              <button type="submit" disabled={isPending} className="w-full py-3 rounded-xl text-xs font-extrabold text-white bg-indigo-600 hover:bg-indigo-500 transition-all">
                Crea prodotto e marca
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

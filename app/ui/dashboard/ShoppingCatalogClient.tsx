"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ShoppingProduct } from "@/lib/types/database";
import { createShoppingProduct, deleteShoppingProduct, findProductBrandByBarcode } from "@/app/actions/shopping";
import { GROCERY_CATEGORIES, PERISHABLE_CATEGORIES } from "@/lib/shoppingCategories";
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
    if (!code.trim()) return;
    setSearchingBarcode(true);
    startTransition(async () => {
      const result = await findProductBrandByBarcode(code.trim());
      setSearchingBarcode(false);
      if (!result) { alert("Nessun prodotto trovato con questo codice a barre."); return; }
      router.push(`/dashboard/shopping-catalog/${result.product_id}`);
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
              <input value={prodUnit} onChange={(e) => setProdUnit(e.target.value)} placeholder="Unità (es. kg)"
                className="w-full px-4 py-3 rounded-xl text-xs text-white border border-zinc-800 bg-zinc-950/80" />

              {isPerishable && (
                <div className="space-y-1.5 animate-fade-in">
                  <input type="number" value={prodShelfLife} onChange={(e) => setProdShelfLife(e.target.value)} placeholder="Dura gg (giorni dall'acquisto)"
                    className="w-full px-4 py-3 rounded-xl text-xs text-white border border-zinc-800 bg-zinc-950/80" />
                  {shelfLifeSuggestion && !prodShelfLife && (
                    <button type="button" onClick={() => setProdShelfLife(shelfLifeSuggestion.toString())}
                      className="text-[10px] font-bold text-indigo-300 hover:text-indigo-200 transition-all">
                      💡 Suggerimento generico: {shelfLifeSuggestion} giorni — usa questo valore
                    </button>
                  )}
                  <p className="text-[9px] text-zinc-500">Solo per le categorie deperibili (Frutta e Verdura, Latticini e Uova, Carne e Pesce, Panetteria). Il suggerimento è generico: modificalo pure in base alla tua esperienza.</p>
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
    </div>
  );
}

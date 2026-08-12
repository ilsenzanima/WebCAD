"use client";

import { useState, useTransition } from "react";
import type { ShoppingProduct, ShoppingProductBrand, Store, ShoppingListItem } from "@/lib/types/database";
import {
  createShoppingProduct,
  createProductBrand,
  addShoppingListItemFromProduct,
  lookupProductInfo,
  type OpenFactsResult,
} from "@/app/actions/shopping";
import { GROCERY_CATEGORIES, PERISHABLE_CATEGORIES } from "@/lib/shoppingCategories";
import { GROCERY_UNITS } from "@/lib/shoppingUnits";
import { suggestShelfLifeDays } from "@/lib/shelfLifeSuggestions";
import BarcodeScannerModal from "./BarcodeScannerModal";
import { isValidBarcodeChecksum } from "@/lib/barcodeChecksum";

interface NewProductModalProps {
  products: ShoppingProduct[];
  stores: Store[];
  // Se impostato, oltre a creare/collegare la marca il prodotto viene
  // anche aggiunto a questa lista (usato dal pulsante "Aggiungi a vetrina"
  // nella scheda lista, che serve mentre si sta facendo la spesa).
  listId?: string;
  onProductCreated: (product: ShoppingProduct) => void;
  onItemAdded?: (item: ShoppingListItem) => void;
  onClose: () => void;
}

export default function NewProductModal({ products, stores, listId, onProductCreated, onItemAdded, onClose }: NewProductModalProps) {
  const [isPending, startTransition] = useTransition();
  const [activeTab, setActiveTab] = useState<"new" | "existing">("new");

  // Tab "Nuovo prodotto"
  const [prodName, setProdName] = useState("");
  const [prodCategory, setProdCategory] = useState("");
  const [prodStoreId, setProdStoreId] = useState("");
  const [prodAisle, setProdAisle] = useState("");
  const [prodUnit, setProdUnit] = useState("");
  const [prodShelfLife, setProdShelfLife] = useState("");
  const [prodOffList, setProdOffList] = useState(false);

  // Tab "Aggiungi marca a un prodotto esistente"
  const [existingSearch, setExistingSearch] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<ShoppingProduct | null>(null);

  // Sotto-modulo marca (opzionale nella tab Nuovo prodotto, obbligatorio nell'altra)
  const [brandBarcode, setBrandBarcode] = useState("");
  const [brandName, setBrandName] = useState("");
  const [lookupResult, setLookupResult] = useState<OpenFactsResult | null>(null);
  const [lookingUp, setLookingUp] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  const isPerishable = PERISHABLE_CATEGORIES.includes(prodCategory);
  const shelfLifeSuggestion = isPerishable ? suggestShelfLifeDays(prodName) : null;
  const trimmedBarcode = brandBarcode.trim();
  const barcodeChecksumInvalid = trimmedBarcode.length > 0 && !isValidBarcodeChecksum(trimmedBarcode);

  const resetBrandSubform = () => {
    setBrandBarcode(""); setBrandName(""); setLookupResult(null);
  };

  const handleLookupInfo = (code?: string) => {
    const barcode = (code ?? brandBarcode).trim();
    if (!barcode) { alert("Inserisci prima un codice a barre"); return; }
    setLookingUp(true);
    startTransition(async () => {
      const result = await lookupProductInfo(barcode);
      setLookingUp(false);
      if (!result) { alert("Nessuna scheda trovata per questo codice."); return; }
      if (!brandName.trim() && result.brand_name) setBrandName(result.brand_name);
      setLookupResult(result);
    });
  };

  const handleScanDetected = (code: string) => {
    setShowScanner(false);
    setBrandBarcode(code);
    handleLookupInfo(code);
  };

  const handleBarcodeKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") { e.preventDefault(); handleLookupInfo(); }
  };

  const brandPayloadFromLookup = () => ({
    brand_name: brandName.trim(),
    barcode: trimmedBarcode || null,
    image_url: lookupResult?.image_url,
    image_packaging_url: lookupResult?.image_packaging_url,
    nutri_score: lookupResult?.nutri_score,
    nova_group: lookupResult?.nova_group,
    eco_score: lookupResult?.eco_score,
    ingredients_text: lookupResult?.ingredients_text,
    allergens: lookupResult?.allergens,
    traces: lookupResult?.traces,
    labels: lookupResult?.labels,
    additives: lookupResult?.additives,
    package_quantity: lookupResult?.package_quantity,
    off_categories: lookupResult?.off_categories,
    nutriments: lookupResult?.nutriments,
  });

  const handleSubmitNewProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prodName.trim()) { alert("Inserisci il nome del prodotto"); return; }

    startTransition(async () => {
      const productRes = await createShoppingProduct({
        name: prodName.trim(),
        category: prodCategory || null,
        store_id: prodStoreId || null,
        aisle: prodAisle || null,
        default_unit: prodUnit || null,
        shelf_life_days: prodShelfLife ? Number(prodShelfLife) : null,
        is_off_list: prodOffList,
      });
      if (!productRes.success || !productRes.data) { alert(productRes.error); return; }
      const newProduct = productRes.data as ShoppingProduct;

      let brandId: string | null = null;
      if (brandName.trim()) {
        const brandRes = await createProductBrand(newProduct.id, brandPayloadFromLookup());
        if (!brandRes.success || !brandRes.data) { alert(brandRes.error); return; }
        brandId = (brandRes.data as ShoppingProductBrand).id;
      }

      onProductCreated(newProduct);

      if (listId) {
        const itemRes = await addShoppingListItemFromProduct(listId, newProduct.id, { brand_id: brandId });
        if (!itemRes.success || !itemRes.data) { alert(itemRes.error); return; }
        onItemAdded?.(itemRes.data as ShoppingListItem);
      }

      onClose();
    });
  };

  const handleSubmitExistingBrand = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) { alert("Scegli prima un prodotto"); return; }
    if (!brandName.trim()) { alert("Inserisci il nome della marca"); return; }

    startTransition(async () => {
      const brandRes = await createProductBrand(selectedProduct.id, brandPayloadFromLookup());
      if (!brandRes.success || !brandRes.data) { alert(brandRes.error); return; }
      const brand = brandRes.data as ShoppingProductBrand;

      if (listId) {
        const itemRes = await addShoppingListItemFromProduct(listId, selectedProduct.id, { brand_id: brand.id });
        if (!itemRes.success || !itemRes.data) { alert(itemRes.error); return; }
        onItemAdded?.(itemRes.data as ShoppingListItem);
      }

      setFlash(`✓ "${brand.brand_name}" aggiunta a ${selectedProduct.name}`);
      setTimeout(() => setFlash(null), 1500);
      resetBrandSubform();
    });
  };

  const lowerSearch = existingSearch.trim().toLowerCase();
  const filteredExisting = lowerSearch ? products.filter((p) => p.name.toLowerCase().includes(lowerSearch)) : products;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4 animate-fade-in" onClick={onClose}>
      <div
        className="relative w-full max-w-lg my-8 rounded-2xl p-6 border shadow-2xl backdrop-blur-xl animate-fade-in max-h-[90vh] overflow-y-auto"
        style={{ background: "linear-gradient(135deg, hsla(245, 60%, 15%, 0.1), hsla(240, 10%, 10%, 0.97))", borderColor: "hsla(245, 60%, 50%, 0.15)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" onClick={onClose}
          className="absolute top-4 right-4 text-zinc-400 hover:text-white text-lg leading-none z-20" aria-label="Chiudi">
          ✕
        </button>

        <div className="flex gap-1 p-1 mb-4 rounded-xl bg-zinc-950/60 border border-white/5 text-[11px] font-bold">
          <button type="button" onClick={() => setActiveTab("new")}
            className="flex-1 py-2 rounded-lg transition-all"
            style={{ background: activeTab === "new" ? "hsla(245, 70%, 60%, 0.15)" : "transparent", color: activeTab === "new" ? "hsl(245 70% 75%)" : "hsl(240 5% 55%)" }}>
            Nuovo prodotto
          </button>
          <button type="button" onClick={() => setActiveTab("existing")}
            className="flex-1 py-2 rounded-lg transition-all"
            style={{ background: activeTab === "existing" ? "hsla(245, 70%, 60%, 0.15)" : "transparent", color: activeTab === "existing" ? "hsl(245 70% 75%)" : "hsl(240 5% 55%)" }}>
            Marca su esistente
          </button>
        </div>

        {activeTab === "new" ? (
          <form onSubmit={handleSubmitNewProduct} className="space-y-3">
            <input value={prodName} onChange={(e) => setProdName(e.target.value)} placeholder="Nome (es. Mele)" required
              className="w-full px-4 py-3 rounded-xl text-xs text-white border border-zinc-800 bg-zinc-950/80" />
            <select value={prodCategory} onChange={(e) => setProdCategory(e.target.value)}
              className="w-full px-4 py-3 rounded-xl text-xs text-white border border-zinc-800 bg-zinc-950/80">
              <option value="">Categoria...</option>
              {GROCERY_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={prodStoreId} onChange={(e) => setProdStoreId(e.target.value)}
              className="w-full px-4 py-3 rounded-xl text-xs text-white border border-zinc-800 bg-zinc-950/80">
              <option value="">Negozio abituale (opzionale)</option>
              {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
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
              </div>
            )}

            <label className="flex items-center gap-2 text-[10px] font-bold text-zinc-400 cursor-pointer">
              <input type="checkbox" checked={prodOffList} onChange={(e) => setProdOffList(e.target.checked)} className="accent-violet-500" />
              🎁 Preferito
            </label>

            <div className="pt-2 border-t border-zinc-800/80 space-y-2">
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Marca (opzionale)</p>
              <div className="flex gap-2">
                <input value={brandBarcode} onChange={(e) => setBrandBarcode(e.target.value)} onKeyDown={handleBarcodeKeyDown} placeholder="Codice a barre"
                  className="flex-1 px-3 py-2.5 rounded-lg text-xs text-white border border-zinc-800 bg-zinc-950/80"
                  style={barcodeChecksumInvalid ? { borderColor: "rgba(245,158,11,0.5)" } : undefined} />
                <button type="button" onClick={() => setShowScanner(true)}
                  className="px-3 py-2.5 rounded-lg text-xs font-bold text-white bg-zinc-800 hover:bg-zinc-700 transition-all" title="Scansiona">
                  📷
                </button>
                <button type="button" onClick={() => handleLookupInfo()} disabled={lookingUp || !trimmedBarcode}
                  className="px-3 py-2.5 rounded-lg text-xs font-bold text-white bg-zinc-800 hover:bg-zinc-700 transition-all">
                  🔍
                </button>
              </div>
              {barcodeChecksumInvalid && <p className="text-[9px] font-semibold text-amber-400">⚠️ Codice non valido: controlla le cifre</p>}
              <input value={brandName} onChange={(e) => setBrandName(e.target.value)} placeholder="Nome marca (es. Coca-Cola)"
                className="w-full px-3 py-2.5 rounded-lg text-xs text-white border border-zinc-800 bg-zinc-950/80" />
              {lookupResult && (
                <p className="text-[9px] text-emerald-400">✓ Dati trovati su {lookupResult.source}: verranno salvati con la marca.</p>
              )}
            </div>

            <button type="submit" disabled={isPending} className="w-full py-3 rounded-xl text-xs font-extrabold text-white bg-indigo-600 hover:bg-indigo-500 transition-all">
              {listId ? "Crea e aggiungi alla lista" : "Crea prodotto"}
            </button>
          </form>
        ) : (
          <div className="space-y-3">
            {flash && <p className="text-[10px] font-bold text-emerald-400 animate-fade-in">{flash}</p>}

            {selectedProduct ? (
              <div className="flex items-center justify-between p-2.5 rounded-lg border border-zinc-800/80 bg-zinc-950/40">
                <span className="text-xs font-bold text-white">{selectedProduct.name}</span>
                <button type="button" onClick={() => { setSelectedProduct(null); resetBrandSubform(); }}
                  className="text-[10px] font-bold text-zinc-400 hover:text-white transition-all">
                  Cambia prodotto
                </button>
              </div>
            ) : (
              <>
                <input value={existingSearch} onChange={(e) => setExistingSearch(e.target.value)} placeholder="Cerca il prodotto..." autoFocus
                  className="w-full px-4 py-3 rounded-xl text-xs text-white border border-zinc-800 bg-zinc-950/80" />
                <div className="max-h-64 overflow-y-auto space-y-1.5">
                  {filteredExisting.map((p) => (
                    <button key={p.id} type="button" onClick={() => setSelectedProduct(p)}
                      className="w-full p-2.5 rounded-lg border border-zinc-800/80 bg-zinc-950/40 text-left hover:border-zinc-600 transition-all">
                      <span className="text-xs font-semibold text-white">{p.name}</span>
                    </button>
                  ))}
                  {filteredExisting.length === 0 && <p className="text-[11px] text-zinc-500 py-2">Nessun prodotto trovato.</p>}
                </div>
              </>
            )}

            {selectedProduct && (
              <form onSubmit={handleSubmitExistingBrand} className="space-y-2">
                <div className="flex gap-2">
                  <input value={brandBarcode} onChange={(e) => setBrandBarcode(e.target.value)} onKeyDown={handleBarcodeKeyDown} placeholder="Codice a barre"
                    className="flex-1 px-3 py-2.5 rounded-lg text-xs text-white border border-zinc-800 bg-zinc-950/80"
                    style={barcodeChecksumInvalid ? { borderColor: "rgba(245,158,11,0.5)" } : undefined} />
                  <button type="button" onClick={() => setShowScanner(true)}
                    className="px-3 py-2.5 rounded-lg text-xs font-bold text-white bg-zinc-800 hover:bg-zinc-700 transition-all" title="Scansiona">
                    📷
                  </button>
                  <button type="button" onClick={() => handleLookupInfo()} disabled={lookingUp || !trimmedBarcode}
                    className="px-3 py-2.5 rounded-lg text-xs font-bold text-white bg-zinc-800 hover:bg-zinc-700 transition-all">
                    🔍
                  </button>
                </div>
                {barcodeChecksumInvalid && <p className="text-[9px] font-semibold text-amber-400">⚠️ Codice non valido: controlla le cifre</p>}
                <input value={brandName} onChange={(e) => setBrandName(e.target.value)} placeholder="Nome marca (es. Coca-Cola)" required
                  className="w-full px-3 py-2.5 rounded-lg text-xs text-white border border-zinc-800 bg-zinc-950/80" />
                {lookupResult && (
                  <p className="text-[9px] text-emerald-400">✓ Dati trovati su {lookupResult.source}: verranno salvati con la marca.</p>
                )}
                <button type="submit" disabled={isPending} className="w-full py-3 rounded-xl text-xs font-extrabold text-white bg-indigo-600 hover:bg-indigo-500 transition-all">
                  {listId ? "Aggiungi marca e alla lista" : "Aggiungi marca"}
                </button>
              </form>
            )}
          </div>
        )}
      </div>

      {showScanner && <BarcodeScannerModal onDetected={handleScanDetected} onClose={() => setShowScanner(false)} />}
    </div>
  );
}

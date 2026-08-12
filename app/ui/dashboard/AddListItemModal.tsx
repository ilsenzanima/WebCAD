"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import type { ShoppingProduct, ShoppingListItem, ShoppingProductBrand } from "@/lib/types/database";
import {
  addShoppingListItemFromProduct,
  createShoppingProduct,
  createProductBrand,
  findProductBrandByBarcode,
  getProductBrands,
  lookupProductInfo,
  getSuggestedProducts,
  type OpenFactsResult,
} from "@/app/actions/shopping";
import { GROCERY_CATEGORIES, guessCategoryFromOffCategories } from "@/lib/shoppingCategories";
import BarcodeScannerModal from "./BarcodeScannerModal";
import { isValidBarcodeChecksum } from "@/lib/barcodeChecksum";

interface AddListItemModalProps {
  listId: string;
  storeId: string | null;
  products: ShoppingProduct[];
  existingItems: ShoppingListItem[];
  onItemAdded: (item: ShoppingListItem) => void;
  onProductCreated: (product: ShoppingProduct) => void;
  onClose: () => void;
}

export default function AddListItemModal({
  listId, storeId, products, existingItems, onItemAdded, onProductCreated, onClose,
}: AddListItemModalProps) {
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [addedFlash, setAddedFlash] = useState<string | null>(null);

  const [barcodeQuery, setBarcodeQuery] = useState("");
  const [searchingBarcode, setSearchingBarcode] = useState(false);
  const [showScanner, setShowScanner] = useState(false);

  const [suggestions, setSuggestions] = useState<{ product: ShoppingProduct; count: number }[]>([]);

  // Se il prodotto scelto ha piu' marche censite, si chiede quale prima di
  // aggiungerlo (es. "Bibita gassata" -> Coca-Cola o Pepsi).
  const [brandPickerProduct, setBrandPickerProduct] = useState<ShoppingProduct | null>(null);
  const [brandPickerOptions, setBrandPickerOptions] = useState<ShoppingProductBrand[]>([]);

  // Codice a barre non ancora in vetrina: proponiamo di creare prodotto +
  // marca (da Open Facts se lo trova, altrimenti a mano) e lo aggiungiamo
  // subito a questa lista, senza dover passare dalla Vetrina.
  const [showScanCreateForm, setShowScanCreateForm] = useState(false);
  const [scanCreateData, setScanCreateData] = useState<OpenFactsResult | null>(null);
  const [scanBarcode, setScanBarcode] = useState("");
  const [scanProductName, setScanProductName] = useState("");
  const [scanCategory, setScanCategory] = useState("");
  const [scanBrandName, setScanBrandName] = useState("");

  const existingProductIds = useMemo(() => new Set(existingItems.map((i) => i.product_id)), [existingItems]);

  useEffect(() => {
    getSuggestedProducts(storeId, Array.from(existingProductIds)).then(setSuggestions);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId]);

  const flash = (productName: string) => {
    setAddedFlash(productName);
    setTimeout(() => setAddedFlash((cur) => (cur === productName ? null : cur)), 1200);
  };

  const addToList = (productId: string, brandId: string | null, productName: string) => {
    startTransition(async () => {
      const res = await addShoppingListItemFromProduct(listId, productId, { brand_id: brandId });
      if (!res.success || !res.data) { alert(res.error); return; }
      onItemAdded(res.data as ShoppingListItem);
      flash(productName);
    });
  };

  // Se il prodotto ha piu' di una marca censita chiediamo quale prima di
  // aggiungerlo; con zero o una sola marca si aggiunge subito.
  const handleAddProduct = (product: ShoppingProduct) => {
    startTransition(async () => {
      const brands = await getProductBrands(product.id);
      if (brands.length > 1) {
        setBrandPickerProduct(product);
        setBrandPickerOptions(brands);
        return;
      }
      addToList(product.id, brands[0]?.id ?? null, product.name);
    });
  };

  const handlePickBrand = (brandId: string | null) => {
    if (!brandPickerProduct) return;
    addToList(brandPickerProduct.id, brandId, brandPickerProduct.name);
    setBrandPickerProduct(null);
    setBrandPickerOptions([]);
  };

  const handleCreatePlainProduct = (name: string) => {
    if (!name.trim()) return;
    startTransition(async () => {
      const res = await createShoppingProduct({ name: name.trim() });
      if (!res.success || !res.data) { alert(res.error); return; }
      const newProduct = res.data as ShoppingProduct;
      onProductCreated(newProduct);
      const itemRes = await addShoppingListItemFromProduct(listId, newProduct.id);
      if (!itemRes.success || !itemRes.data) { alert(itemRes.error); return; }
      onItemAdded(itemRes.data as ShoppingListItem);
      flash(newProduct.name);
      setSearch("");
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
        const existing = products.find((p) => p.id === result.product_id);
        // Il codice a barre identifica gia' la marca esatta: si aggiunge
        // direttamente, senza passare dal selettore marca.
        addToList(result.product_id, result.id, existing?.name || result.brand_name);
        setBarcodeQuery("");
        return;
      }

      const offResult = await lookupProductInfo(trimmed);
      setSearchingBarcode(false);
      setScanBarcode(trimmed);
      setScanCreateData(offResult);
      setScanProductName(offResult?.product_name || "");
      setScanCategory(guessCategoryFromOffCategories(offResult?.off_categories ?? null));
      setScanBrandName(offResult?.brand_name || "");
      setShowScanCreateForm(true);
    });
  };

  const handleScanDetected = (code: string) => {
    setShowScanner(false);
    setBarcodeQuery(code);
    runBarcodeSearch(code);
  };

  const resetScanCreateForm = () => {
    setShowScanCreateForm(false); setScanCreateData(null); setScanBarcode("");
    setScanProductName(""); setScanCategory(""); setScanBrandName("");
  };

  const handleScanCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!scanProductName.trim() || !scanBrandName.trim()) { alert("Nome prodotto e marca sono obbligatori"); return; }

    startTransition(async () => {
      const productRes = await createShoppingProduct({
        name: scanProductName.trim(),
        category: scanCategory || null,
      });
      if (!productRes.success || !productRes.data) { alert(productRes.error); return; }
      const newProduct = productRes.data as ShoppingProduct;

      const brandRes = await createProductBrand(newProduct.id, {
        brand_name: scanBrandName.trim(),
        barcode: scanBarcode,
        image_url: scanCreateData?.image_url,
        image_packaging_url: scanCreateData?.image_packaging_url,
        nutri_score: scanCreateData?.nutri_score,
        nova_group: scanCreateData?.nova_group,
        eco_score: scanCreateData?.eco_score,
        ingredients_text: scanCreateData?.ingredients_text,
        allergens: scanCreateData?.allergens,
        traces: scanCreateData?.traces,
        labels: scanCreateData?.labels,
        additives: scanCreateData?.additives,
        package_quantity: scanCreateData?.package_quantity,
        off_categories: scanCreateData?.off_categories,
        nutriments: scanCreateData?.nutriments,
      });
      if (!brandRes.success || !brandRes.data) { alert(brandRes.error); return; }

      onProductCreated(newProduct);
      const itemRes = await addShoppingListItemFromProduct(listId, newProduct.id, { brand_id: (brandRes.data as ShoppingProductBrand).id });
      if (!itemRes.success || !itemRes.data) { alert(itemRes.error); return; }
      onItemAdded(itemRes.data as ShoppingListItem);
      flash(newProduct.name);
      resetScanCreateForm();
      setBarcodeQuery("");
    });
  };

  const lowerSearch = search.trim().toLowerCase();
  const filteredProducts = lowerSearch
    ? products.filter((p) => p.name.toLowerCase().includes(lowerSearch))
    : products;
  const offListProducts = products.filter((p) => p.is_off_list && (!lowerSearch || p.name.toLowerCase().includes(lowerSearch)));

  const productsByCategory = filteredProducts.reduce<Record<string, ShoppingProduct[]>>((acc, p) => {
    const cat = p.category || "Senza categoria";
    (acc[cat] ||= []).push(p);
    return acc;
  }, {});

  const noMatches = lowerSearch && filteredProducts.length === 0;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4 animate-fade-in" onClick={onClose}>
      <div
        className="relative w-full max-w-lg my-8 rounded-2xl p-6 border shadow-2xl backdrop-blur-xl animate-fade-in max-h-[90vh] overflow-y-auto flex flex-col"
        style={{ background: "linear-gradient(135deg, hsla(245, 60%, 15%, 0.1), hsla(240, 10%, 10%, 0.97))", borderColor: "hsla(245, 60%, 50%, 0.15)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" onClick={onClose}
          className="absolute top-4 right-4 text-zinc-400 hover:text-white text-lg leading-none z-20" aria-label="Chiudi">
          ✕
        </button>

        <h2 className="text-base font-extrabold text-white mb-4">Aggiungi articolo</h2>

        {brandPickerProduct ? (
          <>
            <h3 className="text-sm font-extrabold text-white mb-1">{brandPickerProduct.name}</h3>
            <p className="text-[10px] text-zinc-500 mb-4">Quale marca vuoi aggiungere?</p>
            <div className="space-y-1.5">
              {brandPickerOptions.map((b) => (
                <button key={b.id} type="button" onClick={() => handlePickBrand(b.id)}
                  className="w-full p-2.5 rounded-lg border border-zinc-800/80 bg-zinc-950/40 flex items-center gap-2 text-left hover:border-indigo-500/40 transition-all">
                  {b.image_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={b.image_url} alt="" className="w-7 h-7 object-cover rounded border border-zinc-800 flex-shrink-0" />
                  )}
                  <span className="text-xs font-semibold text-white">{b.brand_name}</span>
                </button>
              ))}
              <button type="button" onClick={() => handlePickBrand(null)}
                className="w-full p-2.5 rounded-lg border border-zinc-800/80 bg-zinc-950/40 text-left text-xs font-semibold text-zinc-400 hover:border-zinc-600 transition-all">
                Senza marca specifica
              </button>
              <button type="button" onClick={() => { setBrandPickerProduct(null); setBrandPickerOptions([]); }}
                className="w-full py-2.5 rounded-lg text-xs font-bold text-zinc-400 hover:text-white transition-all">
                ← Torna alla ricerca
              </button>
            </div>
          </>
        ) : showScanCreateForm ? (
          <>
            <h3 className="text-sm font-extrabold text-white mb-1">
              {scanCreateData ? `Prodotto trovato su ${scanCreateData.source}` : "Nuovo prodotto dal codice a barre"}
            </h3>
            <p className="text-[10px] text-zinc-500 mb-3 font-mono">{scanBarcode}</p>
            {!scanCreateData && (
              <p className="text-[10px] text-amber-300/90 mb-3">Non è nei database pubblici: inserisci nome e marca a mano.</p>
            )}
            <form onSubmit={handleScanCreateSubmit} className="space-y-3">
              <input value={scanProductName} onChange={(e) => setScanProductName(e.target.value)} placeholder="Nome prodotto generico" required
                className="w-full px-4 py-3 rounded-xl text-xs text-white border border-zinc-800 bg-zinc-950/80" />
              <select value={scanCategory} onChange={(e) => setScanCategory(e.target.value)}
                className="w-full px-4 py-3 rounded-xl text-xs text-white border border-zinc-800 bg-zinc-950/80">
                <option value="">Categoria (opzionale)</option>
                {GROCERY_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <input value={scanBrandName} onChange={(e) => setScanBrandName(e.target.value)} placeholder="Marca" required
                className="w-full px-4 py-3 rounded-xl text-xs text-white border border-zinc-800 bg-zinc-950/80" />
              <div className="flex gap-2">
                <button type="button" onClick={resetScanCreateForm}
                  className="flex-1 py-3 rounded-xl text-xs font-bold text-zinc-300 bg-zinc-800 hover:bg-zinc-700 transition-all">
                  Annulla
                </button>
                <button type="submit" disabled={isPending}
                  className="flex-1 py-3 rounded-xl text-xs font-extrabold text-white bg-indigo-600 hover:bg-indigo-500 transition-all">
                  Crea e aggiungi
                </button>
              </div>
            </form>
          </>
        ) : (
          <>
            {/* Ricerca testo + codice a barre */}
            <div className="space-y-2 mb-4">
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cerca un articolo..." autoFocus
                className="w-full px-4 py-3 rounded-xl text-xs text-white border border-zinc-800 bg-zinc-950/80" />
              <div className="flex gap-2">
                <input value={barcodeQuery} onChange={(e) => setBarcodeQuery(e.target.value)} placeholder="...o codice a barre"
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); runBarcodeSearch(barcodeQuery); } }}
                  className="flex-1 px-4 py-3 rounded-xl text-xs text-white border border-zinc-800 bg-zinc-950/80"
                  style={barcodeQuery.trim() && !isValidBarcodeChecksum(barcodeQuery.trim()) ? { borderColor: "rgba(245,158,11,0.5)" } : undefined} />
                <button type="button" onClick={() => setShowScanner(true)}
                  className="px-4 py-3 rounded-xl text-xs font-bold text-white bg-zinc-800 hover:bg-zinc-700 transition-all" title="Scansiona con la fotocamera">
                  📷
                </button>
                <button type="button" onClick={() => runBarcodeSearch(barcodeQuery)} disabled={searchingBarcode || !barcodeQuery.trim()}
                  className="px-4 py-3 rounded-xl text-xs font-bold text-white bg-zinc-800 hover:bg-zinc-700 transition-all">
                  🔍
                </button>
              </div>
            </div>

            {addedFlash && (
              <p className="text-[10px] font-bold text-emerald-400 mb-2 animate-fade-in">✓ "{addedFlash}" aggiunto</p>
            )}

            {!lowerSearch && offListProducts.length > 0 && (
              <div className="mb-4">
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-2">🎁 Preferiti</h3>
                <div className="flex flex-wrap gap-1.5">
                  {offListProducts.map((p) => (
                    <button key={p.id} type="button" onClick={() => handleAddProduct(p)} disabled={existingProductIds.has(p.id)}
                      className="px-2.5 py-1.5 rounded-full text-[10px] font-bold border transition-all disabled:opacity-40"
                      style={{ background: "hsla(280, 60%, 50%, 0.1)", borderColor: "hsla(280, 60%, 50%, 0.25)", color: "hsl(280 70% 80%)" }}>
                      {existingProductIds.has(p.id) ? "✓ " : "+ "}{p.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {!lowerSearch && suggestions.length > 0 && (
              <div className="mb-4">
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-2">💡 Presi spesso {storeId ? "qui" : ""}</h3>
                <div className="flex flex-wrap gap-1.5">
                  {suggestions.map(({ product }) => (
                    <button key={product.id} type="button" onClick={() => handleAddProduct(product)} disabled={existingProductIds.has(product.id)}
                      className="px-2.5 py-1.5 rounded-full text-[10px] font-bold border transition-all disabled:opacity-40 bg-amber-500/10 border-amber-500/25 text-amber-300">
                      {existingProductIds.has(product.id) ? "✓ " : "+ "}{product.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex-1 overflow-y-auto space-y-4">
              {Object.entries(productsByCategory).map(([category, items]) => (
                <div key={category}>
                  <h3 className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-2">{category}</h3>
                  <div className="space-y-1.5">
                    {items.map((p) => (
                      <button key={p.id} type="button" onClick={() => handleAddProduct(p)} disabled={existingProductIds.has(p.id)}
                        className="w-full p-2.5 rounded-lg border border-zinc-800/80 bg-zinc-950/40 flex items-center justify-between text-left hover:border-zinc-600 transition-all disabled:opacity-40">
                        <span className="text-xs font-semibold text-white">{p.name}</span>
                        <span className="text-xs font-bold text-indigo-300">{existingProductIds.has(p.id) ? "✓" : "+"}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}

              {noMatches && (
                <div className="text-center py-4 space-y-2">
                  <p className="text-[11px] text-zinc-500">Nessun articolo trovato per "{search}".</p>
                  <button type="button" onClick={() => handleCreatePlainProduct(search)} disabled={isPending}
                    className="px-4 py-2.5 rounded-xl text-xs font-extrabold text-white bg-indigo-600 hover:bg-indigo-500 transition-all">
                    + Crea "{search}" e aggiungi
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {showScanner && <BarcodeScannerModal onDetected={handleScanDetected} onClose={() => setShowScanner(false)} />}
    </div>
  );
}

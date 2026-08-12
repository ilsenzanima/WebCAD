"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import type { Store } from "@/lib/types/database";
import { createStore, deleteStore } from "@/app/actions/stores";
import { STORE_CATEGORIES } from "@/lib/storeCategories";
import { DeleteIcon, ArrowRightIcon } from "./icons";

interface ShoppingStoresClientProps {
  initialStores: Store[];
}

export default function ShoppingStoresClient({ initialStores }: ShoppingStoresClientProps) {
  const [stores, setStores] = useState<Store[]>(initialStores);
  const [isPending, startTransition] = useTransition();

  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [address, setAddress] = useState("");
  const [loyaltyCard, setLoyaltyCard] = useState("");

  const resetForm = () => {
    setName(""); setCategory(""); setAddress(""); setLoyaltyCard("");
    setShowModal(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { alert("Inserisci il nome del negozio"); return; }

    startTransition(async () => {
      const res = await createStore({
        name: name.trim(),
        category: category || null,
        address: address || null,
        loyalty_card_number: loyaltyCard || null,
      });
      if (!res.success || !res.data) { alert(res.error); return; }
      setStores((prev) => [...prev, res.data as Store].sort((a, b) => a.name.localeCompare(b.name)));
      resetForm();
    });
  };

  const handleDelete = (id: string) => {
    if (!confirm("Rimuovere questo negozio? Rimarrà eventualmente collegato ai Fornitori, ma non sarà più selezionabile in vetrina/lista della spesa.")) return;
    startTransition(async () => {
      const res = await deleteStore(id);
      if (!res.success) { alert(res.error); return; }
      setStores((prev) => prev.filter((s) => s.id !== id));
    });
  };

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="animate-fade-in">
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
          🏬 Negozi
        </h1>
        <p className="text-sm text-slate-400 mt-1">Condivisi con tutta la famiglia: usati per la vetrina e la lista della spesa.</p>
      </div>

      {/* Elenco Negozi */}
      <div className="rounded-2xl p-6 border shadow-2xl backdrop-blur-xl animate-fade-in"
        style={{ background: "linear-gradient(135deg, hsla(240, 10%, 12%, 0.5), hsla(240, 10%, 10%, 0.8))", borderColor: "hsla(240, 5%, 18%, 0.7)" }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-extrabold text-white">Negozi</h3>
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="px-4 py-2.5 rounded-xl text-xs font-extrabold text-white transition-all shadow-lg active:scale-98 flex items-center gap-2"
            style={{ background: "linear-gradient(135deg, hsl(245 70% 60%), hsl(255 60% 50%))" }}
          >
            <span>＋</span> Nuovo negozio
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {stores.map((s) => (
            <div key={s.id} className="relative group">
              <Link
                href={`/dashboard/shopping-stores/${s.id}`}
                className="p-3 rounded-xl border border-zinc-800/80 bg-zinc-950/40 flex items-center justify-between hover:border-zinc-600 transition-all"
              >
                <div className="min-w-0">
                  <div className="text-xs font-bold text-white truncate">{s.name}</div>
                  <div className="text-[10px] text-zinc-500 truncate">
                    {[s.category, s.address, s.loyalty_card_number ? "tessera fedeltà" : null].filter(Boolean).join(" · ") || "Apri la scheda →"}
                  </div>
                </div>
                <ArrowRightIcon size={12} className="text-zinc-600 flex-shrink-0 ml-2" />
              </Link>
              <button
                onClick={(e) => { e.preventDefault(); handleDelete(s.id); }}
                className="absolute top-2 right-7 p-1 rounded text-slate-500 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity bg-zinc-950/80"
                title="Rimuovi negozio"
              >
                <DeleteIcon size={12} />
              </button>
            </div>
          ))}
        </div>
        {stores.length === 0 && <p className="text-[11px] text-zinc-500">Nessun negozio ancora inserito.</p>}
      </div>

      {/* Modale Nuovo Negozio */}
      {showModal && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4 animate-fade-in overflow-y-auto"
          onClick={resetForm}
        >
          <div
            className="relative w-full max-w-lg my-8 rounded-2xl p-6 border shadow-2xl backdrop-blur-xl animate-fade-in max-h-[90vh] overflow-y-auto"
            style={{ background: "linear-gradient(135deg, hsla(245, 60%, 15%, 0.1), hsla(240, 10%, 10%, 0.97))", borderColor: "hsla(245, 60%, 50%, 0.15)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={resetForm}
              className="absolute top-4 right-4 text-zinc-400 hover:text-white text-lg leading-none z-20"
              aria-label="Chiudi"
            >
              ✕
            </button>

            <h2 className="text-base font-extrabold text-white mb-4">Nuovo negozio</h2>

            <form onSubmit={handleSubmit} className="space-y-3">
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome (es. Esselunga)" required
                className="w-full px-4 py-3 rounded-xl text-xs text-white border border-zinc-800 bg-zinc-950/80" />
              <select value={category} onChange={(e) => setCategory(e.target.value)}
                className="w-full px-4 py-3 rounded-xl text-xs text-white border border-zinc-800 bg-zinc-950/80">
                <option value="">Categoria (opzionale)</option>
                {STORE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Indirizzo (opzionale)"
                className="w-full px-4 py-3 rounded-xl text-xs text-white border border-zinc-800 bg-zinc-950/80" />
              <input value={loyaltyCard} onChange={(e) => setLoyaltyCard(e.target.value)} placeholder="Numero tessera fedeltà (opzionale)"
                className="w-full px-4 py-3 rounded-xl text-xs text-white border border-zinc-800 bg-zinc-950/80" />
              <p className="text-[9px] text-zinc-500">Il collegamento a un Fornitore delle Finanze (per il totale spese) si imposta aprendo la scheda del negozio.</p>
              <button type="submit" disabled={isPending} className="w-full py-3 rounded-xl text-xs font-extrabold text-white bg-indigo-600 hover:bg-indigo-500 transition-all">
                Crea negozio
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

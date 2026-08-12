"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Store } from "@/lib/types/database";
import { updateStore, deleteStore } from "@/app/actions/stores";
import { STORE_CATEGORIES } from "@/lib/storeCategories";
import { formatCurrency, formatDate } from "@/lib/format";
import { DeleteIcon, ArrowLeftIcon } from "./icons";

interface SpendingSummary {
  supplierName: string;
  totalAmount: number;
  count: number;
  lastDate: string | null;
}

interface StoreDetailClientProps {
  store: Store;
  isAdmin: boolean;
  spendingSummary: SpendingSummary | null;
}

export default function StoreDetailClient({ store, isAdmin, spendingSummary }: StoreDetailClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [name, setName] = useState(store.name);
  const [category, setCategory] = useState(store.category || "");
  const [address, setAddress] = useState(store.address || "");
  const [loyaltyCard, setLoyaltyCard] = useState(store.loyalty_card_number || "");
  const [notes, setNotes] = useState(store.notes || "");

  const handleSave = () => {
    if (!name.trim()) { alert("Il nome non può essere vuoto"); return; }
    startTransition(async () => {
      const res = await updateStore(store.id, {
        name: name.trim(),
        category: category || null,
        address: address || null,
        loyalty_card_number: loyaltyCard || null,
        notes: notes || null,
      });
      if (!res.success) { alert(res.error); return; }
      router.refresh();
    });
  };

  const handleDelete = () => {
    if (!confirm("Rimuovere questo negozio dalla famiglia?")) return;
    startTransition(async () => {
      const res = await deleteStore(store.id);
      if (!res.success) { alert(res.error); return; }
      router.push("/dashboard/shopping-stores");
    });
  };

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-3xl mx-auto">
      <Link href="/dashboard/shopping-stores" className="inline-flex items-center gap-1.5 text-[11px] font-bold text-zinc-400 hover:text-white transition-all">
        <ArrowLeftIcon size={12} /> Negozi
      </Link>

      <div className="animate-fade-in flex items-center justify-between gap-4">
        <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
          🏬 {store.name}
        </h1>
        <button onClick={handleDelete} className="p-2 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-all" title="Elimina negozio">
          <DeleteIcon size={16} />
        </button>
      </div>

      {isAdmin && (
        <div className="rounded-2xl p-5 border shadow-2xl backdrop-blur-xl animate-fade-in"
          style={{ background: "linear-gradient(135deg, hsla(265, 60%, 15%, 0.1), hsla(240, 10%, 10%, 0.9))", borderColor: "hsla(265, 60%, 50%, 0.15)" }}>
          <h3 className="text-sm font-extrabold text-white mb-3">💶 Spese in questo negozio</h3>
          {spendingSummary ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block">Totale (Fornitore: {spendingSummary.supplierName})</span>
                <span className="text-lg font-black text-white">{formatCurrency(spendingSummary.totalAmount)}</span>
              </div>
              <div>
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block">Spese registrate</span>
                <span className="text-lg font-black text-white">{spendingSummary.count}{spendingSummary.lastDate ? ` · ultima ${formatDate(spendingSummary.lastDate)}` : ""}</span>
              </div>
            </div>
          ) : (
            <p className="text-[11px] text-zinc-500">
              Nessun Fornitore collegato a questo negozio: vai su{" "}
              <Link href="/dashboard/suppliers" className="text-indigo-300 hover:text-indigo-200 font-semibold">Fornitori</Link>{" "}
              e collega (o crea) un fornitore a questo negozio per vedere qui il totale speso.
            </p>
          )}
        </div>
      )}

      <div className="rounded-2xl p-5 border shadow-2xl backdrop-blur-xl animate-fade-in space-y-3"
        style={{ background: "linear-gradient(135deg, hsla(240, 10%, 12%, 0.5), hsla(240, 10%, 10%, 0.8))", borderColor: "hsla(240, 5%, 18%, 0.7)" }}>
        <div className="space-y-1">
          <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Nome</label>
          <input value={name} onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2.5 rounded-lg text-xs text-white border border-zinc-800 bg-zinc-950/80" />
        </div>
        <div className="space-y-1">
          <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Categoria</label>
          <select value={category} onChange={(e) => setCategory(e.target.value)}
            className="w-full px-3 py-2.5 rounded-lg text-xs text-white border border-zinc-800 bg-zinc-950/80">
            <option value="">Nessuna</option>
            {STORE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Indirizzo</label>
          <input value={address} onChange={(e) => setAddress(e.target.value)}
            className="w-full px-3 py-2.5 rounded-lg text-xs text-white border border-zinc-800 bg-zinc-950/80" />
        </div>
        <div className="space-y-1">
          <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Numero tessera fedeltà</label>
          <input value={loyaltyCard} onChange={(e) => setLoyaltyCard(e.target.value)}
            className="w-full px-3 py-2.5 rounded-lg text-xs text-white border border-zinc-800 bg-zinc-950/80" />
        </div>
        <div className="space-y-1">
          <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Note</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
            className="w-full px-3 py-2.5 rounded-lg text-xs text-white border border-zinc-800 bg-zinc-950/80 resize-none" />
        </div>
        <button onClick={handleSave} disabled={isPending}
          className="w-full py-3 rounded-xl text-xs font-extrabold text-white bg-indigo-600 hover:bg-indigo-500 transition-all">
          Salva modifiche
        </button>
      </div>
    </div>
  );
}

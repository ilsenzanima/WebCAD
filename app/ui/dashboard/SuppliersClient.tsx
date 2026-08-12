"use client";

import { useState, useTransition, useMemo } from "react";
import Link from "next/link";
import { type Supplier, type Store } from "@/lib/types/database";
import { createSupplier, updateSupplier, deleteSupplier } from "@/app/actions/suppliers";
import { formatCurrency, toLocalDateStr } from "@/lib/format";
import { EditIcon, DeleteIcon, SettingsIcon } from "./icons";

interface SuppliersClientProps {
  initialSuppliers: Supplier[];
  expenses: any[];
  stores: Store[];
}

export default function SuppliersClient({ initialSuppliers, expenses, stores }: SuppliersClientProps) {
  const [suppliers, setSuppliers] = useState<Supplier[]>(initialSuppliers);
  const [isPending, startTransition] = useTransition();
  const storeName = (id: string | null) => stores.find((s) => s.id === id)?.name || null;

  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [isUtility, setIsUtility] = useState(false);
  const [consumptionUnit, setConsumptionUnit] = useState("kWh");
  const [isActive, setIsActive] = useState(true);
  const [contractClosedAt, setContractClosedAt] = useState("");
  const [storeId, setStoreId] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const resetForm = () => {
    setName("");
    setNotes("");
    setIsUtility(false);
    setConsumptionUnit("kWh");
    setIsActive(true);
    setContractClosedAt("");
    setStoreId("");
    setEditingId(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert("Inserisci il nome del fornitore");
      return;
    }

    startTransition(async () => {
      try {
        if (editingId) {
          const res = await updateSupplier(editingId, {
            name: name.trim(),
            notes: notes.trim(),
            is_utility: isUtility,
            consumption_unit: consumptionUnit,
            is_active: isActive,
            contract_closed_at: contractClosedAt || null,
            store_id: storeId || null,
          });
          if (!res.success) {
            alert(res.error || "Errore durante la modifica");
            return;
          }
          setSuppliers(prev =>
            prev.map(s => (s.id === editingId ? {
              ...s,
              name: name.trim(),
              description: notes.trim() || null,
              is_utility: isUtility,
              consumption_unit: isUtility ? consumptionUnit : null,
              is_active: isActive,
              contract_closed_at: isActive ? null : (contractClosedAt || null),
              store_id: storeId || null,
            } : s))
          );
        } else {
          const res = await createSupplier({
            name: name.trim(),
            notes: notes.trim(),
            is_utility: isUtility,
            consumption_unit: consumptionUnit,
            store_id: storeId || null,
          });
          if (!res.success || !res.data) {
            alert(res.error || "Errore durante la creazione");
            return;
          }
          setSuppliers(prev => [...prev, res.data]);
        }
        resetForm();
      } catch (err: any) {
        alert(err.message || "Si è verificato un errore");
      }
    });
  };

  const handleEdit = (sup: Supplier, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(sup.id);
    setName(sup.name);
    setNotes(sup.description || "");
    setIsUtility(sup.is_utility);
    setConsumptionUnit(sup.consumption_unit || "kWh");
    setIsActive(sup.is_active);
    setContractClosedAt(sup.contract_closed_at || "");
    setStoreId(sup.store_id || "");
  };

  const handleToggleActive = (sup: Supplier, e: React.MouseEvent) => {
    e.stopPropagation();
    const nextActive = !sup.is_active;
    const closedAt = nextActive ? null : toLocalDateStr();

    startTransition(async () => {
      try {
        const res = await updateSupplier(sup.id, {
          name: sup.name,
          notes: sup.description || "",
          is_utility: sup.is_utility,
          consumption_unit: sup.consumption_unit,
          is_active: nextActive,
          contract_closed_at: closedAt,
          store_id: sup.store_id,
        });
        if (!res.success) {
          alert(res.error || "Errore durante l'aggiornamento");
          return;
        }
        setSuppliers(prev => prev.map(s => s.id === sup.id ? { ...s, is_active: nextActive, contract_closed_at: closedAt } : s));
      } catch (err: any) {
        alert(err.message || "Errore durante l'aggiornamento");
      }
    });
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Sei sicuro di voler eliminare questo fornitore?")) return;

    startTransition(async () => {
      try {
        const res = await deleteSupplier(id);
        if (!res.success) {
          alert(res.error || "Errore durante l'eliminazione");
          return;
        }
        setSuppliers(prev => prev.filter(s => s.id !== id));
      } catch (err: any) {
        alert(err.message || "Errore durante l'eliminazione");
      }
    });
  };

  // Calcolo statistiche per fornitore
  const supplierStats = useMemo(() => {
    const map: Record<string, { totalAmount: number; count: number; lastDate: string | null; dates: string[] }> = {};

    expenses.forEach(exp => {
      if (!exp.supplier_id || exp.is_income) return;
      if (!map[exp.supplier_id]) {
        map[exp.supplier_id] = { totalAmount: 0, count: 0, lastDate: null, dates: [] };
      }
      map[exp.supplier_id].totalAmount += Number(exp.amount);
      map[exp.supplier_id].count += 1;
      map[exp.supplier_id].dates.push(exp.date);

      if (!map[exp.supplier_id].lastDate || exp.date > map[exp.supplier_id].lastDate!) {
        map[exp.supplier_id].lastDate = exp.date;
      }
    });

    return map;
  }, [expenses]);

  // Calcolo stima frequenza d'arrivo bollette
  const getFrequencyLabel = (dates: string[]) => {
    if (dates.length < 2) return "Occasionale";
    const sorted = [...dates].sort();
    let totalDays = 0;
    for (let i = 1; i < sorted.length; i++) {
      const d1 = new Date(sorted[i - 1]).getTime();
      const d2 = new Date(sorted[i]).getTime();
      totalDays += (d2 - d1) / (1000 * 3600 * 24);
    }
    const avgDays = totalDays / (sorted.length - 1);

    if (avgDays <= 12) return "Settimanale";
    if (avgDays <= 45) return "Mensile";
    if (avgDays <= 75) return "Bimestrale";
    if (avgDays <= 120) return "Trimestrale";
    if (avgDays <= 220) return "Semestrale";
    return "Annuale";
  };

  const filteredSuppliers = suppliers.filter(s =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (s.description && s.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="p-4 md:p-8 space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="animate-fade-in flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
            Gestione Fornitori
          </h1>
          <p className="text-sm text-slate-400 mt-1">Monitora i tuoi gestori, l'arrivo delle bollette e le loro schede dedicate.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Form Creazione / Modifica */}
        <div
          className="rounded-2xl p-6 border relative overflow-hidden group shadow-2xl backdrop-blur-xl animate-fade-in h-fit"
          style={{
            background: "linear-gradient(135deg, hsla(200, 60%, 15%, 0.08), hsla(240, 10%, 10%, 0.7))",
            borderColor: "hsla(200, 60%, 50%, 0.15)",
          }}
        >
          <div className="absolute top-[-30%] right-[-20%] w-40 h-40 rounded-full bg-sky-500/5 blur-[50px] pointer-events-none" />

          <h2 className="text-base font-extrabold bg-gradient-to-r from-white to-zinc-300 bg-clip-text text-transparent mb-5 tracking-tight flex items-center gap-2">
            <span>⚡</span> {editingId ? "Modifica Fornitore" : "Nuovo Fornitore"}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4 relative z-10">
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Nome Fornitore / Servizio</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="es. Enel Energia, Fastweb, Netflix, Assicurazione Auto"
                required
                className="w-full px-4 py-3 rounded-xl text-xs text-white focus:outline-none transition-all duration-200 border"
                style={{
                  background: "hsl(240 10% 4% / 0.8)",
                  borderColor: "hsl(240 5% 18%)",
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = "hsl(200 85% 55%)";
                  e.target.style.boxShadow = "0 0 15px rgba(14,165,233,0.15)";
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = "hsl(240 5% 18%)";
                  e.target.style.boxShadow = "none";
                }}
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Note / Dettagli opzionali</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="es. Codice cliente, POD/PDR, o note di contratto"
                className="w-full px-4 py-3 rounded-xl text-xs text-white focus:outline-none transition-all duration-200 border"
                style={{
                  background: "hsl(240 10% 4% / 0.8)",
                  borderColor: "hsl(240 5% 18%)",
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = "hsl(200 85% 55%)";
                  e.target.style.boxShadow = "0 0 15px rgba(14,165,233,0.15)";
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = "hsl(240 5% 18%)";
                  e.target.style.boxShadow = "none";
                }}
              />
            </div>

            {/* Negozio collegato */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Negozio collegato (opzionale)</label>
              <select
                value={storeId}
                onChange={(e) => setStoreId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-[10px] text-white bg-zinc-950 border border-zinc-800 focus:outline-none"
              >
                <option value="">Nessuno</option>
                {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <p className="text-[9px] text-zinc-500">Collegando un Negozio (dalla vetrina/lista della spesa) vedrai qui il totale speso e potrai registrarci direttamente le spese fatte con la lista della spesa.</p>
            </div>

            {/* Utenza / consumi */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-2 text-[10px] font-bold text-zinc-400 uppercase tracking-wider cursor-pointer">
                <input
                  type="checkbox"
                  checked={isUtility}
                  onChange={(e) => setIsUtility(e.target.checked)}
                  className="accent-sky-500"
                />
                È un'utenza (luce, gas, acqua...)
              </label>
              {isUtility && (
                <select
                  value={consumptionUnit}
                  onChange={(e) => setConsumptionUnit(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-[10px] text-white bg-zinc-950 border border-zinc-800 focus:outline-none animate-fade-in"
                >
                  <option value="kWh">kWh (luce)</option>
                  <option value="m³">m³ (gas/acqua)</option>
                  <option value="L">Litri</option>
                  <option value="GB">GB (dati)</option>
                </select>
              )}
            </div>

            {/* Stato contratto (solo in modifica) */}
            {editingId && (
              <div className="space-y-1.5 animate-fade-in">
                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Stato Contratto</label>
                <div className="flex gap-2 p-1 bg-zinc-950/60 border border-white/5 rounded-xl text-[10px] font-bold">
                  <button
                    type="button"
                    onClick={() => { setIsActive(true); setContractClosedAt(""); }}
                    className="flex-1 py-2 rounded-lg transition-all"
                    style={{
                      background: isActive ? "hsla(150, 70%, 45%, 0.15)" : "transparent",
                      color: isActive ? "hsl(150 70% 60%)" : "hsl(240 5% 55%)",
                    }}
                  >
                    ✅ Attivo
                  </button>
                  <button
                    type="button"
                    onClick={() => { setIsActive(false); if (!contractClosedAt) setContractClosedAt(toLocalDateStr()); }}
                    className="flex-1 py-2 rounded-lg transition-all"
                    style={{
                      background: !isActive ? "hsla(0, 70%, 55%, 0.12)" : "transparent",
                      color: !isActive ? "hsl(0 70% 65%)" : "hsl(240 5% 55%)",
                    }}
                  >
                    ⛔ Chiuso
                  </button>
                </div>
                {!isActive && (
                  <input
                    type="date"
                    value={contractClosedAt}
                    onChange={(e) => setContractClosedAt(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-[10px] text-white bg-zinc-950 border border-zinc-800 focus:outline-none animate-fade-in"
                  />
                )}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="flex-1 py-3 rounded-xl text-xs font-bold text-slate-300 hover:text-white transition-all border border-zinc-800"
                  style={{ background: "hsl(240 10% 15%)" }}
                >
                  Annulla
                </button>
              )}
              <button
                type="submit"
                disabled={isPending}
                className="flex-1 py-3 rounded-xl text-xs font-extrabold text-white transition-all shadow-[0_0_20px_rgba(14,165,233,0.15)] hover:shadow-[0_0_30px_rgba(14,165,233,0.3)] active:scale-98"
                style={{
                  background: "linear-gradient(135deg, hsl(200 85% 55%), hsl(210 75% 45%))",
                  cursor: isPending ? "not-allowed" : "pointer",
                }}
              >
                {isPending ? "Salvataggio..." : editingId ? "Salva Modifiche" : "Crea Fornitore"}
              </button>
            </div>
          </form>
        </div>

        {/* Lista Fornitori in Card Grid (2 Colonne) */}
        <div className="lg:col-span-2 space-y-4">
          
          {/* Campo di ricerca */}
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cerca fornitore per nome o codice..."
              className="w-full px-4 py-3 rounded-xl text-xs text-white focus:outline-none border transition-all"
              style={{
                background: "hsl(240 10% 4% / 0.6)",
                borderColor: "hsl(240 5% 15% / 0.8)",
              }}
              onFocus={(e) => e.target.style.borderColor = "hsl(240 5% 35%)"}
              onBlur={(e) => e.target.style.borderColor = "hsl(240 5% 15% / 0.8)"}
            />
          </div>

          {filteredSuppliers.length === 0 ? (
            <div className="rounded-2xl p-12 border text-center text-slate-500 bg-zinc-950/40 border-zinc-800/60">
              <span className="text-3xl block mb-2">🏢</span>
              <p className="text-xs">Nessun fornitore registrato. Aggiungi il tuo primo fornitore dal modulo a sinistra.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {filteredSuppliers.map((sup) => {
                const stats = supplierStats[sup.id] || { totalAmount: 0, count: 0, lastDate: null, dates: [] };
                const freqLabel = getFrequencyLabel(stats.dates);

                return (
                  <div
                    key={sup.id}
                    className="rounded-2xl p-5 border flex flex-col justify-between space-y-4 shadow-xl relative overflow-hidden group backdrop-blur-xl transition-all duration-300 hover:border-sky-500/30 hover:shadow-[0_0_25px_rgba(14,165,233,0.1)]"
                    style={{
                      background: "linear-gradient(135deg, hsla(240, 10%, 12%, 0.6), hsla(240, 10%, 10%, 0.8))",
                      borderColor: "hsla(240, 5%, 18%, 0.7)",
                    }}
                  >
                    <div>
                      {/* Top Header Card */}
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="text-sm font-extrabold text-white group-hover:text-sky-300 transition-colors">
                            {sup.name}
                          </h3>
                          {sup.description && (
                            <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">{sup.description}</p>
                          )}
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {sup.is_utility && (
                              <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-sky-500/10 text-sky-400 border border-sky-500/20">
                                ⚡ Utenza {sup.consumption_unit ? `(${sup.consumption_unit})` : ""}
                              </span>
                            )}
                            {storeName(sup.store_id) && (
                              <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-violet-500/10 text-violet-300 border border-violet-500/20">
                                🏬 {storeName(sup.store_id)}
                              </span>
                            )}
                            <button
                              onClick={(e) => handleToggleActive(sup, e)}
                              className={`px-1.5 py-0.5 rounded text-[8px] font-bold border transition-all ${
                                sup.is_active
                                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20"
                                  : "bg-zinc-800 text-zinc-500 border-zinc-700 hover:bg-zinc-700"
                              }`}
                              title="Clicca per cambiare stato contratto"
                            >
                              {sup.is_active ? "✅ Attivo" : `⛔ Chiuso${sup.contract_closed_at ? ` (${new Date(sup.contract_closed_at).toLocaleDateString("it-IT")})` : ""}`}
                            </button>
                          </div>
                        </div>

                        {/* Azioni rapide Modifica/Elimina */}
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => handleEdit(sup, e)}
                            className="p-1 rounded text-slate-400 hover:text-sky-300 hover:bg-sky-500/10 transition-all"
                            title="Modifica"
                          >
                            <EditIcon size={12} />
                          </button>
                          <button
                            onClick={(e) => handleDelete(sup.id, e)}
                            className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-all"
                            title="Elimina"
                          >
                            <DeleteIcon size={12} />
                          </button>
                        </div>
                      </div>

                      {/* Statistiche Sintetiche */}
                      <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-zinc-800/60">
                        <div>
                          <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest block">Spesa Storica</span>
                          <span className="text-xs font-black text-white">{formatCurrency(stats.totalAmount)}</span>
                        </div>
                        <div>
                          <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest block">Freq. Bollette</span>
                          <span className="text-[10px] font-bold text-sky-400">{freqLabel}</span>
                        </div>
                      </div>
                    </div>

                    {/* Bottone Scheda Dettagliata */}
                    <Link
                      href={`/dashboard/suppliers/${sup.id}`}
                      className="w-full py-2.5 rounded-xl text-[10px] font-extrabold text-center text-white bg-zinc-900 border border-zinc-800 hover:border-sky-500/40 hover:bg-sky-500/10 hover:text-sky-300 transition-all flex items-center justify-center gap-2 mt-2"
                    >
                      <span>📊 Scheda & Bollette</span>
                    </Link>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

"use client";

import { useState, useTransition, useMemo, useEffect } from "react";
import Link from "next/link";
import { type Supplier, type Store, type SupplierLocation } from "@/lib/types/database";
import { createSupplier, updateSupplier, deleteSupplier } from "@/app/actions/suppliers";
import { formatCurrency, toLocalDateStr } from "@/lib/format";
import { EditIcon, DeleteIcon, SettingsIcon } from "./icons";
import PaginationControls from "./PaginationControls";

interface SuppliersClientProps {
  initialSuppliers: Supplier[];
  expenses: any[];
  stores: Store[];
  locations: SupplierLocation[];
}

const PAGE_SIZE = 50;

type SupplierSortKey = "name" | "count" | "last" | "total";

function SortArrow({ active, dir }: { active: boolean; dir: "asc" | "desc" }) {
  if (!active) return <span className="opacity-30">↕</span>;
  return <span>{dir === "asc" ? "↑" : "↓"}</span>;
}

export default function SuppliersClient({ initialSuppliers, expenses, stores, locations }: SuppliersClientProps) {
  const [suppliers, setSuppliers] = useState<Supplier[]>(initialSuppliers);
  const [isPending, startTransition] = useTransition();
  const storeName = (id: string | null) => stores.find((s) => s.id === id)?.name || null;

  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [isUtility, setIsUtility] = useState(false);
  const [consumptionUnit, setConsumptionUnit] = useState("kWh");
  const [isActive, setIsActive] = useState(true);
  const [contractClosedAt, setContractClosedAt] = useState("");
  const [storeId, setStoreId] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "utility" | "other">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "closed">("all");
  const [sortKey, setSortKey] = useState<SupplierSortKey>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);

  const locationCount = useMemo(() => {
    const map: Record<string, number> = {};
    locations.forEach(l => { map[l.supplier_id] = (map[l.supplier_id] || 0) + 1; });
    return map;
  }, [locations]);

  const resetForm = () => {
    setName("");
    setNotes("");
    setIsUtility(false);
    setConsumptionUnit("kWh");
    setIsActive(true);
    setContractClosedAt("");
    setStoreId("");
    setEditingId(null);
    setShowModal(false);
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
    setShowModal(true);
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
      if (!exp.supplier_id) return;
      if (!map[exp.supplier_id]) {
        map[exp.supplier_id] = { totalAmount: 0, count: 0, lastDate: null, dates: [] };
      }
      // I rimborsi collegati al fornitore (entrate) vengono sottratti dal totale speso,
      // cosi' il numero mostrato riflette quanto realmente speso al netto dei resi.
      if (exp.is_income) {
        map[exp.supplier_id].totalAmount -= Number(exp.amount);
        return;
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

  const hasActiveFilters = typeFilter !== "all" || statusFilter !== "all" || searchQuery !== "";
  const resetFilters = () => {
    setTypeFilter("all");
    setStatusFilter("all");
    setSearchQuery("");
  };
  const toggleSort = (key: SupplierSortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir(key === "name" ? "asc" : "desc");
    }
  };

  const filteredSuppliers = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return suppliers.filter(s => {
      const matchSearch = !q || s.name.toLowerCase().includes(q) || (s.description && s.description.toLowerCase().includes(q));
      const matchType = typeFilter === "all" || (typeFilter === "utility" ? s.is_utility : !s.is_utility);
      const matchStatus = statusFilter === "all" || (statusFilter === "active" ? s.is_active : !s.is_active);
      return matchSearch && matchType && matchStatus;
    });
  }, [suppliers, searchQuery, typeFilter, statusFilter]);

  const sortedSuppliers = useMemo(() => {
    const value = (s: Supplier): string | number => {
      const st = supplierStats[s.id];
      if (sortKey === "count") return st?.count || 0;
      if (sortKey === "total") return st?.totalAmount || 0;
      if (sortKey === "last") return st?.lastDate || "";
      return s.name.toLowerCase();
    };
    return [...filteredSuppliers].sort((a, b) => {
      const va = value(a);
      const vb = value(b);
      const cmp = va < vb ? -1 : va > vb ? 1 : a.name.localeCompare(b.name, "it");
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filteredSuppliers, supplierStats, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sortedSuppliers.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedSuppliers = useMemo(
    () => sortedSuppliers.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [sortedSuppliers, currentPage]
  );

  useEffect(() => { setPage(1); }, [searchQuery, typeFilter, statusFilter, sortKey, sortDir]);

  return (
    <div className="p-4 md:p-8 space-y-6 w-full">
      {/* Header */}
      <div className="animate-fade-in flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
            Gestione Fornitori
          </h1>
          <p className="text-sm text-slate-400 mt-1">Monitora i tuoi gestori, l'arrivo delle bollette e le loro schede dedicate.</p>
        </div>
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="px-4 py-2.5 rounded-xl text-xs font-extrabold text-white transition-all shadow-lg active:scale-98 flex items-center gap-2 flex-shrink-0"
          style={{ background: "linear-gradient(135deg, hsl(200 85% 55%), hsl(210 75% 45%))" }}
        >
          <span>＋</span> Nuovo Fornitore
        </button>
      </div>

      {/* Campo di ricerca */}
      <div className="flex flex-col sm:flex-row gap-3 animate-fade-in">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Cerca fornitore per nome o codice..."
          className="flex-1 px-4 py-3 rounded-xl text-xs text-white focus:outline-none border transition-all"
          style={{
            background: "hsl(240 10% 4% / 0.6)",
            borderColor: "hsl(240 5% 15% / 0.8)",
          }}
          onFocus={(e) => e.target.style.borderColor = "hsl(240 5% 35%)"}
          onBlur={(e) => e.target.style.borderColor = "hsl(240 5% 15% / 0.8)"}
        />
        {hasActiveFilters && (
          <button
            type="button"
            onClick={resetFilters}
            className="px-4 py-3 rounded-xl text-xs font-bold text-zinc-300 border border-white/10 hover:bg-white/5 transition-all whitespace-nowrap"
          >
            ✕ Azzera filtri
          </button>
        )}
      </div>

      {filteredSuppliers.length === 0 ? (
        <div className="rounded-2xl p-12 border text-center text-slate-500 bg-zinc-950/40 border-zinc-800/60">
          <span className="text-3xl block mb-2">🏢</span>
          <p className="text-xs">{hasActiveFilters ? "Nessun fornitore corrisponde ai filtri." : "Nessun fornitore registrato. Aggiungilo con il pulsante \"Nuovo Fornitore\"."}</p>
        </div>
      ) : (
        <div className="rounded-2xl border shadow-xl animate-fade-in overflow-x-auto" style={{ background: "hsla(240, 10%, 8%, 0.5)", borderColor: "hsla(240, 5%, 18%, 0.7)" }}>
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b" style={{ borderColor: "hsl(240 5% 18% / 0.7)" }}>
                <th className="p-4 pb-3.5 align-top font-bold text-slate-400 uppercase tracking-wider text-[9px]">
                  <button type="button" onClick={() => toggleSort("name")} className="inline-flex items-center gap-1 uppercase hover:text-white transition-colors">
                    Fornitore <SortArrow active={sortKey === "name"} dir={sortDir} />
                  </button>
                </th>
                <th className="pr-3 pb-3.5 pt-4 align-top font-bold text-slate-400 uppercase tracking-wider text-[9px]">
                  <div className="flex flex-col gap-1.5 items-start">
                    <span>Tipo</span>
                    <select
                      value={typeFilter}
                      onChange={(e) => setTypeFilter(e.target.value as "all" | "utility" | "other")}
                      aria-label="Filtra per tipo"
                      className="px-2 py-1 rounded-lg text-[10px] font-semibold normal-case tracking-normal text-white focus:outline-none border"
                      style={{ background: "hsl(240 10% 4% / 0.6)", borderColor: typeFilter === "all" ? "hsl(240 5% 15% / 0.8)" : "hsl(240 5% 45%)" }}
                    >
                      <option value="all">Tutti</option>
                      <option value="utility" style={{ background: "hsl(240 10% 10%)" }}>Utenze</option>
                      <option value="other" style={{ background: "hsl(240 10% 10%)" }}>Altri</option>
                    </select>
                  </div>
                </th>
                <th className="pr-3 pb-3.5 pt-4 align-top font-bold text-slate-400 uppercase tracking-wider text-[9px]">
                  <div className="flex flex-col gap-1.5 items-start">
                    <span>Stato</span>
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value as "all" | "active" | "closed")}
                      aria-label="Filtra per stato"
                      className="px-2 py-1 rounded-lg text-[10px] font-semibold normal-case tracking-normal text-white focus:outline-none border"
                      style={{ background: "hsl(240 10% 4% / 0.6)", borderColor: statusFilter === "all" ? "hsl(240 5% 15% / 0.8)" : "hsl(240 5% 45%)" }}
                    >
                      <option value="all">Tutti</option>
                      <option value="active" style={{ background: "hsl(240 10% 10%)" }}>Attivi</option>
                      <option value="closed" style={{ background: "hsl(240 10% 10%)" }}>Chiusi</option>
                    </select>
                  </div>
                </th>
                <th className="pr-3 pb-3.5 pt-4 align-top font-bold text-slate-400 uppercase tracking-wider text-[9px]">Sedi</th>
                <th className="pr-3 pb-3.5 pt-4 align-top font-bold text-slate-400 uppercase tracking-wider text-[9px] text-right">
                  <button type="button" onClick={() => toggleSort("count")} className="inline-flex items-center gap-1 uppercase hover:text-white transition-colors">
                    Acquisti <SortArrow active={sortKey === "count"} dir={sortDir} />
                  </button>
                </th>
                <th className="pr-3 pb-3.5 pt-4 align-top font-bold text-slate-400 uppercase tracking-wider text-[9px]">
                  <button type="button" onClick={() => toggleSort("last")} className="inline-flex items-center gap-1 uppercase hover:text-white transition-colors">
                    Ultimo <SortArrow active={sortKey === "last"} dir={sortDir} />
                  </button>
                </th>
                <th className="pr-3 pb-3.5 pt-4 align-top font-bold text-slate-400 uppercase tracking-wider text-[9px]">Frequenza</th>
                <th className="pr-3 pb-3.5 pt-4 align-top font-bold text-slate-400 uppercase tracking-wider text-[9px] text-right">
                  <button type="button" onClick={() => toggleSort("total")} className="inline-flex items-center gap-1 uppercase hover:text-white transition-colors">
                    Spesa storica <SortArrow active={sortKey === "total"} dir={sortDir} />
                  </button>
                </th>
                <th className="pr-4 pb-3.5 pt-4 align-top font-bold text-slate-400 uppercase tracking-wider text-[9px] text-center">Azioni</th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: "hsl(240 5% 18% / 0.3)" }}>
              {pagedSuppliers.map((sup) => {
                const stats = supplierStats[sup.id] || { totalAmount: 0, count: 0, lastDate: null, dates: [] };
                const sedi = locationCount[sup.id] || 0;
                return (
                  <tr key={sup.id} className="hover:bg-white/[0.03] transition-all duration-150">
                    <td className="p-4 align-top">
                      <Link href={`/dashboard/suppliers/${sup.id}`} className="text-white font-bold hover:text-sky-300 transition-colors">
                        {sup.name}
                      </Link>
                      {sup.description && (
                        <div className="text-[10px] text-slate-400 mt-0.5 max-w-[240px] truncate">{sup.description}</div>
                      )}
                      {storeName(sup.store_id) && (
                        <span className="inline-block mt-1 px-1.5 py-0.5 rounded text-[8px] font-bold bg-violet-500/10 text-violet-300 border border-violet-500/20">
                          🏬 {storeName(sup.store_id)}
                        </span>
                      )}
                    </td>
                    <td className="pr-3 py-4 align-top">
                      {sup.is_utility ? (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-sky-500/10 text-sky-400 border border-sky-500/20 whitespace-nowrap">
                          ⚡ Utenza{sup.consumption_unit ? ` (${sup.consumption_unit})` : ""}
                        </span>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                    <td className="pr-3 py-4 align-top">
                      <button
                        type="button"
                        onClick={(e) => handleToggleActive(sup, e)}
                        className={`px-1.5 py-0.5 rounded text-[9px] font-bold border transition-all whitespace-nowrap ${
                          sup.is_active
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20"
                            : "bg-zinc-800 text-zinc-500 border-zinc-700 hover:bg-zinc-700"
                        }`}
                        title="Clicca per cambiare stato contratto"
                      >
                        {sup.is_active ? "✅ Attivo" : `⛔ Chiuso${sup.contract_closed_at ? ` (${new Date(sup.contract_closed_at).toLocaleDateString("it-IT")})` : ""}`}
                      </button>
                    </td>
                    <td className="pr-3 py-4 align-top text-slate-300 whitespace-nowrap">
                      {sedi > 0 ? `📍 ${sedi}` : <span className="text-slate-600">—</span>}
                    </td>
                    <td className="pr-3 py-4 align-top text-right text-slate-300 font-semibold">{stats.count}</td>
                    <td className="pr-3 py-4 align-top text-slate-300 whitespace-nowrap">
                      {stats.lastDate ? new Date(stats.lastDate).toLocaleDateString("it-IT") : <span className="text-slate-600">—</span>}
                    </td>
                    <td className="pr-3 py-4 align-top text-sky-400 font-bold whitespace-nowrap">{stats.count > 0 ? getFrequencyLabel(stats.dates) : <span className="text-slate-600">—</span>}</td>
                    <td className="pr-3 py-4 align-top text-right text-white font-black whitespace-nowrap">{formatCurrency(stats.totalAmount)}</td>
                    <td className="pr-4 py-4 align-top">
                      <div className="flex items-center justify-center gap-1">
                        <Link
                          href={`/dashboard/suppliers/${sup.id}`}
                          className="px-2 py-1 rounded-lg text-[10px] font-bold text-slate-300 border border-zinc-800 hover:border-sky-500/40 hover:text-sky-300 transition-all whitespace-nowrap"
                          title="Scheda e bollette"
                        >
                          📊 Scheda
                        </Link>
                        <button
                          type="button"
                          onClick={(e) => handleEdit(sup, e)}
                          className="p-1.5 rounded text-slate-400 hover:text-sky-300 hover:bg-sky-500/10 transition-all"
                          title="Modifica"
                        >
                          <EditIcon size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleDelete(sup.id, e)}
                          className="p-1.5 rounded text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-all"
                          title="Elimina"
                        >
                          <DeleteIcon size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <PaginationControls
        page={currentPage}
        totalPages={totalPages}
        onPageChange={setPage}
        totalItems={sortedSuppliers.length}
        itemLabel="fornitori"
      />

      {/* Modale Nuovo/Modifica Fornitore */}
      {showModal && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4 animate-fade-in overflow-y-auto"
          onClick={resetForm}
        >
          <div
            className="relative w-full max-w-lg my-8 rounded-2xl p-6 border shadow-2xl backdrop-blur-xl animate-fade-in max-h-[90vh] overflow-y-auto"
            style={{ background: "linear-gradient(135deg, hsla(200, 60%, 15%, 0.1), hsla(240, 10%, 10%, 0.97))", borderColor: "hsla(200, 60%, 50%, 0.15)" }}
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

            <h2 className="text-base font-extrabold text-white mb-4 flex items-center gap-2">
              <span>⚡</span> {editingId ? "Modifica Fornitore" : "Nuovo Fornitore"}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-3">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nome Fornitore / Servizio (es. Enel Energia, Netflix...)"
                required
                className="w-full px-4 py-3 rounded-xl text-xs text-white border border-zinc-800 bg-zinc-950/80"
              />

              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Note / Dettagli opzionali (es. Codice cliente, POD/PDR)"
                className="w-full px-4 py-3 rounded-xl text-xs text-white border border-zinc-800 bg-zinc-950/80"
              />

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
                <p className="text-[9px] text-zinc-500">Collegando un Negozio vedrai qui il totale speso e potrai registrarci direttamente le spese fatte con la lista della spesa.</p>
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

              <button
                type="submit"
                disabled={isPending}
                className="w-full py-3 rounded-xl text-xs font-extrabold text-white transition-all shadow-[0_0_20px_rgba(14,165,233,0.15)] hover:shadow-[0_0_30px_rgba(14,165,233,0.3)] active:scale-98"
                style={{
                  background: "linear-gradient(135deg, hsl(200 85% 55%), hsl(210 75% 45%))",
                  cursor: isPending ? "not-allowed" : "pointer",
                }}
              >
                {isPending ? "Salvataggio..." : editingId ? "Salva Modifiche" : "Crea Fornitore"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

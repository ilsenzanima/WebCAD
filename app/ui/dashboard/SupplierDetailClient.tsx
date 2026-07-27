"use client";

import { useState, useTransition, useMemo } from "react";
import Link from "next/link";
import { type Supplier, type SupplierDocument } from "@/lib/types/database";
import { createSupplierDocument, deleteSupplierDocument } from "@/app/actions/documents";
import { DeleteIcon, ExpensesIcon, SchedulesIcon } from "./icons";

interface SupplierDetailClientProps {
  supplier: Supplier;
  expenses: any[];
  schedules: any[];
  documents: SupplierDocument[];
}

export default function SupplierDetailClient({
  supplier,
  expenses,
  schedules,
  documents: initialDocuments,
}: SupplierDetailClientProps) {
  const [documents, setDocuments] = useState<SupplierDocument[]>(initialDocuments);
  const [isPending, startTransition] = useTransition();

  // Form nuovo documento
  const [docTitle, setDocTitle] = useState("");
  const [docUrl, setDocUrl] = useState("");
  const [docProvider, setDocProvider] = useState<"local" | "gdrive" | "onedrive">("local");

  const resetDocForm = () => {
    setDocTitle("");
    setDocUrl("");
    setDocProvider("local");
  };

  const handleAddDocument = (e: React.FormEvent) => {
    e.preventDefault();
    if (!docTitle.trim() || !docUrl.trim()) {
      alert("Inserisci titolo e link/URL del documento");
      return;
    }

    startTransition(async () => {
      try {
        const res = await createSupplierDocument({
          supplier_id: supplier.id,
          title: docTitle.trim(),
          file_url: docUrl.trim(),
          provider: docProvider,
        });

        if (!res.success || !res.data) {
          alert(res.error || "Errore nel salvataggio del documento");
          return;
        }

        setDocuments(prev => [res.data, ...prev]);
        resetDocForm();
      } catch (err: any) {
        alert(err.message || "Errore durante il salvataggio");
      }
    });
  };

  const handleDeleteDocument = (id: string) => {
    if (!confirm("Sei sicuro di voler eliminare questo documento allegato?")) return;

    startTransition(async () => {
      try {
        const res = await deleteSupplierDocument(id, supplier.id);
        if (!res.success) {
          alert(res.error || "Errore durante l'eliminazione");
          return;
        }
        setDocuments(prev => prev.filter(d => d.id !== id));
      } catch (err: any) {
        alert(err.message || "Errore durante l'eliminazione");
      }
    });
  };

  // Statistiche fornitore
  const stats = useMemo(() => {
    const totalAmount = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
    const count = expenses.length;
    const avgAmount = count > 0 ? totalAmount / count : 0;

    // Frequenza stimata dai giorni medi tra le transazioni
    const allDates = [...expenses.map(e => e.date), ...schedules.map(s => s.due_date)].filter(Boolean).sort();
    let frequencyLabel = "In attesa di dati";
    let avgDaysBetween = 0;

    if (allDates.length >= 2) {
      let totalDays = 0;
      for (let i = 1; i < allDates.length; i++) {
        const d1 = new Date(allDates[i - 1]).getTime();
        const d2 = new Date(allDates[i]).getTime();
        totalDays += Math.abs(d2 - d1) / (1000 * 3600 * 24);
      }
      avgDaysBetween = Math.round(totalDays / (allDates.length - 1));

      if (avgDaysBetween <= 12) frequencyLabel = `Settimanale (~${avgDaysBetween} gg)`;
      else if (avgDaysBetween <= 45) frequencyLabel = `Mensile (~${avgDaysBetween} gg)`;
      else if (avgDaysBetween <= 75) frequencyLabel = `Bimestrale (~${avgDaysBetween} gg)`;
      else if (avgDaysBetween <= 120) frequencyLabel = `Trimestrale (~${avgDaysBetween} gg)`;
      else if (avgDaysBetween <= 220) frequencyLabel = `Semestrale (~${avgDaysBetween} gg)`;
      else frequencyLabel = `Annuale (~${avgDaysBetween} gg)`;
    } else if (allDates.length === 1) {
      frequencyLabel = "Una sola registrazione";
    }

    // Prossima scadenza
    const upcomingSchedules = schedules
      .filter(s => !s.is_paid && new Date(s.due_date) >= new Date())
      .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
    const nextSchedule = upcomingSchedules[0] || null;

    return { totalAmount, count, avgAmount, frequencyLabel, nextSchedule };
  }, [expenses, schedules]);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(val);
  };

  return (
    <div className="p-4 md:p-8 space-y-8 max-w-7xl mx-auto">
      
      {/* Header & Torna ai Fornitori */}
      <div className="animate-fade-in space-y-3">
        <Link
          href="/dashboard/suppliers"
          className="inline-flex items-center gap-2 text-xs font-extrabold text-sky-400 hover:text-sky-300 transition-colors"
        >
          <span>←</span> Torna alla lista Fornitori
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
              {supplier.name}
            </h1>
            {supplier.notes && (
              <p className="text-sm text-slate-400 mt-1">{supplier.notes}</p>
            )}
          </div>
        </div>
      </div>

      {/* KPI Cards Dettagliate */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 animate-fade-in">
        
        {/* Totale Speso */}
        <div
          className="rounded-2xl p-5 border relative overflow-hidden group shadow-[0_0_20px_rgba(244,63,94,0.02)]"
          style={{
            background: "linear-gradient(135deg, hsla(350, 60%, 15%, 0.05), hsla(240, 10%, 10%, 0.6))",
            borderColor: "hsla(350, 60%, 50%, 0.12)",
          }}
        >
          <div className="absolute top-[-30%] right-[-20%] w-32 h-32 rounded-full bg-rose-500/5 blur-[40px]" />
          <h4 className="text-[10px] font-bold text-rose-400 uppercase tracking-widest">Totale Speso Storico</h4>
          <p className="text-2xl font-black text-white mt-2">{formatCurrency(stats.totalAmount)}</p>
          <div className="text-[9px] text-slate-500 mt-1 font-semibold">{stats.count} spese registrate</div>
        </div>

        {/* Importo Medio per Bolletta */}
        <div
          className="rounded-2xl p-5 border relative overflow-hidden group shadow-[0_0_20px_rgba(14,165,233,0.02)]"
          style={{
            background: "linear-gradient(135deg, hsla(200, 60%, 15%, 0.05), hsla(240, 10%, 10%, 0.6))",
            borderColor: "hsla(200, 60%, 50%, 0.12)",
          }}
        >
          <div className="absolute top-[-30%] right-[-20%] w-32 h-32 rounded-full bg-sky-500/5 blur-[40px]" />
          <h4 className="text-[10px] font-bold text-sky-400 uppercase tracking-widest">Media per Bolletta</h4>
          <p className="text-2xl font-black text-white mt-2">{formatCurrency(stats.avgAmount)}</p>
          <div className="text-[9px] text-slate-500 mt-1 font-semibold">Media spesa per singola transazione</div>
        </div>

        {/* Frequenza Stimata */}
        <div
          className="rounded-2xl p-5 border relative overflow-hidden group shadow-[0_0_20px_rgba(168,85,247,0.02)]"
          style={{
            background: "linear-gradient(135deg, hsla(270, 60%, 15%, 0.05), hsla(240, 10%, 10%, 0.6))",
            borderColor: "hsla(270, 60%, 50%, 0.12)",
          }}
        >
          <div className="absolute top-[-30%] right-[-20%] w-32 h-32 rounded-full bg-purple-500/5 blur-[40px]" />
          <h4 className="text-[10px] font-bold text-purple-400 uppercase tracking-widest">Frequenza Arrivo Bollette</h4>
          <p className="text-lg font-black text-white mt-2">{stats.frequencyLabel}</p>
          <div className="text-[9px] text-slate-500 mt-1 font-semibold">Intervallo calcolato in automatico</div>
        </div>

        {/* Prossima Scadenza */}
        <div
          className="rounded-2xl p-5 border relative overflow-hidden group shadow-[0_0_20px_rgba(245,158,11,0.02)]"
          style={{
            background: "linear-gradient(135deg, hsla(38, 60%, 15%, 0.05), hsla(240, 10%, 10%, 0.6))",
            borderColor: "hsla(38, 60%, 50%, 0.12)",
          }}
        >
          <div className="absolute top-[-30%] right-[-20%] w-32 h-32 rounded-full bg-amber-500/5 blur-[40px]" />
          <h4 className="text-[10px] font-bold text-amber-400 uppercase tracking-widest">Prossima Scadenza</h4>
          <p className="text-lg font-black text-white mt-2">
            {stats.nextSchedule 
              ? new Date(stats.nextSchedule.due_date).toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" })
              : "Nessuna"
            }
          </p>
          <div className="text-[9px] text-slate-500 mt-1 font-semibold">
            {stats.nextSchedule ? formatCurrency(stats.nextSchedule.amount) : "Nessun pagamento programmato"}
          </div>
        </div>

      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Storico Transazioni & Scadenze per questo Fornitore (2 Colonne) */}
        <div
          className="lg:col-span-2 rounded-2xl p-6 border flex flex-col space-y-5 shadow-2xl relative overflow-hidden group backdrop-blur-xl animate-fade-in"
          style={{
            background: "linear-gradient(135deg, hsla(240, 10%, 12%, 0.5), hsla(240, 10%, 10%, 0.8))",
            borderColor: "hsla(240, 5%, 18%, 0.7)",
          }}
        >
          <div className="absolute top-[-30%] left-[-20%] w-60 h-60 rounded-full bg-zinc-500/5 blur-[80px] pointer-events-none" />

          <h3 className="text-sm font-extrabold text-white tracking-wide">
            📜 Storico Spese e Scadenze del Fornitore
          </h3>

          <div className="flex-1 overflow-x-auto pr-1 relative z-10 max-h-[400px] overflow-y-auto">
            {expenses.length === 0 && schedules.length === 0 ? (
              <p className="text-xs text-slate-500 py-12 text-center">Nessuna spesa o scadenza collegata a questo fornitore.</p>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b" style={{ borderColor: "hsl(240 5% 18% / 0.7)" }}>
                    <th className="pb-3 font-bold text-slate-400 uppercase tracking-wider text-[9px]">Data / Scadenza</th>
                    <th className="pb-3 font-bold text-slate-400 uppercase tracking-wider text-[9px]">Tipo & Categoria</th>
                    <th className="pb-3 font-bold text-slate-400 uppercase tracking-wider text-[9px]">Note / Dettaglio</th>
                    <th className="pb-3 font-bold text-slate-400 uppercase tracking-wider text-[9px] text-right">Importo</th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: "hsl(240 5% 18% / 0.3)" }}>
                  {expenses.map((e) => (
                    <tr key={`exp-${e.id}`} className="hover:bg-white/2 transition-colors duration-150">
                      <td className="py-3 text-slate-300 font-semibold whitespace-nowrap">
                        {new Date(e.date).toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" })}
                      </td>
                      <td className="py-3">
                        <span className="px-2 py-0.5 rounded text-[8px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                          Spesa Effettuata
                        </span>
                      </td>
                      <td className="py-3 text-white font-medium max-w-[180px] truncate">
                        {e.description || "Nessuna nota"}
                      </td>
                      <td className="py-3 text-right font-black text-rose-400">
                        -{formatCurrency(e.amount)}
                      </td>
                    </tr>
                  ))}
                  {schedules.map((s) => (
                    <tr key={`sch-${s.id}`} className="hover:bg-white/2 transition-colors duration-150">
                      <td className="py-3 text-slate-300 font-semibold whitespace-nowrap">
                        {new Date(s.due_date).toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" })}
                      </td>
                      <td className="py-3">
                        <span className={`px-2 py-0.5 rounded text-[8px] font-bold border ${
                          s.is_paid
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                            : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                        }`}>
                          {s.is_paid ? "Scadenza Saldata" : "In Scadenza"}
                        </span>
                      </td>
                      <td className="py-3 text-white font-medium max-w-[180px] truncate">
                        {s.description || "Pagamento programmato"}
                      </td>
                      <td className="py-3 text-right font-black text-amber-400">
                        {formatCurrency(s.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Gestione Allegati & Bollette PDF (1 Colonna) */}
        <div
          className="rounded-2xl p-6 border shadow-2xl relative overflow-hidden group backdrop-blur-xl animate-fade-in flex flex-col space-y-5"
          style={{
            background: "linear-gradient(135deg, hsla(200, 60%, 15%, 0.08), hsla(240, 10%, 10%, 0.7))",
            borderColor: "hsla(200, 60%, 50%, 0.15)",
          }}
        >
          <div className="absolute top-[-30%] right-[-20%] w-40 h-40 rounded-full bg-sky-500/5 blur-[50px] pointer-events-none" />

          <h3 className="text-sm font-extrabold text-white tracking-wide flex items-center gap-2">
            <span>📎</span> Bollette & Documenti PDF
          </h3>

          {/* Form Aggiungi Documento / Link Drive */}
          <form onSubmit={handleAddDocument} className="space-y-3 relative z-10 border-b border-zinc-800 pb-4">
            <div className="space-y-1">
              <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-wider">Titolo Bolletta / Documento</label>
              <input
                type="text"
                value={docTitle}
                onChange={(e) => setDocTitle(e.target.value)}
                placeholder="es. Bolletta Luce Luglio 2026"
                required
                className="w-full px-3 py-2 rounded-xl text-xs text-white focus:outline-none border border-zinc-800 bg-zinc-950/80"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-wider">Link File / URL (Drive / OneDrive)</label>
              <input
                type="url"
                value={docUrl}
                onChange={(e) => setDocUrl(e.target.value)}
                placeholder="https://drive.google.com/... o https://1drv.ms/..."
                required
                className="w-full px-3 py-2 rounded-xl text-xs text-white focus:outline-none border border-zinc-800 bg-zinc-950/80"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-wider">Piattaforma Cloud</label>
              <select
                value={docProvider}
                onChange={(e) => setDocProvider(e.target.value as any)}
                className="w-full px-3 py-2 rounded-xl text-xs text-white focus:outline-none border border-zinc-800 bg-zinc-950/80"
              >
                <option value="local">Link Diretto / Web</option>
                <option value="gdrive">Google Drive</option>
                <option value="onedrive">Microsoft OneDrive</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="w-full py-2.5 rounded-xl text-xs font-extrabold text-white bg-sky-600 hover:bg-sky-500 transition-all shadow-[0_0_15px_rgba(14,165,233,0.2)] mt-1"
            >
              {isPending ? "Salvataggio..." : "Collega Bolletta / PDF"}
            </button>
          </form>

          {/* Elenco Documenti Allegati */}
          <div className="flex-1 space-y-2 overflow-y-auto max-h-[220px]">
            {documents.length === 0 ? (
              <p className="text-[11px] text-slate-500 text-center py-6">Nessuna bolletta allegata a questo fornitore.</p>
            ) : (
              documents.map((doc) => (
                <div
                  key={doc.id}
                  className="p-3 rounded-xl border border-zinc-800/80 bg-zinc-950/60 flex items-center justify-between gap-2 hover:border-sky-500/30 transition-all"
                >
                  <div className="truncate flex-1">
                    <span className="text-[11px] font-bold text-white block truncate">{doc.title}</span>
                    <span className="text-[8px] font-semibold text-sky-400 uppercase tracking-wider">
                      {doc.provider === "gdrive" ? "Google Drive" : doc.provider === "onedrive" ? "OneDrive" : "Link Web"}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <a
                      href={doc.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1 rounded-lg text-[9px] font-extrabold text-sky-300 bg-sky-500/10 border border-sky-500/20 hover:bg-sky-500/20 transition-all"
                    >
                      Apri
                    </a>
                    <button
                      onClick={() => handleDeleteDocument(doc.id)}
                      className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-all"
                      title="Elimina"
                    >
                      <DeleteIcon size={12} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

    </div>
  );
}

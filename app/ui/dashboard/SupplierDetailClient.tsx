"use client";

import { useState, useTransition, useMemo, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { type Supplier, type SupplierDocument } from "@/lib/types/database";
import { createSupplierDocument, deleteSupplierDocument } from "@/app/actions/documents";
import { updateSupplier } from "@/app/actions/suppliers";
import { uploadSupplierDocumentToDrive } from "@/app/actions/google";
import { formatCurrency, formatFileSize, formatDate } from "@/lib/format";
import { DeleteIcon, ExpensesIcon, SchedulesIcon } from "./icons";

interface SupplierDetailClientProps {
  supplier: Supplier;
  expenses: any[];
  schedules: any[];
  documents: SupplierDocument[];
  googleConnected: boolean;
}

export default function SupplierDetailClient({
  supplier,
  expenses,
  schedules,
  documents: initialDocuments,
  googleConnected,
}: SupplierDetailClientProps) {
  const [documents, setDocuments] = useState<SupplierDocument[]>(initialDocuments);
  const [supplierState, setSupplierState] = useState<Supplier>(supplier);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleToggleContract = () => {
    const nextActive = !supplierState.is_active;
    const closedAt = nextActive ? null : new Date().toISOString().split("T")[0];

    startTransition(async () => {
      try {
        const res = await updateSupplier(supplierState.id, {
          name: supplierState.name,
          notes: supplierState.description || "",
          is_utility: supplierState.is_utility,
          consumption_unit: supplierState.consumption_unit,
          is_active: nextActive,
          contract_closed_at: closedAt,
        });
        if (!res.success) {
          alert(res.error || "Errore durante l'aggiornamento del contratto");
          return;
        }
        setSupplierState(prev => ({ ...prev, is_active: nextActive, contract_closed_at: closedAt }));
      } catch (err: any) {
        alert(err.message || "Errore durante l'aggiornamento del contratto");
      }
    });
  };

  useEffect(() => {
    const googleError = searchParams.get("google_error");
    if (googleError) {
      alert(`Errore durante il collegamento a Google: ${googleError}`);
      router.replace(`/dashboard/suppliers/${supplier.id}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Form nuovo documento
  const [docTitle, setDocTitle] = useState("");
  const [docType, setDocType] = useState<"contratto" | "bolletta" | "altro">("bolletta");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [fileSize, setFileSize] = useState<number | null>(null);

  const resetDocForm = () => {
    setDocTitle("");
    setDocType("bolletta");
    setSelectedFile(null);
    setFileName("");
    setFileSize(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      alert("Il file supera la dimensione massima consigliata di 10MB");
      return;
    }

    setSelectedFile(file);
    setFileName(file.name);
    setFileSize(file.size);
    if (!docTitle) {
      setDocTitle(file.name.replace(/\.[^/.]+$/, ""));
    }
  };

  const handleAddDocument = (e: React.FormEvent) => {
    e.preventDefault();
    if (!docTitle.trim() || !selectedFile) {
      alert("Seleziona un file (PDF o immagine) da caricare");
      return;
    }
    if (!googleConnected) {
      alert("Collega prima il tuo account Google Drive per poter caricare la bolletta.");
      return;
    }

    startTransition(async () => {
      try {
        const uploadFormData = new FormData();
        uploadFormData.append("file", selectedFile);
        uploadFormData.append("fileName", `${supplier.name}_${docTitle.trim()}_${selectedFile.name}`);

        const driveRes = await uploadSupplierDocumentToDrive(uploadFormData);
        if (!driveRes.success || !driveRes.data) {
          alert(driveRes.error || "Errore durante il caricamento su Google Drive");
          return;
        }

        const finalFileUrl = driveRes.data.webViewLink || driveRes.data.webContentLink || `https://drive.google.com/file/d/${driveRes.data.id}/view`;

        const res = await createSupplierDocument({
          supplier_id: supplier.id,
          title: docTitle.trim(),
          file_url: finalFileUrl,
          provider: "gdrive",
          file_size: fileSize,
          doc_type: docType,
        });

        if (!res.success || !res.data) {
          alert(res.error || "Errore nel caricamento del documento");
          return;
        }

        setDocuments(prev => [res.data, ...prev]);
        resetDocForm();
      } catch (err: any) {
        alert(err.message || "Errore durante il caricamento");
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

    const upcomingSchedules = schedules
      .filter(s => !s.is_paid && new Date(s.due_date) >= new Date())
      .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
    const nextSchedule = upcomingSchedules[0] || null;

    // Consumi (solo se il fornitore e' un'utenza): media/ultimo consumo e costo per unita'
    const consumptionEntries = expenses
      .filter(e => e.consumption_value != null && Number(e.consumption_value) > 0)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const totalConsumption = consumptionEntries.reduce((sum, e) => sum + Number(e.consumption_value), 0);
    const totalAmountWithConsumption = consumptionEntries.reduce((sum, e) => sum + Number(e.amount), 0);
    const avgCostPerUnit = totalConsumption > 0 ? totalAmountWithConsumption / totalConsumption : 0;
    const lastConsumption = consumptionEntries.length > 0 ? consumptionEntries[consumptionEntries.length - 1] : null;
    const avgConsumption = consumptionEntries.length > 0 ? totalConsumption / consumptionEntries.length : 0;

    return {
      totalAmount, count, avgAmount, frequencyLabel, nextSchedule,
      consumptionEntries, avgCostPerUnit, lastConsumption, avgConsumption,
    };
  }, [expenses, schedules]);


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
            {supplier.description && (
              <p className="text-sm text-slate-400 mt-1">{supplier.description}</p>
            )}
            <div className="flex flex-wrap gap-2 mt-2">
              {supplierState.is_utility && (
                <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-sky-500/10 text-sky-400 border border-sky-500/20">
                  ⚡ Utenza {supplierState.consumption_unit ? `(${supplierState.consumption_unit})` : ""}
                </span>
              )}
              <button
                onClick={handleToggleContract}
                disabled={isPending}
                className={`px-2 py-0.5 rounded text-[9px] font-bold border transition-all ${
                  supplierState.is_active
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20"
                    : "bg-zinc-800 text-zinc-500 border-zinc-700 hover:bg-zinc-700"
                }`}
                title="Clicca per cambiare stato contratto"
              >
                {supplierState.is_active ? "✅ Contratto Attivo" : `⛔ Contratto Chiuso${supplierState.contract_closed_at ? ` (${new Date(supplierState.contract_closed_at).toLocaleDateString("it-IT")})` : ""}`}
              </button>
            </div>
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
              ? formatDate(stats.nextSchedule.due_date)
              : "Nessuna"
            }
          </p>
          <div className="text-[9px] text-slate-500 mt-1 font-semibold">
            {stats.nextSchedule ? formatCurrency(stats.nextSchedule.amount) : "Nessun pagamento programmato"}
          </div>
        </div>

        {/* Consumi (solo per fornitori di utenze) */}
        {supplierState.is_utility && (
          <div
            className="rounded-2xl p-5 border relative overflow-hidden group shadow-[0_0_20px_rgba(14,165,233,0.02)]"
            style={{
              background: "linear-gradient(135deg, hsla(200, 60%, 15%, 0.05), hsla(240, 10%, 10%, 0.6))",
              borderColor: "hsla(200, 60%, 50%, 0.12)",
            }}
          >
            <div className="absolute top-[-30%] right-[-20%] w-32 h-32 rounded-full bg-sky-500/5 blur-[40px]" />
            <h4 className="text-[10px] font-bold text-sky-400 uppercase tracking-widest">Costo per {supplierState.consumption_unit || "unità"}</h4>
            <p className="text-2xl font-black text-white mt-2">
              {stats.avgCostPerUnit > 0 ? `${stats.avgCostPerUnit.toFixed(3)} €` : "N/D"}
            </p>
            <div className="text-[9px] text-slate-500 mt-1 font-semibold">
              {stats.lastConsumption
                ? `Ultimo consumo: ${stats.lastConsumption.consumption_value} ${supplierState.consumption_unit || ""} (media ${stats.avgConsumption.toFixed(0)})`
                : "Nessun consumo registrato ancora"}
            </div>
          </div>
        )}

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
                    {supplierState.is_utility && (
                      <th className="pb-3 font-bold text-slate-400 uppercase tracking-wider text-[9px] text-right">Consumo</th>
                    )}
                    <th className="pb-3 font-bold text-slate-400 uppercase tracking-wider text-[9px] text-right">Importo</th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: "hsl(240 5% 18% / 0.3)" }}>
                  {expenses.map((e) => (
                    <tr key={`exp-${e.id}`} className="hover:bg-white/2 transition-colors duration-150">
                      <td className="py-3 text-slate-300 font-semibold whitespace-nowrap">
                        {formatDate(e.date)}
                      </td>
                      <td className="py-3">
                        <span className="px-2 py-0.5 rounded text-[8px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                          Spesa Effettuata
                        </span>
                      </td>
                      <td className="py-3 text-white font-medium max-w-[180px] truncate">
                        {e.description || "Nessuna nota"}
                      </td>
                      {supplierState.is_utility && (
                        <td className="py-3 text-right text-slate-400 font-semibold whitespace-nowrap">
                          {e.consumption_value != null ? `${e.consumption_value} ${supplierState.consumption_unit || ""}` : "—"}
                        </td>
                      )}
                      <td className="py-3 text-right font-black text-rose-400">
                        -{formatCurrency(e.amount)}
                      </td>
                    </tr>
                  ))}
                  {schedules.map((s) => (
                    <tr key={`sch-${s.id}`} className="hover:bg-white/2 transition-colors duration-150">
                      <td className="py-3 text-slate-300 font-semibold whitespace-nowrap">
                        {formatDate(s.due_date)}
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
                      {supplierState.is_utility && <td className="py-3 text-right text-slate-600">—</td>}
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

        {/* Gestione Allegati & Caricamento su Google Drive (1 Colonna) */}
        <div
          className="rounded-2xl p-6 border shadow-2xl relative overflow-hidden group backdrop-blur-xl animate-fade-in flex flex-col space-y-5"
          style={{
            background: "linear-gradient(135deg, hsla(200, 60%, 15%, 0.08), hsla(240, 10%, 10%, 0.7))",
            borderColor: "hsla(200, 60%, 50%, 0.15)",
          }}
        >
          <div className="absolute top-[-30%] right-[-20%] w-40 h-40 rounded-full bg-sky-500/5 blur-[50px] pointer-events-none" />

          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-white tracking-wide flex items-center gap-2">
              <span>📄</span> Carica Bolletta PDF
            </h3>
            <a
              href="https://drive.google.com/drive/folders/1fgA-JTpfzPRIlJ8xJeQ95Grxi6hVUnB9"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[9px] font-extrabold text-sky-400 hover:text-sky-300 transition-colors flex items-center gap-1 bg-sky-500/10 border border-sky-500/20 px-2 py-1 rounded-lg"
              title="Apri cartella radice Google Drive"
            >
              <span>📁 Google Drive</span>
            </a>
          </div>

          {/* Avviso collegamento Google mancante */}
          {!googleConnected && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[10px] text-amber-300 space-y-2 relative z-10">
              <p className="font-semibold">Collega il tuo account Google per caricare le bollette su Drive e sincronizzare le scadenze su Calendar.</p>
              <a
                href={`/api/google/connect?next=/dashboard/suppliers/${supplier.id}`}
                className="block text-center w-full py-2 rounded-lg text-[10px] font-extrabold text-white bg-amber-600 hover:bg-amber-500 transition-all"
              >
                🔗 Collega account Google
              </a>
            </div>
          )}

          {/* Form Caricamento Diretto File */}
          <form onSubmit={handleAddDocument} className="space-y-3 relative z-10 border-b border-zinc-800 pb-4">

            {/* Input Seleziona File */}
            <div className="space-y-1">
              <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-wider">Seleziona File dal Dispositivo</label>
              <input
                type="file"
                accept="application/pdf,image/*"
                onChange={handleFileChange}
                required
                className="w-full px-3 py-2 rounded-xl text-xs text-slate-300 focus:outline-none border border-zinc-800 bg-zinc-950/80 file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-[10px] file:font-bold file:bg-sky-500/20 file:text-sky-300 hover:file:bg-sky-500/30 cursor-pointer"
              />
            </div>

            {/* Nome/Titolo Bolletta */}
            <div className="space-y-1">
              <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-wider">Titolo / Descrizione Bolletta</label>
              <input
                type="text"
                value={docTitle}
                onChange={(e) => setDocTitle(e.target.value)}
                placeholder="es. Bolletta Luce Luglio 2026"
                required
                className="w-full px-3 py-2 rounded-xl text-xs text-white focus:outline-none border border-zinc-800 bg-zinc-950/80"
              />
            </div>

            {/* Tipo Documento */}
            <div className="space-y-1">
              <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-wider">Tipo Documento</label>
              <select
                value={docType}
                onChange={(e) => setDocType(e.target.value as any)}
                className="w-full px-3 py-2 rounded-xl text-xs text-white focus:outline-none border border-zinc-800 bg-zinc-950/80"
              >
                <option value="bolletta">📄 Bolletta / Ricevuta</option>
                <option value="contratto">📑 Contratto</option>
                <option value="altro">📎 Altro</option>
              </select>
            </div>

            {fileName && (
              <div className="p-2 rounded-lg bg-sky-500/10 border border-sky-500/20 text-[10px] text-sky-300 flex items-center justify-between font-semibold">
                <span className="truncate max-w-[180px]">📎 {fileName}</span>
                <span>{formatFileSize(fileSize)}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isPending || !selectedFile || !googleConnected}
              className="w-full py-2.5 rounded-xl text-xs font-extrabold text-white bg-sky-600 hover:bg-sky-500 transition-all shadow-[0_0_15px_rgba(14,165,233,0.2)] mt-1 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPending ? "Caricamento in corso..." : "Carica su Google Drive"}
            </button>
          </form>

          {/* Elenco Documenti Caricati */}
          <div className="flex-1 space-y-2 overflow-y-auto max-h-[240px]">
            {documents.length === 0 ? (
              <p className="text-[11px] text-slate-500 text-center py-6">Nessuna bolletta o PDF caricato per questo fornitore.</p>
            ) : (
              documents.map((doc) => (
                <div
                  key={doc.id}
                  className="p-3 rounded-xl border border-zinc-800/80 bg-zinc-950/60 flex items-center justify-between gap-2 hover:border-sky-500/30 transition-all"
                >
                  <div className="truncate flex-1">
                    <span className="text-[11px] font-bold text-white block truncate">
                      {doc.doc_type === "contratto" ? "📑" : doc.doc_type === "bolletta" ? "📄" : "📎"} {doc.title}
                    </span>
                    <span className="text-[8px] font-semibold text-sky-400 uppercase tracking-wider">
                      {doc.provider === "gdrive" ? "📁 Google Drive" : "💾 Storage Locale"} {formatFileSize(doc.file_size)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <a
                      href={doc.file_url}
                      target="_blank"
                      download={doc.title}
                      rel="noopener noreferrer"
                      className="px-2.5 py-1 rounded-lg text-[9px] font-extrabold text-sky-300 bg-sky-500/10 border border-sky-500/20 hover:bg-sky-500/20 transition-all flex items-center gap-1"
                    >
                      <span>👁️ Apri</span>
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

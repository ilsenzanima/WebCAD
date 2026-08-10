"use client";

import { useState, useTransition, useMemo } from "react";
import { type Supplier, type ExpenseCategory } from "@/lib/types/database";
import { assignScansioneDocument } from "@/app/actions/google";
import { createSupplier } from "@/app/actions/suppliers";
import { formatFileSize, toLocalDateStr } from "@/lib/format";
import { monthInputToDate, syncPeriodEnd } from "@/lib/period";
import { InboxIcon } from "./icons";

interface ScanDocument {
  id: string;
  name: string;
  mimeType: string;
  size: number | null;
  createdTime: string | null;
  previewUrl: string;
  webViewLink: string;
}

interface ScansioniClientProps {
  initialDocuments: ScanDocument[];
  suppliers: Supplier[];
  categories: ExpenseCategory[];
  googleConnected: boolean;
  loadError: string | null;
  scansioniFolderUrl: string;
}

const currentYear = new Date().getFullYear();

function stripExtension(name: string) {
  return name.replace(/\.[^/.]+$/, "");
}

export default function ScansioniClient({
  initialDocuments,
  suppliers,
  categories,
  googleConnected,
  loadError,
  scansioniFolderUrl,
}: ScansioniClientProps) {
  const [documents, setDocuments] = useState<ScanDocument[]>(initialDocuments);
  const [suppliersList, setSuppliersList] = useState<Supplier[]>(suppliers);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [supplierId, setSupplierId] = useState("");
  const [year, setYear] = useState(String(currentYear));
  const [docType, setDocType] = useState<"contratto" | "bolletta" | "altro">("bolletta");
  const [title, setTitle] = useState("");
  const [titleTouched, setTitleTouched] = useState(false);

  // Dati finanziari facoltativi: se inserisci un importo, in base al check "Pagato"
  // viene creata una Spesa (gia' pagata) o una Scadenza (da saldare) collegata al documento.
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState(categories[0]?.id || "");
  const [consumptionValue, setConsumptionValue] = useState("");
  const [periodStartInput, setPeriodStartInput] = useState("");
  const [periodEndInput, setPeriodEndInput] = useState("");
  const [isPaid, setIsPaid] = useState(true);
  const [date, setDate] = useState(toLocalDateStr());

  const handlePeriodStartChange = (value: string) => {
    setPeriodEndInput(prev => syncPeriodEnd(value, periodStartInput, prev));
    setPeriodStartInput(value);
  };

  const [showNewSupplier, setShowNewSupplier] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState("");

  const total = documents.length;
  const current = documents[currentIndex] || null;
  const selectedSupplier = suppliersList.find((s) => s.id === supplierId) || null;

  const resetFormFor = (doc: ScanDocument | null) => {
    setSupplierId("");
    setYear(String(currentYear));
    setDocType("bolletta");
    setTitle(doc ? stripExtension(doc.name) : "");
    setTitleTouched(false);
    setAmount("");
    setCategoryId(categories[0]?.id || "");
    setConsumptionValue("");
    setPeriodStartInput("");
    setPeriodEndInput("");
    setIsPaid(true);
    setDate(toLocalDateStr());
    setShowNewSupplier(false);
    setNewSupplierName("");
    setError(null);
  };

  const goTo = (index: number) => {
    if (total === 0) return;
    const clamped = ((index % total) + total) % total;
    setCurrentIndex(clamped);
    resetFormFor(documents[clamped]);
  };

  const effectiveTitle = useMemo(() => {
    if (titleTouched) return title;
    return current ? stripExtension(current.name) : title;
  }, [titleTouched, title, current]);

  const handleCreateSupplier = () => {
    if (!newSupplierName.trim()) return;
    startTransition(async () => {
      const res = await createSupplier({ name: newSupplierName.trim() });
      if (!res.success || !res.data) {
        setError(res.error || "Errore durante la creazione del fornitore");
        return;
      }
      setSuppliersList((prev) => [...prev, res.data].sort((a, b) => a.name.localeCompare(b.name)));
      setSupplierId(res.data.id);
      setShowNewSupplier(false);
      setNewSupplierName("");
    });
  };

  const handleAssign = () => {
    if (!current) return;
    if (!supplierId) {
      setError("Seleziona il fornitore a cui appartiene questo documento");
      return;
    }
    const yearNum = Number(year);
    if (!yearNum || yearNum < 1900) {
      setError("Inserisci un anno valido");
      return;
    }
    const supplier = suppliersList.find((s) => s.id === supplierId);
    if (!supplier) {
      setError("Fornitore non valido");
      return;
    }
    const amountNum = amount.trim() ? Number(amount) : null;
    if (amount.trim() && (isNaN(amountNum as number) || (amountNum as number) <= 0)) {
      setError("Inserisci un importo valido");
      return;
    }
    if (amountNum && !date) {
      setError("Inserisci una data di pagamento o di scadenza");
      return;
    }
    const consumptionNum = consumptionValue.trim() ? Number(consumptionValue) : null;
    if (consumptionValue.trim() && (isNaN(consumptionNum as number) || (consumptionNum as number) < 0)) {
      setError("Inserisci un consumo valido");
      return;
    }

    setError(null);
    const docBeingAssigned = current;
    const category = categories.find((c) => c.id === categoryId);

    startTransition(async () => {
      const res = await assignScansioneDocument({
        fileId: docBeingAssigned.id,
        fileSize: docBeingAssigned.size,
        supplierId: supplier.id,
        supplierName: supplier.name,
        year: yearNum,
        title: effectiveTitle.trim() || stripExtension(docBeingAssigned.name),
        docType,
        amount: amountNum,
        categoryId: amountNum ? categoryId || null : null,
        categoryName: category?.name || "Generica",
        consumptionValue: consumptionNum,
        periodStart: monthInputToDate(periodStartInput),
        periodEnd: monthInputToDate(periodEndInput || periodStartInput),
        isPaid,
        date: amountNum ? date : null,
      });

      if (!res.success) {
        setError(res.error || "Errore durante l'assegnazione del documento");
        return;
      }

      setDocuments((prev) => {
        const next = prev.filter((d) => d.id !== docBeingAssigned.id);
        const nextIndex = Math.min(currentIndex, Math.max(next.length - 1, 0));
        resetFormFor(next[nextIndex] || null);
        setCurrentIndex(next.length > 0 ? nextIndex : 0);
        return next;
      });
    });
  };

  if (!googleConnected) {
    return (
      <div className="p-4 md:p-8 max-w-2xl mx-auto">
        <div className="p-6 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-200 space-y-3">
          <h2 className="text-sm font-extrabold text-white">Collega Google Drive per smistare i documenti</h2>
          <p className="text-xs">Per leggere e organizzare i documenti nella cartella "Scansioni" devi prima collegare il tuo account Google.</p>
          <a
            href="/api/google/connect?next=/dashboard/scansioni"
            className="inline-block py-2 px-4 rounded-lg text-[11px] font-extrabold text-white bg-amber-600 hover:bg-amber-500 transition-all"
          >
            🔗 Collega account Google
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-extrabold text-white flex items-center gap-2">
            <InboxIcon size={18} /> Smistamento Scansioni
          </h1>
          <p className="text-xs text-zinc-500 mt-1">
            Assegna ogni documento a un fornitore: verrà spostato su Drive in <span className="text-zinc-400 font-semibold">Fornitore / Anno</span> e rimosso dalla cartella Scansioni.
          </p>
        </div>
        <a
          href={scansioniFolderUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[9px] font-extrabold text-sky-400 hover:text-sky-300 transition-colors flex items-center gap-1 bg-sky-500/10 border border-sky-500/20 px-2 py-1 rounded-lg"
        >
          📁 Apri cartella Scansioni
        </a>
      </div>

      {loadError && (
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-[11px] text-rose-300">
          {loadError}
        </div>
      )}

      {total === 0 ? (
        <div className="p-10 rounded-2xl border border-zinc-800 bg-zinc-950/60 text-center space-y-2">
          <div className="text-3xl">🎉</div>
          <p className="text-sm font-bold text-white">Nessun documento da smistare</p>
          <p className="text-xs text-zinc-500">La cartella Scansioni è vuota. Aggiungi nuove scansioni lì e torna qui per organizzarle.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Anteprima documento corrente */}
          <div className="lg:col-span-3 rounded-2xl border border-zinc-800 bg-zinc-950/60 overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
              <span className="text-[11px] font-bold text-white truncate max-w-[70%]" title={current?.name}>
                📄 {current?.name}
              </span>
              <span className="text-[9px] font-extrabold text-zinc-500 uppercase tracking-wider whitespace-nowrap">
                Documento {currentIndex + 1} di {total}
              </span>
            </div>
            {current && (
              <iframe
                key={current.id}
                src={current.previewUrl}
                className="w-full flex-1 min-h-[420px] bg-zinc-900"
                allow="autoplay"
              />
            )}
            <div className="px-4 py-2 border-t border-zinc-800 flex items-center justify-between gap-2">
              <button
                onClick={() => goTo(currentIndex - 1)}
                disabled={total <= 1}
                className="px-3 py-1.5 rounded-lg text-[10px] font-extrabold text-zinc-300 bg-zinc-900 border border-zinc-800 hover:border-zinc-600 transition-all disabled:opacity-40"
              >
                ← Precedente
              </button>
              <a
                href={current?.webViewLink}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[9px] font-extrabold text-sky-400 hover:text-sky-300"
              >
                Apri a schermo intero ↗
              </a>
              <button
                onClick={() => goTo(currentIndex + 1)}
                disabled={total <= 1}
                className="px-3 py-1.5 rounded-lg text-[10px] font-extrabold text-zinc-300 bg-zinc-900 border border-zinc-800 hover:border-zinc-600 transition-all disabled:opacity-40"
              >
                Successivo →
              </button>
            </div>
          </div>

          {/* Form assegnazione */}
          <div className="lg:col-span-2 rounded-2xl p-5 border border-zinc-800 bg-zinc-950/60 space-y-4 h-fit">
            <h3 className="text-xs font-extrabold text-white uppercase tracking-wide">Assegna a un fornitore</h3>

            {error && (
              <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-[10px] text-rose-300">
                {error}
              </div>
            )}

            <div className="space-y-1">
              <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-wider">Fornitore</label>
              {!showNewSupplier ? (
                <div className="flex gap-2">
                  <select
                    value={supplierId}
                    onChange={(e) => setSupplierId(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-xl text-xs text-white focus:outline-none border border-zinc-800 bg-zinc-900"
                  >
                    <option value="">Seleziona fornitore...</option>
                    {suppliersList.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setShowNewSupplier(true)}
                    className="px-3 py-2 rounded-xl text-[10px] font-extrabold text-sky-300 bg-sky-500/10 border border-sky-500/20 hover:bg-sky-500/20 transition-all whitespace-nowrap"
                  >
                    + Nuovo
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    type="text"
                    autoFocus
                    value={newSupplierName}
                    onChange={(e) => setNewSupplierName(e.target.value)}
                    placeholder="Nome nuovo fornitore"
                    className="flex-1 px-3 py-2 rounded-xl text-xs text-white focus:outline-none border border-zinc-800 bg-zinc-900"
                  />
                  <button
                    type="button"
                    onClick={handleCreateSupplier}
                    disabled={isPending || !newSupplierName.trim()}
                    className="px-3 py-2 rounded-xl text-[10px] font-extrabold text-white bg-emerald-600 hover:bg-emerald-500 transition-all disabled:opacity-50"
                  >
                    Crea
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowNewSupplier(false); setNewSupplierName(""); }}
                    className="px-2 py-2 rounded-xl text-[10px] font-extrabold text-zinc-400 bg-zinc-900 border border-zinc-800"
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-wider">Anno documento</label>
                <input
                  type="number"
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  min={1990}
                  max={currentYear + 1}
                  className="w-full px-3 py-2 rounded-xl text-xs text-white focus:outline-none border border-zinc-800 bg-zinc-900"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-wider">Tipo documento</label>
                <select
                  value={docType}
                  onChange={(e) => setDocType(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl text-xs text-white focus:outline-none border border-zinc-800 bg-zinc-900"
                >
                  <option value="bolletta">📄 Bolletta</option>
                  <option value="contratto">📑 Contratto</option>
                  <option value="altro">📎 Altro</option>
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-wider">Titolo</label>
              <input
                type="text"
                value={effectiveTitle}
                onChange={(e) => { setTitle(e.target.value); setTitleTouched(true); }}
                className="w-full px-3 py-2 rounded-xl text-xs text-white focus:outline-none border border-zinc-800 bg-zinc-900"
              />
            </div>

            <div className="border-t border-zinc-800 pt-3 space-y-3">
              <p className="text-[9px] text-zinc-500">Facoltativo: inserisci l'importo per registrare subito anche la Spesa o la Scadenza collegata a questo documento.</p>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-wider">Importo (€)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="es. 85.50"
                    className="w-full px-3 py-2 rounded-xl text-xs text-white focus:outline-none border border-zinc-800 bg-zinc-900"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-wider">Categoria</label>
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl text-xs text-white focus:outline-none border border-zinc-800 bg-zinc-900"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {selectedSupplier?.is_utility && (
                <div className="space-y-1">
                  <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-wider">
                    Consumo del periodo ({selectedSupplier.consumption_unit || "unità"})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={consumptionValue}
                    onChange={(e) => setConsumptionValue(e.target.value)}
                    placeholder={`es. 320 ${selectedSupplier.consumption_unit || ""}`}
                    className="w-full px-3 py-2 rounded-xl text-xs text-white focus:outline-none border border-zinc-800 bg-zinc-900"
                  />
                </div>
              )}

              {selectedSupplier?.is_utility && (
                <div className="space-y-1">
                  <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-wider">Periodo di copertura (mese singolo o più mesi)</label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="month"
                      value={periodStartInput}
                      onChange={(e) => handlePeriodStartChange(e.target.value)}
                      className="flex-1 px-2.5 py-2 rounded-xl text-xs text-white focus:outline-none border border-zinc-800 bg-zinc-900"
                    />
                    <span className="text-[9px] text-zinc-500">al</span>
                    <input
                      type="month"
                      value={periodEndInput}
                      min={periodStartInput || undefined}
                      disabled={!periodStartInput}
                      onChange={(e) => setPeriodEndInput(e.target.value)}
                      className="flex-1 px-2.5 py-2 rounded-xl text-xs text-white focus:outline-none border border-zinc-800 bg-zinc-900 disabled:opacity-40"
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2">
                <input
                  id="scansioni-paid"
                  type="checkbox"
                  checked={isPaid}
                  onChange={(e) => setIsPaid(e.target.checked)}
                  className="w-3.5 h-3.5 rounded accent-emerald-500"
                />
                <label htmlFor="scansioni-paid" className="text-[10px] font-bold text-zinc-300">Pagato</label>
              </div>

              <div className="space-y-1">
                <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-wider">
                  {isPaid ? "Data pagamento" : "Data di scadenza"}
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-xs text-white focus:outline-none border border-zinc-800 bg-zinc-900"
                />
                <p className="text-[8px] text-zinc-600">
                  {isPaid ? "Verrà creata una Spesa già registrata." : "Verrà creata una Scadenza da saldare."}
                </p>
              </div>
            </div>

            {current?.size != null && (
              <p className="text-[9px] text-zinc-500">Dimensione file: {formatFileSize(current.size)}</p>
            )}

            <button
              onClick={handleAssign}
              disabled={isPending || !supplierId}
              className="w-full py-2.5 rounded-xl text-xs font-extrabold text-white bg-sky-600 hover:bg-sky-500 transition-all shadow-[0_0_15px_rgba(14,165,233,0.2)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPending ? "Assegnazione in corso..." : "✓ Assegna e archivia"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { type Account, type Supplier, type ExpenseCategory, type BankStatementImport, type Expense } from "@/lib/types/database";
import { type ReconciledLine, type ReconciliationStatus } from "@/lib/bankReconciliation";
import {
  importBankStatement,
  getBankStatementImports,
  getReconciliationForImport,
  confirmLineMatch,
  correctExpenseAmountAndConfirm,
  splitReviewDifferenceAsFee,
  unmatchLine,
  ignoreStatementLine,
  restoreStatementLine,
  createExpenseFromStatementLine,
  linkSupplierAccountCode,
  markCodeWithoutSupplier,
  deleteBankStatementImport,
} from "@/app/actions/bankReconciliation";
import { formatCurrency, formatDate } from "@/lib/format";

interface ReconciliationClientProps {
  initialAccounts: Account[];
  suppliers: Supplier[];
  categories: ExpenseCategory[];
  initialImports: BankStatementImport[];
}

interface ReconciliationData {
  import: BankStatementImport;
  reconciled: ReconciledLine[];
  unmatchedExpenses: Expense[];
}

const STATUS_META: Record<ReconciliationStatus, { label: string; badge: string; dot: string }> = {
  confirmed: { label: "Confermato", badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", dot: "bg-emerald-400" },
  review: { label: "Da verificare", badge: "bg-amber-500/10 text-amber-400 border-amber-500/20", dot: "bg-amber-400" },
  missing: { label: "Non trovato", badge: "bg-rose-500/10 text-rose-400 border-rose-500/20", dot: "bg-rose-400" },
  new_code: { label: "Nuovo codice", badge: "bg-sky-500/10 text-sky-400 border-sky-500/20", dot: "bg-sky-400" },
  autobook: { label: "Da registrare", badge: "bg-zinc-800 text-zinc-400 border-zinc-700", dot: "bg-zinc-500" },
  ignored: { label: "Ignorato", badge: "bg-zinc-900 text-zinc-600 border-zinc-800", dot: "bg-zinc-600" },
};

function daysBetweenLocal(a: string, b: string): number {
  return Math.round(Math.abs(new Date(`${a}T00:00:00`).getTime() - new Date(`${b}T00:00:00`).getTime()) / 86400000);
}

export default function ReconciliationClient({ initialAccounts, suppliers, categories, initialImports }: ReconciliationClientProps) {
  const [accounts] = useState<Account[]>(initialAccounts);
  const [imports, setImports] = useState<BankStatementImport[]>(initialImports);
  const [selectedAccountId, setSelectedAccountId] = useState<string>(
    initialAccounts.find((a) => a.is_default)?.id || initialAccounts[0]?.id || ""
  );
  const [data, setData] = useState<ReconciliationData | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isImporting, setIsImporting] = useState(false);
  const [tab, setTab] = useState<"all" | "confirmed" | "attention">("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expenseFormLineId, setExpenseFormLineId] = useState<string | null>(null);
  const [linkFormLineId, setLinkFormLineId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const suppliersById = useMemo(() => new Map(suppliers.map((s) => [s.id, s] as const)), [suppliers]);

  const importsForAccount = useMemo(
    () => imports.filter((i) => i.account_id === selectedAccountId).sort((a, b) => b.created_at.localeCompare(a.created_at)),
    [imports, selectedAccountId]
  );

  async function loadReconciliation(importId: string) {
    const res = await getReconciliationForImport(importId);
    if (!res.success || !res.data) {
      alert(res.error || "Errore nel caricamento della riconciliazione");
      return;
    }
    setData(res.data);
  }

  useEffect(() => {
    setData(null);
    const latest = importsForAccount[0];
    if (latest) loadReconciliation(latest.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAccountId]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !selectedAccountId) return;

    const csvText = await file.text();
    setIsImporting(true);
    try {
      const res = await importBankStatement({ account_id: selectedAccountId, file_name: file.name, csv_text: csvText });
      if (!res.success || !res.data) {
        alert(res.error || "Errore durante l'importazione");
        return;
      }
      const refreshedImports = await getBankStatementImports();
      setImports(refreshedImports);
      await loadReconciliation(res.data.importId);
    } finally {
      setIsImporting(false);
    }
  };

  const handleDeleteImport = () => {
    if (!data) return;
    if (!confirm("Eliminare questa importazione e tutti i suoi movimenti? Le spese eventualmente create restano, ma perdono il collegamento.")) return;
    startTransition(async () => {
      const res = await deleteBankStatementImport(data.import.id);
      if (!res.success) {
        alert(res.error || "Errore durante l'eliminazione");
        return;
      }
      setImports((prev) => prev.filter((i) => i.id !== data.import.id));
      setData(null);
    });
  };

  const withReload = (fn: () => Promise<{ success: boolean; error?: string }>) => {
    startTransition(async () => {
      const res = await fn();
      if (!res.success) {
        alert(res.error || "Si è verificato un errore");
        return;
      }
      if (data) await loadReconciliation(data.import.id);
    });
  };

  const summary = useMemo(() => {
    const counts: Partial<Record<ReconciliationStatus, number>> = {};
    (data?.reconciled || []).forEach((r) => { counts[r.status] = (counts[r.status] || 0) + 1; });
    return counts;
  }, [data]);

  const visibleLines = useMemo(() => {
    if (!data) return [];
    if (tab === "all") return data.reconciled;
    if (tab === "confirmed") return data.reconciled.filter((r) => r.status === "confirmed");
    return data.reconciled.filter((r) => ["review", "missing", "new_code", "autobook"].includes(r.status));
  }, [data, tab]);

  if (accounts.length === 0) {
    return (
      <div className="p-4 md:p-8 max-w-3xl mx-auto">
        <div className="rounded-2xl p-12 border text-center text-slate-500 bg-zinc-950/40 border-zinc-800/60">
          <span className="text-3xl block mb-2">🏦</span>
          <p className="text-xs">Crea prima un conto nella pagina Conti per poter importare un estratto conto.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
            Riscontro bancario
          </h1>
          <p className="text-sm text-slate-400 mt-1">Confronta l'estratto conto con le spese già registrate.</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={selectedAccountId}
            onChange={(e) => setSelectedAccountId(e.target.value)}
            className="px-3 py-2.5 rounded-xl text-xs text-white focus:outline-none border select-custom border-zinc-800 bg-zinc-950/80"
          >
            {accounts.map((a) => (
              <option key={a.id} value={a.id} style={{ background: "hsl(240 10% 10%)" }}>
                {a.name}
              </option>
            ))}
          </select>
          <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleFileChange} />
          <button
            type="button"
            disabled={isImporting}
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2.5 rounded-xl text-xs font-extrabold text-white bg-sky-600 hover:bg-sky-500 transition-all disabled:opacity-50 whitespace-nowrap"
          >
            {isImporting ? "Importazione..." : "↑ Importa estratto conto"}
          </button>
        </div>
      </div>

      {importsForAccount.length > 1 && (
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span>Importazioni precedenti:</span>
          <select
            value={data?.import.id || ""}
            onChange={(e) => loadReconciliation(e.target.value)}
            className="px-3 py-1.5 rounded-lg text-xs text-white focus:outline-none border select-custom border-zinc-800 bg-zinc-950/80"
          >
            {importsForAccount.map((imp) => (
              <option key={imp.id} value={imp.id} style={{ background: "hsl(240 10% 10%)" }}>
                {formatDate(imp.period_start!)} – {formatDate(imp.period_end!)} ({imp.row_count} mov.)
              </option>
            ))}
          </select>
        </div>
      )}

      {!data ? (
        <div className="rounded-2xl p-12 border text-center text-slate-500 bg-zinc-950/40 border-zinc-800/60">
          <span className="text-3xl block mb-2">📄</span>
          <p className="text-xs">Nessun estratto conto importato per questo conto. Scarica i movimenti in CSV dal sito della tua banca e importali.</p>
        </div>
      ) : (
        <>
          <div className="rounded-2xl p-4 border flex items-center justify-between gap-4 flex-wrap bg-zinc-950/40 border-zinc-800/60">
            <div className="text-xs text-slate-400">
              <span className="text-white font-semibold">{data.import.file_name || "estratto conto"}</span>
              {" · "}periodo {formatDate(data.import.period_start!)} – {formatDate(data.import.period_end!)}
              {" · "}{data.import.row_count} movimenti
            </div>
            <button type="button" onClick={handleDeleteImport} className="text-[11px] font-bold text-rose-400 hover:text-rose-300">
              Elimina importazione
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {(["confirmed", "review", "missing", "new_code"] as ReconciliationStatus[]).map((status) => (
              <div key={status} className="rounded-2xl p-4 border bg-zinc-950/40 border-zinc-800/60">
                <span className="text-2xl font-black tracking-tight text-white block">{summary[status] || 0}</span>
                <span className="text-[11px] text-slate-400">{STATUS_META[status].label}</span>
              </div>
            ))}
          </div>

          <div className="flex gap-1 border-b border-zinc-800">
            {[
              { key: "all" as const, label: "Tutti", count: data.reconciled.length },
              { key: "confirmed" as const, label: "Confermati", count: summary.confirmed || 0 },
              { key: "attention" as const, label: "Da rivedere", count: (summary.review || 0) + (summary.missing || 0) + (summary.new_code || 0) + (summary.autobook || 0) },
            ].map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-3 py-2 text-xs font-bold border-b-2 -mb-px transition-all ${
                  tab === t.key ? "text-white border-sky-500" : "text-slate-500 border-transparent hover:text-slate-300"
                }`}
              >
                {t.label} <span className="text-[10px] opacity-70">{t.count}</span>
              </button>
            ))}
          </div>

          <div className="space-y-2">
            {visibleLines.map((r) => {
              const meta = STATUS_META[r.status];
              const isOpen = expandedId === r.line.id;
              const canExpand = r.status !== "confirmed" || !!r.candidateExpense;
              return (
                <div key={r.line.id} className="rounded-xl border bg-zinc-950/40 border-zinc-800/60 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => canExpand && setExpandedId(isOpen ? null : r.line.id)}
                    className="w-full grid grid-cols-[5rem_1fr_auto_auto] items-center gap-3 px-4 py-3 text-left"
                  >
                    <div className="text-xs">
                      <div className="font-semibold text-white">{formatDate(r.line.value_date)}</div>
                      {r.line.transaction_date !== r.line.value_date && (
                        <div className="text-[10px] text-slate-500">cont. {formatDate(r.line.transaction_date)}</div>
                      )}
                    </div>
                    <div className="min-w-0">
                      {r.line.type && (
                        <span className="inline-block text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-zinc-800 text-slate-400 mb-1">
                          {r.line.type}
                        </span>
                      )}
                      <div className="text-xs text-slate-300 truncate" title={r.line.description}>{r.line.description}</div>
                    </div>
                    <div className="text-sm font-bold text-white whitespace-nowrap">{formatCurrency(Number(r.line.amount))}</div>
                    <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-1 rounded-full border whitespace-nowrap ${meta.badge}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                      {meta.label}
                    </span>
                  </button>

                  {isOpen && (
                    <div className="px-4 pb-4 pt-1 border-t border-zinc-800/60 space-y-3">
                      {r.status === "confirmed" && r.candidateExpense && (
                        <>
                          <p className="text-[11px] text-slate-400">
                            Collegato a "{r.candidateExpense.description || r.candidateExpense.category}" del {formatDate(r.candidateExpense.date)}
                            {r.candidateExpense.supplier_id && suppliersById.get(r.candidateExpense.supplier_id) && (
                              <> · {suppliersById.get(r.candidateExpense.supplier_id)!.name}</>
                            )}
                          </p>
                          <button
                            type="button"
                            onClick={() => withReload(() => unmatchLine(r.line.id))}
                            className="text-[11px] font-bold text-slate-400 hover:text-white"
                          >
                            Annulla abbinamento
                          </button>
                        </>
                      )}

                      {r.status === "autobook" && (
                        <>
                          <p className="text-[11px] text-slate-400">
                            Le competenze/commissioni bancarie non sono spese registrate in anticipo: un click la registra come nuova spesa.
                          </p>
                          <div className="flex gap-2 flex-wrap">
                            <button
                              type="button"
                              disabled={isPending}
                              onClick={() => withReload(() => createExpenseFromStatementLine(r.line.id, { category_name: r.line.type || "Commissioni bancarie" }))}
                              className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-white bg-sky-600 hover:bg-sky-500"
                            >
                              Registra come spesa
                            </button>
                            <button type="button" onClick={() => withReload(() => ignoreStatementLine(r.line.id))} className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-slate-400 hover:text-white">
                              Ignora
                            </button>
                          </div>
                        </>
                      )}

                      {r.status === "review" && r.candidateExpense && (
                        <>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="rounded-lg p-3 bg-zinc-900/60 border border-zinc-800">
                              <div className="text-[9px] font-bold uppercase tracking-wide text-slate-500 mb-1">Nell'estratto</div>
                              <div className="text-xs text-white">{formatCurrency(Math.abs(Number(r.line.amount)))}</div>
                              <div className="text-[10px] text-slate-500">{formatDate(r.line.value_date)}</div>
                            </div>
                            <div className="rounded-lg p-3 bg-zinc-900/60 border border-zinc-800">
                              <div className="text-[9px] font-bold uppercase tracking-wide text-slate-500 mb-1">Registrato</div>
                              <div className="text-xs text-amber-400">{formatCurrency(Math.abs(Number(r.candidateExpense.amount)))}</div>
                              <div className="text-[10px] text-slate-500">{formatDate(r.candidateExpense.date)}</div>
                            </div>
                          </div>
                          <p className="text-[11px] text-amber-400">
                            Differenza di {formatCurrency(r.amountDiff || 0)}
                            {r.dateDiffDays ? ` · ${r.dateDiffDays} giorni di distanza` : ""}
                          </p>
                          <div className="flex gap-2 flex-wrap">
                            <button
                              type="button"
                              onClick={() => withReload(() => confirmLineMatch(r.line.id, r.candidateExpense!.id))}
                              className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-white bg-sky-600 hover:bg-sky-500"
                            >
                              Conferma comunque
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const oldAmount = formatCurrency(Math.abs(Number(r.candidateExpense!.amount)));
                                const newAmount = formatCurrency(Math.abs(Number(r.line.amount)));
                                if (!confirm(`Correggere l'importo della spesa registrata da ${oldAmount} a ${newAmount} (come nell'estratto conto)?`)) return;
                                withReload(() => correctExpenseAmountAndConfirm(r.line.id, r.candidateExpense!.id));
                              }}
                              className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20"
                            >
                              Correggi importo
                            </button>
                            <button
                              type="button"
                              onClick={() => withReload(() => splitReviewDifferenceAsFee(r.line.id, r.candidateExpense!.id))}
                              className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-sky-300 bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/20"
                            >
                              È una commissione
                            </button>
                            <button type="button" onClick={() => setExpenseFormLineId(r.line.id)} className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-slate-300 bg-zinc-800 hover:bg-zinc-700">
                              Crea nuova spesa
                            </button>
                            <button type="button" onClick={() => withReload(() => ignoreStatementLine(r.line.id))} className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-slate-400 hover:text-white">
                              Ignora
                            </button>
                          </div>
                          <p className="text-[10px] text-slate-500">
                            "Correggi importo" per un tuo errore di battitura nella spesa · "È una commissione" se è la banca ad aver applicato una maggiorazione (es. Amazon/PayPal): la spesa resta invariata e la differenza diventa una voce separata.
                          </p>
                        </>
                      )}

                      {r.status === "missing" && (
                        <>
                          <p className="text-[11px] text-slate-400">Nessuna spesa registrata corrisponde a questo movimento in questo periodo.</p>
                          <div className="flex gap-2 flex-wrap">
                            <button type="button" onClick={() => setExpenseFormLineId(r.line.id)} className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-white bg-sky-600 hover:bg-sky-500">
                              Crea spesa da questo movimento
                            </button>
                            <button type="button" onClick={() => withReload(() => ignoreStatementLine(r.line.id))} className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-slate-400 hover:text-white">
                              Ignora
                            </button>
                          </div>
                        </>
                      )}

                      {r.status === "new_code" && (
                        <>
                          <p className="text-[11px] text-slate-400 font-mono break-all">Codice rilevato: {r.line.detected_code}</p>

                          {r.candidateExpense && (
                            <>
                              <div className="grid grid-cols-2 gap-3">
                                <div className="rounded-lg p-3 bg-zinc-900/60 border border-zinc-800">
                                  <div className="text-[9px] font-bold uppercase tracking-wide text-slate-500 mb-1">Nell'estratto</div>
                                  <div className="text-xs text-white">{formatCurrency(Math.abs(Number(r.line.amount)))}</div>
                                  <div className="text-[10px] text-slate-500">{formatDate(r.line.value_date)}</div>
                                </div>
                                <div className="rounded-lg p-3 bg-zinc-900/60 border border-zinc-800">
                                  <div className="text-[9px] font-bold uppercase tracking-wide text-slate-500 mb-1">Potrebbe essere</div>
                                  <div className="text-xs text-white truncate">{r.candidateExpense.description || r.candidateExpense.category}</div>
                                  <div className={`text-[10px] ${r.amountDiff ? "text-amber-400" : "text-slate-500"}`}>
                                    {formatCurrency(Math.abs(Number(r.candidateExpense.amount)))} · {formatDate(r.candidateExpense.date)}
                                  </div>
                                </div>
                              </div>
                              <div className="flex gap-2 flex-wrap">
                                <button
                                  type="button"
                                  onClick={() => withReload(() => confirmLineMatch(r.line.id, r.candidateExpense!.id))}
                                  className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-white bg-sky-600 hover:bg-sky-500"
                                >
                                  È questa spesa
                                </button>
                                {!!r.amountDiff && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const oldAmount = formatCurrency(Math.abs(Number(r.candidateExpense!.amount)));
                                      const newAmount = formatCurrency(Math.abs(Number(r.line.amount)));
                                      if (!confirm(`Correggere l'importo della spesa registrata da ${oldAmount} a ${newAmount} (come nell'estratto conto)?`)) return;
                                      withReload(() => correctExpenseAmountAndConfirm(r.line.id, r.candidateExpense!.id));
                                    }}
                                    className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20"
                                  >
                                    È questa, ma correggi importo
                                  </button>
                                )}
                                {!!r.amountDiff && (
                                  <button
                                    type="button"
                                    onClick={() => withReload(() => splitReviewDifferenceAsFee(r.line.id, r.candidateExpense!.id))}
                                    className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-sky-300 bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/20"
                                  >
                                    È questa, ma la differenza è una commissione
                                  </button>
                                )}
                              </div>
                            </>
                          )}

                          {r.suggestedSupplier ? (
                            <div className="rounded-lg p-3 bg-sky-500/10 border border-dashed border-sky-500/40 flex items-center justify-between gap-3 flex-wrap">
                              <span className="text-[11px] text-slate-300">Il nome somiglia a un fornitore già noto.</span>
                              <button
                                type="button"
                                onClick={() => withReload(() => linkSupplierAccountCode({ supplier_id: r.suggestedSupplier!.id, code: r.line.detected_code! }))}
                                className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-white bg-sky-600 hover:bg-sky-500 whitespace-nowrap"
                              >
                                Collega a "{r.suggestedSupplier.name}"
                              </button>
                            </div>
                          ) : null}
                          <div className="flex gap-2 flex-wrap items-center">
                            <button type="button" onClick={() => setExpenseFormLineId(r.line.id)} className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-white bg-sky-600 hover:bg-sky-500">
                              Crea spesa
                            </button>
                            <button type="button" onClick={() => setLinkFormLineId(r.line.id)} className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-slate-300 bg-zinc-800 hover:bg-zinc-700">
                              Collega a un fornitore
                            </button>
                            <button
                              type="button"
                              onClick={() => withReload(() => markCodeWithoutSupplier(r.line.detected_code!))}
                              className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-slate-300 bg-zinc-800 hover:bg-zinc-700"
                            >
                              Non è un fornitore, non chiedermelo più
                            </button>
                            <button type="button" onClick={() => withReload(() => ignoreStatementLine(r.line.id))} className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-slate-400 hover:text-white">
                              Ignora
                            </button>
                          </div>
                          <p className="text-[10px] text-slate-500">
                            "Crea spesa" puoi lasciarla senza fornitore: il codice resta comunque memorizzato per non chiedertelo di nuovo.
                          </p>
                          {linkFormLineId === r.line.id && (
                            <LinkSupplierForm
                              suppliers={suppliers}
                              onCancel={() => setLinkFormLineId(null)}
                              onSubmit={(supplierId) =>
                                withReload(async () => {
                                  const res = await linkSupplierAccountCode({ supplier_id: supplierId, code: r.line.detected_code! });
                                  if (res.success) setLinkFormLineId(null);
                                  return res;
                                })
                              }
                            />
                          )}
                        </>
                      )}

                      {r.status === "ignored" && (
                        <button type="button" onClick={() => withReload(() => restoreStatementLine(r.line.id))} className="text-[11px] font-bold text-slate-400 hover:text-white">
                          Ripristina
                        </button>
                      )}

                      {expenseFormLineId === r.line.id && (
                        <CreateExpenseForm
                          defaultDescription={r.line.description}
                          categories={categories}
                          suppliers={suppliers}
                          defaultSupplierId={r.supplierId ?? r.suggestedSupplier?.id ?? null}
                          onCancel={() => setExpenseFormLineId(null)}
                          onSubmit={(payload) =>
                            withReload(async () => {
                              const res = await createExpenseFromStatementLine(r.line.id, payload);
                              if (res.success) setExpenseFormLineId(null);
                              return res;
                            })
                          }
                        />
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {data.unmatchedExpenses.length > 0 && (
            <div className="rounded-2xl p-4 border bg-zinc-950/40 border-zinc-800/60 space-y-3">
              <div>
                <h2 className="text-sm font-bold text-white">Spese registrate senza riscontro nell'estratto</h2>
                <p className="text-[11px] text-slate-400">Spese segnate su questo conto in questo periodo che non compaiono tra i movimenti importati.</p>
              </div>
              <div className="space-y-2">
                {data.unmatchedExpenses.map((e) => {
                  const daysSincePeriodEnd = daysBetweenLocal(e.date, data.import.period_end!);
                  const pending = daysSincePeriodEnd <= 5;
                  return (
                    <div key={e.id} className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg bg-zinc-900/60 border border-zinc-800 flex-wrap">
                      <div>
                        <div className="text-xs font-semibold text-white">{e.description || e.category}</div>
                        <div className="text-[10px] text-slate-500">registrata il {formatDate(e.date)}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`text-[10px] font-bold px-2 py-1 rounded-full border ${pending ? "bg-zinc-800 text-slate-400 border-zinc-700" : "bg-amber-500/10 text-amber-400 border-amber-500/20"}`}>
                          {pending ? "In attesa" : "Verifica"}
                        </span>
                        <span className="text-xs font-bold text-white">{formatCurrency(Number(e.amount))}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function CreateExpenseForm({
  defaultDescription,
  categories,
  suppliers,
  defaultSupplierId,
  onCancel,
  onSubmit,
}: {
  defaultDescription: string;
  categories: ExpenseCategory[];
  suppliers: Supplier[];
  defaultSupplierId: string | null;
  onCancel: () => void;
  onSubmit: (payload: { category_name: string; category_id: string | null; supplier_id: string | null; description: string }) => void;
}) {
  const [categoryId, setCategoryId] = useState(categories[0]?.id || "");
  const [supplierId, setSupplierId] = useState(defaultSupplierId || "");
  const [description, setDescription] = useState(defaultDescription);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const category = categories.find((c) => c.id === categoryId);
    onSubmit({
      category_name: category?.name || "Altro",
      category_id: category?.id || null,
      supplier_id: supplierId || null,
      description,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-lg p-3 bg-zinc-900/60 border border-zinc-800 space-y-2">
      <div className="grid sm:grid-cols-2 gap-2">
        <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="px-3 py-2 rounded-lg text-xs text-white border select-custom border-zinc-800 bg-zinc-950/80">
          {categories.map((c) => (
            <option key={c.id} value={c.id} style={{ background: "hsl(240 10% 10%)" }}>{c.name}</option>
          ))}
        </select>
        <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className="px-3 py-2 rounded-lg text-xs text-white border select-custom border-zinc-800 bg-zinc-950/80">
          <option value="" style={{ background: "hsl(240 10% 10%)" }}>— nessun fornitore —</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id} style={{ background: "hsl(240 10% 10%)" }}>{s.name}</option>
          ))}
        </select>
      </div>
      <input
        type="text"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        className="w-full px-3 py-2 rounded-lg text-xs text-white border border-zinc-800 bg-zinc-950/80"
        placeholder="Descrizione"
      />
      <div className="flex gap-2">
        <button type="submit" className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-white bg-sky-600 hover:bg-sky-500">Crea spesa</button>
        <button type="button" onClick={onCancel} className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-slate-400 hover:text-white">Annulla</button>
      </div>
    </form>
  );
}

function LinkSupplierForm({ suppliers, onCancel, onSubmit }: { suppliers: Supplier[]; onCancel: () => void; onSubmit: (supplierId: string) => void }) {
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id || "");

  return (
    <div className="rounded-lg p-3 bg-zinc-900/60 border border-zinc-800 flex items-center gap-2 flex-wrap">
      <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className="px-3 py-2 rounded-lg text-xs text-white border select-custom border-zinc-800 bg-zinc-950/80">
        {suppliers.map((s) => (
          <option key={s.id} value={s.id} style={{ background: "hsl(240 10% 10%)" }}>{s.name}</option>
        ))}
      </select>
      <button type="button" onClick={() => supplierId && onSubmit(supplierId)} className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-white bg-sky-600 hover:bg-sky-500">Collega</button>
      <button type="button" onClick={onCancel} className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-slate-400 hover:text-white">Annulla</button>
    </div>
  );
}

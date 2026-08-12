"use client";

import { useState, useTransition, useMemo, Fragment } from "react";
import { type Expense, type PaymentSchedule, type Supplier, type SupplierDocument } from "@/lib/types/database";
import { deleteExpense } from "@/app/actions/expenses";
import { deleteSchedule, paySchedule, unpaySchedule } from "@/app/actions/schedules";
import { uploadAndLinkDocument, utilityMissingTags } from "@/lib/uploadDocument";
import { monthInputToDate, syncPeriodEnd } from "@/lib/period";
import { formatCurrency, toLocalDateStr } from "@/lib/format";
import { ArrowLeftIcon, ArrowRightIcon, DeleteIcon, CheckIcon, SchedulesIcon, ExpensesIcon } from "./icons";
import { getCategoryBadgeStyle } from "@/lib/categoryColors";

interface ExpenseWithRelations extends Omit<Expense, "amount"> {
  amount: number;
  expense_categories?: {
    name: string;
    color: string;
  } | null;
  suppliers?: {
    name: string;
  } | null;
}

interface ScheduleWithRelations extends Omit<PaymentSchedule, "amount"> {
  amount: number;
  expense_categories?: {
    name: string;
    color: string;
  } | null;
  suppliers?: {
    name: string;
  } | null;
}

interface CalendarClientProps {
  expenses: any[];
  schedules: any[];
  suppliers: Supplier[];
  initialDocuments: SupplierDocument[];
  googleConnected: boolean;
}

export default function CalendarClient({ expenses: initialExpenses, schedules: initialSchedules, suppliers, initialDocuments, googleConnected }: CalendarClientProps) {
  const [expenses, setExpenses] = useState<ExpenseWithRelations[]>(initialExpenses);
  const [schedules, setSchedules] = useState<ScheduleWithRelations[]>(initialSchedules);
  const [documents, setDocuments] = useState<SupplierDocument[]>(initialDocuments);
  const [isPending, startTransition] = useTransition();

  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(toLocalDateStr());

  // Conferma di saldo: chiede sempre l'importo reale (come in Scadenze), e per le utenze anche
  // consumo e documento.
  const [payingId, setPayingId] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payConsumptionValue, setPayConsumptionValue] = useState("");
  const [payPeriodStart, setPayPeriodStart] = useState("");
  const [payPeriodEnd, setPayPeriodEnd] = useState("");
  const [payDocFile, setPayDocFile] = useState<File | null>(null);
  const [payDocType, setPayDocType] = useState<"contratto" | "bolletta" | "altro">("bolletta");

  const handlePayPeriodStartChange = (value: string) => {
    setPayPeriodEnd(prev => syncPeriodEnd(value, payPeriodStart, prev));
    setPayPeriodStart(value);
  };

  const docsByExpense = useMemo(() => {
    const map: Record<string, SupplierDocument[]> = {};
    documents.forEach((d) => {
      if (!d.expense_id) return;
      (map[d.expense_id] ||= []).push(d);
    });
    return map;
  }, [documents]);

  const supplierOf = (supplierId: string | null) => (supplierId ? suppliers.find(s => s.id === supplierId) || null : null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthNames = [
    "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
    "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"
  ];

  const getFirstDayOfMonth = (y: number, m: number) => {
    const day = new Date(y, m, 1).getDay();
    return day === 0 ? 6 : day - 1;
  };

  const getDaysInMonth = (y: number, m: number) => {
    return new Date(y, m + 1, 0).getDate();
  };

  const firstDayIndex = getFirstDayOfMonth(year, month);
  const daysInMonth = getDaysInMonth(year, month);

  const calendarCells = useMemo(() => {
    const cells: { dateStr: string; dayNum: number; isCurrentMonth: boolean }[] = [];
    
    const daysInPrevMonth = getDaysInMonth(year, month - 1);
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const prevDay = daysInPrevMonth - i;
      const prevMonthDate = new Date(year, month - 1, prevDay);
      cells.push({
        dateStr: toLocalDateStr(prevMonthDate),
        dayNum: prevDay,
        isCurrentMonth: false
      });
    }

    for (let i = 1; i <= daysInMonth; i++) {
      const currentMonthDate = new Date(year, month, i);
      cells.push({
        dateStr: toLocalDateStr(currentMonthDate),
        dayNum: i,
        isCurrentMonth: true
      });
    }

    const remainingCells = 42 - cells.length;
    for (let i = 1; i <= remainingCells; i++) {
      const nextMonthDate = new Date(year, month + 1, i);
      cells.push({
        dateStr: toLocalDateStr(nextMonthDate),
        dayNum: i,
        isCurrentMonth: false
      });
    }

    return cells;
  }, [year, month, firstDayIndex, daysInMonth]);

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const getExpensesForDate = (dateStr: string) => {
    return expenses.filter(e => e.date === dateStr);
  };

  // Una scadenza saldata la cui spesa collegata cade nello stesso giorno e' gia'
  // rappresentata nella sezione "Spese & Entrate Registrate": evitiamo di mostrarla
  // due volte (una come spesa e una come scadenza saldata) nello stesso giorno.
  const isScheduleShownAsExpense = (sched: ScheduleWithRelations, dateStr: string) =>
    sched.is_paid && expenses.some(e => e.schedule_id === sched.id && e.date === dateStr);

  const getSchedulesForDate = (dateStr: string) => {
    return schedules.filter(s => s.due_date === dateStr && !isScheduleShownAsExpense(s, dateStr));
  };

  const handlePaySchedule = (
    id: string,
    amount: number,
    consumptionValue: number | null = null,
    docFile: File | null = null,
    docType: "contratto" | "bolletta" | "altro" = "bolletta",
    periodStart: string | null = null,
    periodEnd: string | null = null
  ) => {
    startTransition(async () => {
      try {
        const res = await paySchedule(id, amount, consumptionValue, periodStart, periodEnd);
        if (!res.success || !res.data) {
          alert(res.error || "Errore durante la registrazione del pagamento");
          return;
        }
        const newExpenseRow = res.data;

        const target = schedules.find(s => s.id === id);
        if (!target) return;

        if (res.nextSchedule) {
          setSchedules(prev =>
            prev.map(sched => sched.id === id ? { ...sched, is_paid: true } : sched)
                .concat(res.nextSchedule as ScheduleWithRelations)
          );
        } else {
          setSchedules(prev =>
            prev.map(sched => sched.id === id ? { ...sched, is_paid: true } : sched)
          );
        }

        // Inoltre, inseriamo la spesa reale appena creata
        const newExp: ExpenseWithRelations = {
          ...newExpenseRow,
          expense_categories: target.expense_categories,
          suppliers: target.suppliers,
        };
        setExpenses(prev => [newExp, ...prev]);

        if (docFile) {
          const doc = await uploadAndLinkDocument({
            file: docFile,
            expenseId: newExpenseRow.id,
            supplierId: target.supplier_id,
            suppliersList: suppliers,
            title: target.description || target.category || "Bolletta",
            docType,
            googleConnected,
          });
          if (doc) setDocuments(prev => [doc, ...prev]);
        }

        if (payingId === id) cancelPay();
      } catch (err: any) {
        alert(err.message || "Errore durante la registrazione");
      }
    });
  };

  const startPay = (item: ScheduleWithRelations) => {
    setPayingId(item.id);
    setPayAmount(String(item.amount));
    setPayConsumptionValue("");
    setPayPeriodStart("");
    setPayPeriodEnd("");
    setPayDocFile(null);
    setPayDocType("bolletta");
  };

  const cancelPay = () => {
    setPayingId(null);
    setPayAmount("");
    setPayConsumptionValue("");
    setPayPeriodStart("");
    setPayPeriodEnd("");
    setPayDocFile(null);
    setPayDocType("bolletta");
  };

  // Il saldo chiede sempre conferma dell'importo reale prima di registrare la spesa.
  const handlePayClick = (item: ScheduleWithRelations) => {
    if (payingId === item.id) cancelPay(); else startPay(item);
  };

  const handlePayDocFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      alert("Il file supera la dimensione massima consigliata di 10MB");
      return;
    }
    setPayDocFile(file);
  };

  const confirmPay = (item: ScheduleWithRelations) => {
    const amount = Number(payAmount);
    if (!payAmount.trim() || isNaN(amount) || amount <= 0) {
      alert("Inserisci un importo reale valido");
      return;
    }
    const value = payConsumptionValue.trim() ? Number(payConsumptionValue) : null;
    if (payConsumptionValue.trim() && (isNaN(value as number) || (value as number) < 0)) {
      alert("Inserisci un consumo valido");
      return;
    }
    handlePaySchedule(
      item.id,
      amount,
      value,
      payDocFile,
      payDocType,
      monthInputToDate(payPeriodStart),
      monthInputToDate(payPeriodEnd || payPeriodStart)
    );
  };

  // Annulla il saldo di una scadenza cliccata per errore: elimina la spesa generata e, se non
  // ancora saldata, la prossima occorrenza che il saldo aveva creato automaticamente.
  const handleUnpay = (item: ScheduleWithRelations) => {
    if (!confirm(`Annullare il saldo di "${item.description || item.category}"? La spesa registrata verrà eliminata.`)) return;

    startTransition(async () => {
      try {
        const res = await unpaySchedule(item.id);
        if (!res.success || !res.data) {
          alert(res.error || "Errore durante l'annullamento del saldo");
          return;
        }
        setSchedules(prev => {
          const withoutNext = res.deletedNextOccurrenceId
            ? prev.filter(s => s.id !== res.deletedNextOccurrenceId)
            : prev;
          return withoutNext.map(s => s.id === item.id ? res.data : s);
        });
        if (res.deletedExpenseIds?.length) {
          setExpenses(prev => prev.filter(e => !res.deletedExpenseIds.includes(e.id)));
        }
      } catch (err: any) {
        alert(err.message || "Errore durante l'annullamento del saldo");
      }
    });
  };

  const handleDeleteExpense = (id: string) => {
    if (!confirm("Sei sicuro di voler eliminare questa spesa?")) return;

    startTransition(async () => {
      try {
        const res = await deleteExpense(id);
        if (!res.success) {
          alert(res.error || "Errore durante l'eliminazione");
          return;
        }
        setExpenses(prev => prev.filter(e => e.id !== id));
      } catch (err: any) {
        alert(err.message || "Errore durante l'eliminazione");
      }
    });
  };

  const handleDeleteSchedule = (id: string) => {
    if (!confirm("Sei sicuro di voler eliminare questo pagamento programmato?")) return;

    startTransition(async () => {
      try {
        const res = await deleteSchedule(id);
        if (!res.success) {
          alert(res.error || "Errore durante l'eliminazione");
          return;
        }
        setSchedules(prev => prev.filter(s => s.id !== id));
      } catch (err: any) {
        alert(err.message || "Errore durante l'eliminazione");
      }
    });
  };

  const selectedDateExpenses = selectedDate ? getExpensesForDate(selectedDate) : [];
  const selectedDateSchedules = selectedDate ? getSchedulesForDate(selectedDate) : [];

  return (
    <div className="p-4 md:p-8 space-y-8 max-w-[100rem] mx-auto">
      {/* Header */}
      <div className="animate-fade-in space-y-1">
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
          Calendario Finanziario
        </h1>
        <p className="text-sm text-slate-400">Visualizzazione unificata delle spese passate ed uscite future.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">

        {/* Calendario Mensile Unificato */}
        <div
          className="lg:col-span-3 rounded-2xl p-5 md:p-7 border shadow-2xl relative overflow-hidden group backdrop-blur-xl animate-fade-in"
          style={{
            background: "linear-gradient(135deg, hsla(240, 10%, 12%, 0.5), hsla(240, 10%, 10%, 0.8))",
            borderColor: "hsla(240, 5%, 18%, 0.7)",
          }}
        >
          <div className="absolute top-[-30%] left-[-20%] w-60 h-60 rounded-full bg-zinc-500/5 blur-[80px] pointer-events-none" />

          {/* Navigazione Mese */}
          <div className="flex justify-between items-center mb-6 relative z-10">
            <h3 className="text-lg font-extrabold text-white tracking-wide">
              {monthNames[month]} {year}
            </h3>
            <div className="flex gap-2">
              <button
                onClick={handlePrevMonth}
                className="w-9 h-9 rounded-lg flex items-center justify-center border hover:bg-white/5 transition-all text-xs font-bold text-slate-300"
                style={{ borderColor: "hsl(240 5% 18%)", background: "hsl(240 10% 4%)" }}
              >
                <ArrowLeftIcon size={11} />
              </button>
              <button
                onClick={handleNextMonth}
                className="w-9 h-9 rounded-lg flex items-center justify-center border hover:bg-white/5 transition-all text-xs font-bold text-slate-300"
                style={{ borderColor: "hsl(240 5% 18%)", background: "hsl(240 10% 4%)" }}
              >
                <ArrowRightIcon size={11} />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1.5 md:gap-2 text-center font-bold text-slate-400 text-[11px] uppercase tracking-wider mb-2 relative z-10">
            <span>Lun</span>
            <span>Mar</span>
            <span>Mer</span>
            <span>Gio</span>
            <span>Ven</span>
            <span>Sab</span>
            <span>Dom</span>
          </div>

          <div className="grid grid-cols-7 gap-1.5 md:gap-2 bg-black/30 p-2 md:p-3 rounded-2xl border border-white/10 relative z-10">
            {calendarCells.map((cell, idx) => {
              const isSelected = selectedDate === cell.dateStr;
              const dayExpenses = getExpensesForDate(cell.dateStr);
              const daySchedules = getSchedulesForDate(cell.dateStr);

              const totalOut = dayExpenses.filter(e => !e.is_income).reduce((sum, e) => sum + Number(e.amount), 0);
              const totalIn = dayExpenses.filter(e => e.is_income).reduce((sum, e) => sum + Number(e.amount), 0);
              const pendingCount = daySchedules.filter(s => !s.is_paid).length;
              const paidCount = daySchedules.filter(s => s.is_paid).length;

              const todayStr = toLocalDateStr();
              const isToday = cell.dateStr === todayStr;

              return (
                <button
                  key={idx}
                  onClick={() => setSelectedDate(cell.dateStr)}
                  className="aspect-square min-h-[64px] md:min-h-[84px] p-1.5 rounded-xl flex flex-col items-center justify-between border transition-all duration-200 relative group overflow-hidden hover:brightness-125"
                  style={{
                    borderColor: isSelected
                      ? "hsl(220 90% 56%)"
                      : isToday
                        ? "hsla(220, 90%, 56%, 0.4)"
                        : cell.isCurrentMonth
                          ? "hsl(240 8% 30% / 0.6)"
                          : "transparent",
                    background: isSelected
                      ? "hsla(220, 90%, 56%, 0.14)"
                      : cell.isCurrentMonth
                        ? "hsl(240 10% 20% / 0.5)"
                        : "transparent",
                    opacity: cell.isCurrentMonth ? 1 : 0.35,
                  }}
                >
                  <span className={`text-xs md:text-sm font-bold ${isToday ? "text-blue-400" : "text-white"}`}>
                    {cell.dayNum}
                  </span>

                  {(totalOut > 0 || totalIn > 0) && (
                    <div className="flex flex-col items-center leading-tight">
                      {totalOut > 0 && (
                        <span className="text-[9px] md:text-[10px] font-black text-rose-400/90 whitespace-nowrap truncate max-w-full">
                          -{Math.round(totalOut)}€
                        </span>
                      )}
                      {totalIn > 0 && (
                        <span className="text-[9px] md:text-[10px] font-black text-emerald-400/90 whitespace-nowrap truncate max-w-full">
                          +{Math.round(totalIn)}€
                        </span>
                      )}
                    </div>
                  )}

                  <div className="flex gap-1 justify-center w-full flex-wrap">
                    {pendingCount > 0 && (
                      <span
                        className="inline-flex items-center px-1.5 py-[1px] rounded-full text-[8px] md:text-[9px] font-extrabold bg-amber-500/25 text-amber-300 border border-amber-500/40"
                        title={`${pendingCount} scadenza/e da saldare`}
                      >
                        ⏳{pendingCount}
                      </span>
                    )}
                    {paidCount > 0 && (
                      <span
                        className="inline-flex items-center px-1.5 py-[1px] rounded-full text-[8px] md:text-[9px] font-extrabold bg-emerald-500/25 text-emerald-300 border border-emerald-500/40"
                        title={`${paidCount} scadenza/e saldata/e`}
                      >
                        ✓{paidCount}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Dettaglio del Giorno Selezionato */}
        <div className="lg:col-span-2 space-y-6 animate-fade-in">
          <div
            className="rounded-2xl p-6 border shadow-2xl relative overflow-hidden backdrop-blur-xl"
            style={{
              background: "linear-gradient(135deg, hsla(240, 10%, 12%, 0.5), hsla(240, 10%, 10%, 0.8))",
              borderColor: "hsla(240, 5%, 18%, 0.7)",
            }}
          >
            <div className="absolute top-[-30%] right-[-20%] w-40 h-40 rounded-full bg-blue-500/5 blur-[50px] pointer-events-none" />

            <h3 className="text-sm font-extrabold text-white tracking-wide mb-5">
              📅 Dettaglio Giorno: {selectedDate ? new Date(selectedDate).toLocaleDateString("it-IT", { day: "numeric", month: "long" }) : "-"}
            </h3>

            {/* SEZIONE 1: Spese & Entrate Effettuate */}
            <div className="space-y-4">
              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5 border-b border-zinc-800 pb-2">
                <ExpensesIcon size={10} /> Spese & Entrate Registrate ({selectedDateExpenses.length})
              </h4>

              {selectedDateExpenses.length === 0 ? (
                <p className="text-[10px] text-zinc-500 py-1 font-medium">Nessuna spesa o entrata registrata.</p>
              ) : (
                <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1">
                  {selectedDateExpenses.map((exp) => {
                    const catName = exp.expense_categories?.name || exp.category;
                    const catColor = exp.expense_categories?.color || "slate";
                    const badge = getCategoryBadgeStyle(catColor);
                    const attachments = docsByExpense[exp.id] || [];
                    const { missingConsumption, missingDocument } = utilityMissingTags(
                      supplierOf(exp.supplier_id), exp.consumption_value, attachments.length
                    );

                    return (
                      <div
                        key={exp.id}
                        className="flex justify-between items-center p-2.5 rounded-xl border"
                        style={{
                          background: "hsl(240 10% 12% / 0.6)",
                          borderColor: "hsl(240 5% 18% / 0.5)",
                        }}
                      >
                        <div className="min-w-0 flex-1 pr-2">
                          <h5 className="text-xs font-bold text-white truncate">
                            {exp.suppliers?.name || "Nessun Fornitore"}
                          </h5>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span
                              className="px-1.5 py-0.5 rounded text-[8px] font-bold border"
                              style={{
                                backgroundColor: badge.bg,
                                color: badge.text,
                                borderColor: badge.border,
                              }}
                            >
                              {catName}
                            </span>
                            {exp.description && (
                              <span className="text-[9px] text-slate-400 truncate max-w-[80px]">{exp.description}</span>
                            )}
                          </div>
                          {(missingConsumption || missingDocument) && (
                            <div className="flex items-center gap-1 mt-1 flex-wrap">
                              {missingConsumption && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[7px] font-extrabold text-amber-300 bg-amber-500/10 border border-amber-500/25">
                                  ⚠ Consumo mancante
                                </span>
                              )}
                              {missingDocument && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[7px] font-extrabold text-amber-300 bg-amber-500/10 border border-amber-500/25">
                                  ⚠ Documento mancante
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-black ${exp.is_income ? "text-emerald-400" : "text-rose-400"}`}>
                            {exp.is_income ? "+" : "-"}{formatCurrency(exp.amount)}
                          </span>
                          <button
                            onClick={() => handleDeleteExpense(exp.id)}
                            className="p-1 rounded hover:bg-rose-500/10 text-slate-500 hover:text-rose-400 transition-colors"
                            title="Elimina"
                          >
                            <DeleteIcon size={11} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* SEZIONE 2: Pagamenti Programmati */}
            <div className="space-y-4 mt-6">
              <h4 className="text-[10px] font-bold text-amber-400 uppercase tracking-widest flex items-center gap-1.5 border-b border-zinc-800 pb-2">
                <SchedulesIcon size={10} /> Scadenze / Pagamenti ({selectedDateSchedules.length})
              </h4>

              {selectedDateSchedules.length === 0 ? (
                <p className="text-[10px] text-zinc-500 py-1 font-medium">Nessun pagamento programmato.</p>
              ) : (
                <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1">
                  {selectedDateSchedules.map((sched) => {
                    const catName = sched.expense_categories?.name || sched.category;
                    const catColor = sched.expense_categories?.color || "slate";
                    const badge = getCategoryBadgeStyle(catColor);

                    const schedSupplier = supplierOf(sched.supplier_id);

                    return (
                      <Fragment key={sched.id}>
                      <div
                        className="flex justify-between items-center p-2.5 rounded-xl border"
                        style={{
                          background: "hsl(240 10% 12% / 0.6)",
                          borderColor: "hsl(240 5% 18% / 0.5)",
                        }}
                      >
                        <div className="min-w-0 flex-1 pr-2">
                          <h5 className="text-xs font-bold text-white truncate">
                            {sched.suppliers?.name || "Nessun Fornitore"}
                          </h5>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span
                              className="px-1.5 py-0.5 rounded text-[8px] font-bold border"
                              style={{
                                backgroundColor: badge.bg,
                                color: badge.text,
                                borderColor: badge.border,
                              }}
                            >
                              {catName}
                            </span>
                            <span className="text-[7px] text-slate-500 uppercase tracking-wider">{sched.recurrence}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-extrabold text-white">
                            {formatCurrency(sched.amount)}
                          </span>
                          {!sched.is_paid ? (
                            <button
                              onClick={() => handlePayClick(sched)}
                              disabled={isPending}
                              className={`p-1 rounded border font-bold transition-all ${
                                payingId === sched.id
                                  ? "bg-emerald-500 text-slate-950 border-emerald-500/50"
                                  : "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-slate-950 border-emerald-500/25"
                              }`}
                              title="Segna come Pagato"
                            >
                              <CheckIcon size={10} />
                            </button>
                          ) : (
                            <span className="inline-flex items-center gap-1">
                              <span className="text-[9px] font-bold text-emerald-400">Saldata</span>
                              <button
                                onClick={() => handleUnpay(sched)}
                                className="p-1 rounded text-slate-500 hover:text-amber-400 hover:bg-amber-500/10 transition-all"
                                title="Annulla il saldo (es. cliccato per errore): elimina la spesa registrata"
                              >
                                ↺
                              </button>
                            </span>
                          )}
                          <button
                            onClick={() => handleDeleteSchedule(sched.id)}
                            className="p-1 rounded hover:bg-rose-500/10 text-slate-500 hover:text-rose-400 transition-colors"
                            title="Elimina Scadenza"
                          >
                            <DeleteIcon size={11} />
                          </button>
                        </div>
                      </div>
                      {payingId === sched.id && (
                        <div className="p-3 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.03] space-y-2 animate-fade-in">
                          <div className="space-y-1">
                            <label className="block text-[8px] font-bold text-zinc-400 uppercase tracking-wider">Importo reale (€)</label>
                            <input
                              type="number"
                              step="0.01"
                              min="0.01"
                              autoFocus
                              value={payAmount}
                              onChange={(e) => setPayAmount(e.target.value)}
                              onKeyDown={(e) => { if (e.key === "Enter") confirmPay(sched); if (e.key === "Escape") cancelPay(); }}
                              className="w-full px-2.5 py-1.5 rounded-lg text-[10px] text-white bg-zinc-950 border border-emerald-500/50 focus:outline-none"
                            />
                            {Number(payAmount) !== sched.amount && payAmount.trim() && !isNaN(Number(payAmount)) && (
                              <p className="text-[8px] text-amber-400 font-semibold">Diverso dal previsto ({formatCurrency(sched.amount)})</p>
                            )}
                          </div>
                          {schedSupplier?.is_utility && (
                          <div className="space-y-1">
                            <label className="block text-[8px] font-bold text-zinc-400 uppercase tracking-wider">
                              Consumo del periodo ({schedSupplier?.consumption_unit || "unità"})
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={payConsumptionValue}
                              onChange={(e) => setPayConsumptionValue(e.target.value)}
                              onKeyDown={(e) => { if (e.key === "Enter") confirmPay(sched); if (e.key === "Escape") cancelPay(); }}
                              placeholder={`es. 320 ${schedSupplier?.consumption_unit || ""}`}
                              className="w-full px-2.5 py-1.5 rounded-lg text-[10px] text-white bg-zinc-950 border border-zinc-800 focus:outline-none"
                            />
                          </div>
                          )}
                          {schedSupplier?.is_utility && (
                          <div className="space-y-1">
                            <label className="block text-[8px] font-bold text-zinc-400 uppercase tracking-wider">Periodo di copertura</label>
                            <div className="flex items-center gap-1.5">
                              <input
                                type="month"
                                value={payPeriodStart}
                                onChange={(e) => handlePayPeriodStartChange(e.target.value)}
                                className="flex-1 px-2 py-1.5 rounded-lg text-[10px] text-white bg-zinc-950 border border-zinc-800 focus:outline-none"
                              />
                              <span className="text-[8px] text-zinc-500">al</span>
                              <input
                                type="month"
                                value={payPeriodEnd}
                                min={payPeriodStart || undefined}
                                disabled={!payPeriodStart}
                                onChange={(e) => setPayPeriodEnd(e.target.value)}
                                className="flex-1 px-2 py-1.5 rounded-lg text-[10px] text-white bg-zinc-950 border border-zinc-800 focus:outline-none disabled:opacity-40"
                              />
                            </div>
                          </div>
                          )}
                          {schedSupplier?.is_utility && (
                          <div className="space-y-1">
                            <label className="block text-[8px] font-bold text-zinc-400 uppercase tracking-wider">Allega documento (facoltativo)</label>
                            {googleConnected ? (
                              <input
                                type="file"
                                accept="application/pdf,image/*"
                                onChange={handlePayDocFileChange}
                                className="w-full text-[9px] text-slate-300 file:mr-2 file:py-1 file:px-2 file:rounded-lg file:border-0 file:text-[8px] file:font-bold file:bg-sky-500/20 file:text-sky-300 hover:file:bg-sky-500/30 cursor-pointer"
                              />
                            ) : (
                              <a
                                href="/api/google/connect?next=/dashboard/calendar"
                                className="inline-block px-2 py-1 rounded-lg text-[8px] font-extrabold text-amber-300 bg-amber-500/10 border border-amber-500/20"
                              >
                                🔗 Collega Google Drive
                              </a>
                            )}
                          </div>
                          )}
                          {payDocFile && (
                            <select
                              value={payDocType}
                              onChange={(e) => setPayDocType(e.target.value as any)}
                              className="w-full px-2 py-1.5 rounded-lg text-[9px] text-white bg-zinc-950 border border-zinc-800 focus:outline-none"
                            >
                              <option value="bolletta">📄 Bolletta</option>
                              <option value="contratto">📑 Contratto</option>
                              <option value="altro">📎 Altro</option>
                            </select>
                          )}
                          <div className="flex gap-2">
                            <button
                              onClick={() => confirmPay(sched)}
                              disabled={isPending}
                              className="flex-1 py-1.5 rounded-lg text-[9px] font-extrabold text-white bg-emerald-600 hover:bg-emerald-500 transition-all disabled:opacity-50"
                            >
                              Conferma pagamento
                            </button>
                            <button
                              onClick={cancelPay}
                              className="px-2.5 py-1.5 rounded-lg text-[9px] font-extrabold text-zinc-400 bg-zinc-900 border border-zinc-800 hover:text-white transition-all"
                            >
                              Annulla
                            </button>
                          </div>
                        </div>
                      )}
                      </Fragment>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

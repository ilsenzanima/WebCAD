"use client";

import { useState, useTransition, useMemo } from "react";
import { type PaymentSchedule, type ExpenseCategory, type Supplier } from "@/lib/types/database";
import { createSchedule, deleteSchedule, paySchedule } from "@/app/actions/schedules";
import { DeleteIcon, ArrowLeftIcon, ArrowRightIcon, CheckIcon } from "./icons";

// Estendiamo il tipo per includere le relazioni restituite dal join Supabase
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

interface SchedulesClientProps {
  initialSchedules: any[];
  categories: ExpenseCategory[];
  suppliers: Supplier[];
}

const COLOR_MAP: Record<string, { bg: string; text: string; border: string }> = {
  indigo: { bg: "rgba(99,102,241,0.12)", text: "hsl(245 85% 75%)", border: "rgba(99,102,241,0.2)" },
  rose: { bg: "rgba(239,68,68,0.12)", text: "hsl(0 80% 75%)", border: "rgba(239,68,68,0.2)" },
  emerald: { bg: "rgba(16,185,129,0.12)", text: "hsl(150 70% 70%)", border: "rgba(16,185,129,0.2)" },
  amber: { bg: "rgba(245,158,11,0.12)", text: "hsl(38 90% 70%)", border: "rgba(245,158,11,0.2)" },
  sky: { bg: "rgba(14,165,233,0.12)", text: "hsl(200 85% 70%)", border: "rgba(14,165,233,0.2)" },
  pink: { bg: "rgba(236,72,153,0.12)", text: "hsl(330 80% 75%)", border: "rgba(236,72,153,0.2)" },
  purple: { bg: "rgba(168,85,247,0.12)", text: "hsl(270 80% 75%)", border: "rgba(168,85,247,0.2)" },
  slate: { bg: "rgba(107,114,128,0.15)", text: "hsl(215 15% 75%)", border: "rgba(107,114,128,0.25)" },
};

const RECURRENCES = [
  { value: "one-time", label: "Una Tantum" },
  { value: "weekly", label: "Settimanale" },
  { value: "monthly", label: "Mensile" },
  { value: "yearly", label: "Annuale" },
];

export default function SchedulesClient({ initialSchedules, categories, suppliers }: SchedulesClientProps) {
  const [schedules, setSchedules] = useState<ScheduleWithRelations[]>(initialSchedules);
  const [isPending, startTransition] = useTransition();

  // Stati del form
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState(categories[0]?.id || "");
  const [supplierId, setSupplierId] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState(new Date().toISOString().split("T")[0]);
  const [recurrence, setRecurrence] = useState<"one-time" | "weekly" | "monthly" | "yearly">("one-time");

  // Stati della vista
  const [viewMode, setViewMode] = useState<"calendar" | "list">("calendar");
  const [filterPaid, setFilterPaid] = useState<"all" | "pending" | "paid">("pending");

  // Stato data selezionata sul calendario
  const [selectedDate, setSelectedDate] = useState<string | null>(new Date().toISOString().split("T")[0]);
  const [currentDate, setCurrentDate] = useState(new Date());

  // Calcoli per la griglia del calendario
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
    
    // Giorni del mese precedente
    const daysInPrevMonth = getDaysInMonth(year, month - 1);
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const prevDay = daysInPrevMonth - i;
      const prevMonthDate = new Date(year, month - 1, prevDay);
      cells.push({
        dateStr: prevMonthDate.toISOString().split("T")[0],
        dayNum: prevDay,
        isCurrentMonth: false
      });
    }

    // Giorni del mese corrente
    for (let i = 1; i <= daysInMonth; i++) {
      const currentMonthDate = new Date(year, month, i);
      cells.push({
        dateStr: currentMonthDate.toISOString().split("T")[0],
        dayNum: i,
        isCurrentMonth: true
      });
    }

    // Giorni del mese successivo per completare la griglia da 42 celle (6 righe)
    const remainingCells = 42 - cells.length;
    for (let i = 1; i <= remainingCells; i++) {
      const nextMonthDate = new Date(year, month + 1, i);
      cells.push({
        dateStr: nextMonthDate.toISOString().split("T")[0],
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

  const getSchedulesForDate = (dateStr: string) => {
    return schedules.filter(s => s.due_date === dateStr);
  };

  const resetForm = () => {
    setAmount("");
    setCategoryId(categories[0]?.id || "");
    setSupplierId("");
    setDescription("");
    setDueDate(selectedDate || new Date().toISOString().split("T")[0]);
    setRecurrence("one-time");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      alert("Inserisci un importo valido");
      return;
    }

    const selectedCat = categories.find(c => c.id === categoryId);
    if (!selectedCat) {
      alert("Seleziona una categoria valida");
      return;
    }

    startTransition(async () => {
      try {
        const payload = {
          amount: Number(amount),
          category_id: categoryId,
          supplier_id: supplierId || null,
          category_name: selectedCat.name, // fallback
          description,
          due_date: dueDate,
          recurrence,
        };

        await createSchedule(payload);
        const matchingSupplier = suppliers.find(s => s.id === supplierId);
        
        const newSched: ScheduleWithRelations = {
          id: Math.random().toString(),
          user_id: "",
          amount: Number(amount),
          category: selectedCat.name,
          category_id: categoryId,
          supplier_id: supplierId || null,
          description,
          due_date: dueDate,
          recurrence,
          is_paid: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          expense_categories: { name: selectedCat.name, color: selectedCat.color },
          suppliers: matchingSupplier ? { name: matchingSupplier.name } : null
        };
        setSchedules(prev => [newSched, ...prev].sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime()));
        resetForm();
      } catch (err: any) {
        alert(err.message || "Errore durante la creazione");
      }
    });
  };

  const handlePay = (id: string) => {
    startTransition(async () => {
      try {
        await paySchedule(id);
        
        setSchedules(prev => 
          prev.map(sched => {
            if (sched.id !== id) return sched;
            
            if (sched.recurrence === "one-time") {
              return { ...sched, is_paid: true };
            } else {
              const current = new Date(sched.due_date);
              if (sched.recurrence === "weekly") {
                current.setDate(current.getDate() + 7);
              } else if (sched.recurrence === "monthly") {
                current.setMonth(current.getMonth() + 1);
              } else if (sched.recurrence === "yearly") {
                current.setFullYear(current.getFullYear() + 1);
              }
              return { ...sched, due_date: current.toISOString().split("T")[0] };
            }
          })
        );
      } catch (err: any) {
        alert(err.message || "Errore durante la registrazione del pagamento");
      }
    });
  };

  const handleDelete = (id: string) => {
    if (!confirm("Sei sicuro di voler eliminare questa scadenza?")) return;

    startTransition(async () => {
      try {
        await deleteSchedule(id);
        setSchedules(prev => prev.filter(item => item.id !== id));
      } catch (err: any) {
        alert(err.message || "Errore durante l'eliminazione");
      }
    });
  };

  const handleDayClick = (dateStr: string) => {
    setSelectedDate(dateStr);
    setDueDate(dateStr);
  };

  // Filtro scadenze per la vista Lista
  const filteredSchedules = schedules.filter(sched => {
    if (filterPaid === "pending") return !sched.is_paid;
    if (filterPaid === "paid") return sched.is_paid;
    return true;
  });

  const selectedDateSchedules = selectedDate ? getSchedulesForDate(selectedDate) : [];

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(val);
  };

  return (
    <div className="p-4 md:p-8 space-y-8 max-w-7xl mx-auto">
      {/* Header e Selettore Vista */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 animate-fade-in">
        <div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
            Scadenziario Pagamenti
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Visualizza, pianifica e gestisci le tue scadenze future.
          </p>
        </div>

        <div className="flex rounded-xl p-1 bg-zinc-950 border border-white/5 font-semibold text-xs relative">
          <button
            onClick={() => setViewMode("calendar")}
            className="px-4 py-2 rounded-lg transition-all duration-200"
            style={{
              background: viewMode === "calendar" ? "linear-gradient(135deg, hsl(220 90% 56%), hsl(215 85% 48%))" : "transparent",
              color: viewMode === "calendar" ? "white" : "hsl(215 20% 65%)",
            }}
          >
            📅 Calendario
          </button>
          <button
            onClick={() => setViewMode("list")}
            className="px-4 py-2 rounded-lg transition-all duration-200"
            style={{
              background: viewMode === "list" ? "linear-gradient(135deg, hsl(220 90% 56%), hsl(215 85% 48%))" : "transparent",
              color: viewMode === "list" ? "white" : "hsl(215 20% 65%)",
            }}
          >
            📋 Lista
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Form di pianificazione (1 colonna) */}
        <div
          className="rounded-2xl p-6 border h-fit shadow-xl backdrop-blur-md"
          style={{
            background: "hsl(240 10% 10% / 0.8)",
            borderColor: "hsl(240 5% 18% / 0.7)",
          }}
        >
          <h2 className="text-base font-bold text-white mb-5 tracking-tight flex items-center gap-2">
            <span>📝</span> Pianifica Pagamento
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Importo */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Importo (€)</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                required
                className="w-full px-4 py-3 rounded-xl text-xs text-white focus:outline-none border"
                style={{
                  background: "hsl(240 10% 4% / 0.8)",
                  borderColor: "hsl(240 5% 18%)",
                }}
              />
            </div>

            {/* Categoria */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Categoria</label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-xl text-xs text-white focus:outline-none border select-custom"
                style={{
                  background: "hsl(240 10% 4% / 0.8)",
                  borderColor: "hsl(240 5% 18%)",
                }}
              >
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id} style={{ background: "hsl(240 10% 10%)" }}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Fornitore */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Fornitore / Servizio</label>
              <select
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                className="w-full px-4 py-3 rounded-xl text-xs text-white focus:outline-none border select-custom"
                style={{
                  background: "hsl(240 10% 4% / 0.8)",
                  borderColor: "hsl(240 5% 18%)",
                }}
              >
                <option value="" style={{ background: "hsl(240 10% 10%)" }}>Nessun Fornitore</option>
                {suppliers.map((sup) => (
                  <option key={sup.id} value={sup.id} style={{ background: "hsl(240 10% 10%)" }}>
                    {sup.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Scadenza */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Data di Scadenza</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-xl text-xs text-white focus:outline-none border text-left"
                style={{
                  background: "hsl(240 10% 4% / 0.8)",
                  borderColor: "hsl(240 5% 18%)",
                }}
              />
            </div>

            {/* Ricorrenza */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Ricorrenza</label>
              <select
                value={recurrence}
                onChange={(e) => setRecurrence(e.target.value as any)}
                className="w-full px-4 py-3 rounded-xl text-xs text-white focus:outline-none border select-custom"
                style={{
                  background: "hsl(240 10% 4% / 0.8)",
                  borderColor: "hsl(240 5% 18%)",
                }}
              >
                {RECURRENCES.map((rec) => (
                  <option key={rec.value} value={rec.value} style={{ background: "hsl(240 10% 10%)" }}>
                    {rec.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Descrizione */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Note</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Note aggiuntive..."
                className="w-full px-4 py-3 rounded-xl text-xs text-white focus:outline-none border"
                style={{
                  background: "hsl(240 10% 4% / 0.8)",
                  borderColor: "hsl(240 5% 18%)",
                }}
              />
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="w-full py-3 rounded-xl text-xs font-extrabold text-white transition-all shadow-md active:scale-98 mt-2"
              style={{
                background: "linear-gradient(135deg, hsl(220 90% 56%), hsl(215 85% 48%))",
                cursor: isPending ? "not-allowed" : "pointer",
              }}
            >
              {isPending ? "Salvataggio..." : "Programma Pagamento"}
            </button>
          </form>
        </div>

        {/* ─── VISTA CALENDARIO ─── */}
        {viewMode === "calendar" && (
          <div className="lg:col-span-2 flex flex-col gap-6 animate-fade-in">
            {/* Struttura Calendario */}
            <div
              className="rounded-2xl p-6 border shadow-xl backdrop-blur-md"
              style={{
                background: "hsl(240 10% 10% / 0.8)",
                borderColor: "hsl(240 5% 18% / 0.7)",
              }}
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-base font-extrabold text-white tracking-wide">
                  {monthNames[month]} {year}
                </h3>
                <div className="flex gap-2">
                  <button
                    onClick={handlePrevMonth}
                    className="w-8 h-8 rounded-lg flex items-center justify-center border hover:bg-white/5 transition-all text-xs font-bold text-slate-300"
                    style={{ borderColor: "hsl(240 5% 18%)", background: "hsl(240 10% 4%)" }}
                  >
                    <ArrowLeftIcon size={10} />
                  </button>
                  <button
                    onClick={handleNextMonth}
                    className="w-8 h-8 rounded-lg flex items-center justify-center border hover:bg-white/5 transition-all text-xs font-bold text-slate-300"
                    style={{ borderColor: "hsl(240 5% 18%)", background: "hsl(240 10% 4%)" }}
                  >
                    <ArrowRightIcon size={10} />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-7 gap-1 text-center font-bold text-slate-500 text-[10px] uppercase tracking-wider mb-2">
                <span>Lun</span>
                <span>Mar</span>
                <span>Mer</span>
                <span>Gio</span>
                <span>Ven</span>
                <span>Sab</span>
                <span>Dom</span>
              </div>

              <div className="grid grid-cols-7 gap-1 bg-zinc-950/20 p-1.5 rounded-xl border border-white/5">
                {calendarCells.map((cell, idx) => {
                  const isSelected = selectedDate === cell.dateStr;
                  const daySchedules = getSchedulesForDate(cell.dateStr);
                  const hasPending = daySchedules.some(s => !s.is_paid);
                  const hasPaid = daySchedules.some(s => s.is_paid);
                  
                  const todayStr = new Date().toISOString().split("T")[0];
                  const isToday = cell.dateStr === todayStr;

                  return (
                    <button
                      key={idx}
                      onClick={() => handleDayClick(cell.dateStr)}
                      className="aspect-square p-1.5 rounded-xl flex flex-col items-center justify-between border transition-all duration-200 relative group"
                      style={{
                        borderColor: isSelected 
                          ? "hsl(220 90% 56%)" 
                          : isToday 
                            ? "hsla(220, 90%, 56%, 0.3)" 
                            : "transparent",
                        background: isSelected
                          ? "hsla(220, 90%, 56%, 0.12)"
                          : cell.isCurrentMonth
                            ? "hsl(240 10% 4% / 0.4)"
                            : "transparent",
                        opacity: cell.isCurrentMonth ? 1 : 0.3,
                      }}
                    >
                      <span className={`text-[10px] font-bold ${isToday ? "text-blue-400" : "text-white"}`}>
                        {cell.dayNum}
                      </span>

                      <div className="flex gap-0.5 justify-center w-full">
                        {hasPending && (
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shadow-[0_0_4px_rgba(245,158,11,0.5)] animate-pulse" />
                        )}
                        {hasPaid && (
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_4px_rgba(16,185,129,0.5)]" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Dettaglio Scadenze Giorno Selezionato */}
            <div
              className="rounded-2xl p-6 border shadow-xl backdrop-blur-md animate-fade-in"
              style={{
                background: "hsl(240 10% 10% / 0.8)",
                borderColor: "hsl(240 5% 18% / 0.7)",
              }}
            >
              <h3 className="text-sm font-bold text-white mb-4">
                📅 Dettaglio Scadenze: {selectedDate ? new Date(selectedDate).toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" }) : "-"}
              </h3>

              {selectedDateSchedules.length === 0 ? (
                <p className="text-xs text-slate-500 py-4 text-center">Nessuna scadenza pianificata per questo giorno.</p>
              ) : (
                <div className="space-y-3">
                  {selectedDateSchedules.map((sched) => {
                    const catName = sched.expense_categories?.name || sched.category;
                    const catColor = sched.expense_categories?.color || "slate";
                    const badge = COLOR_MAP[catColor] || COLOR_MAP.slate;
                    
                    return (
                      <div
                        key={sched.id}
                        className="flex justify-between items-center p-3 rounded-xl border transition-all duration-150 hover:bg-white/5"
                        style={{
                          background: "hsl(240 10% 12% / 0.6)",
                          borderColor: "hsl(240 5% 18% / 0.5)",
                        }}
                      >
                        <div className="min-w-0 flex-1 pr-3">
                          <div className="text-xs font-bold text-white truncate">
                            {sched.suppliers?.name || "Nessun Fornitore"}
                          </div>
                          <div className="text-[10px] flex items-center gap-1.5 mt-1 font-semibold">
                            <span
                              className="inline-flex items-center px-2 py-0.5 rounded border"
                              style={{
                                backgroundColor: badge.bg,
                                color: badge.text,
                                borderColor: badge.border,
                              }}
                            >
                              {catName}
                            </span>
                            {sched.description && (
                              <>
                                <span className="text-slate-600">•</span>
                                <span className="text-slate-400 truncate max-w-[120px]">{sched.description}</span>
                              </>
                            )}
                            <span className="text-slate-600">•</span>
                            <span className="text-slate-500 uppercase tracking-widest text-[7px]">{sched.recurrence}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0">
                          <span className="text-xs font-extrabold text-white">
                            {formatCurrency(sched.amount)}
                          </span>
                          {!sched.is_paid && (
                            <button
                              onClick={() => handlePay(sched.id)}
                              disabled={isPending}
                              className="px-2 py-1 rounded bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-slate-950 border border-emerald-500/25 font-bold transition-all text-[9px] flex items-center gap-1"
                            >
                              <CheckIcon size={9} /> Pagato
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(sched.id)}
                            className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                          >
                            <DeleteIcon size={12} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── VISTA LISTA ─── */}
        {viewMode === "list" && (
          <div
            className="lg:col-span-2 rounded-2xl p-6 border flex flex-col space-y-5 shadow-xl backdrop-blur-md animate-fade-in"
            style={{
              background: "hsl(240 10% 10% / 0.8)",
              borderColor: "hsl(240 5% 18% / 0.7)",
            }}
          >
            {/* Filtro dello Stato */}
            <div className="flex gap-2.5">
              <button
                onClick={() => setFilterPaid("pending")}
                className="px-4 py-2.5 rounded-xl text-xs font-bold transition-all duration-200"
                style={{
                  background: filterPaid === "pending" ? "hsla(38, 90%, 50%, 0.12)" : "transparent",
                  color: filterPaid === "pending" ? "hsl(38 90% 55%)" : "hsl(215 20% 65%)",
                  border: `1px solid ${filterPaid === "pending" ? "hsl(38 90% 50% / 0.3)" : "hsl(240 5% 18%)"}`,
                }}
              >
                ⏳ Da Pagare
              </button>
              <button
                onClick={() => setFilterPaid("paid")}
                className="px-4 py-2.5 rounded-xl text-xs font-bold transition-all duration-200"
                style={{
                  background: filterPaid === "paid" ? "hsla(142, 70%, 45%, 0.12)" : "transparent",
                  color: filterPaid === "paid" ? "hsl(142 70% 45%)" : "hsl(215 20% 65%)",
                  border: `1px solid ${filterPaid === "paid" ? "hsl(142 70% 45% / 0.3)" : "hsl(240 5% 18%)"}`,
                }}
              >
                ✅ Pagati
              </button>
              <button
                onClick={() => setFilterPaid("all")}
                className="px-4 py-2.5 rounded-xl text-xs font-bold transition-all duration-200"
                style={{
                  background: filterPaid === "all" ? "hsla(220, 20%, 30%, 0.12)" : "transparent",
                  color: filterPaid === "all" ? "white" : "hsl(215 20% 65%)",
                  border: `1px solid ${filterPaid === "all" ? "hsl(220 20% 30% / 0.3)" : "hsl(240 5% 18%)"}`,
                }}
              >
                Tutti
              </button>
            </div>

            {/* Tabella Scadenze */}
            <div className="flex-1 overflow-x-auto pr-1">
              {filteredSchedules.length === 0 ? (
                <div className="text-center py-16 text-slate-500 flex flex-col items-center justify-center">
                  <span className="text-3xl mb-2">📅</span>
                  <p className="text-sm">Nessuna scadenza trovata.</p>
                </div>
              ) : (
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b" style={{ borderColor: "hsl(240 5% 18% / 0.7)" }}>
                      <th className="pb-3.5 font-bold text-slate-400 uppercase tracking-wider text-[9px]">Scadenza</th>
                      <th className="pb-3.5 font-bold text-slate-400 uppercase tracking-wider text-[9px]">Fornitore & Note</th>
                      <th className="pb-3.5 font-bold text-slate-400 uppercase tracking-wider text-[9px]">Categoria</th>
                      <th className="pb-3.5 font-bold text-slate-400 uppercase tracking-wider text-[9px]">Ricorrenza</th>
                      <th className="pb-3.5 font-bold text-slate-400 uppercase tracking-wider text-[9px] text-right">Importo</th>
                      <th className="pb-3.5 font-bold text-slate-400 uppercase tracking-wider text-[9px] text-center">Azioni</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y" style={{ borderColor: "hsl(240 5% 18% / 0.3)" }}>
                    {filteredSchedules.map((sched, index) => {
                      const today = new Date();
                      const dueDateObj = new Date(sched.due_date);
                      const isOverdue = !sched.is_paid && dueDateObj < today;
                      
                      const catName = sched.expense_categories?.name || sched.category;
                      const catColor = sched.expense_categories?.color || "slate";
                      const badge = COLOR_MAP[catColor] || COLOR_MAP.slate;

                      return (
                        <tr key={sched.id} className="hover:bg-white/2 transition-all duration-150 group animate-fade-in" style={{ animationDelay: `${index * 15}ms` }}>
                          <td className="py-4 font-semibold whitespace-nowrap">
                            <span
                              className="inline-flex items-center gap-1.5"
                              style={{ color: isOverdue ? "hsl(0 84% 70%)" : "hsl(215 20% 75%)" }}
                            >
                              {isOverdue && (
                                <span className="relative flex h-2 w-2">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                                </span>
                              )}
                              {dueDateObj.toLocaleDateString("it-IT")}
                            </span>
                          </td>
                          <td className="py-4 pr-3">
                            <div className="text-white font-bold max-w-[200px] truncate">
                              {sched.suppliers?.name || "Nessun Fornitore"}
                            </div>
                            {sched.description && (
                              <div className="text-[10px] text-slate-400 mt-0.5 max-w-[200px] truncate">
                                {sched.description}
                              </div>
                            )}
                          </td>
                          <td className="py-4">
                            <span
                              className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold border"
                              style={{
                                backgroundColor: badge.bg,
                                color: badge.text,
                                borderColor: badge.border,
                              }}
                            >
                              {catName}
                            </span>
                          </td>
                          <td className="py-4 text-slate-400 font-medium">
                            {RECURRENCES.find(r => r.value === sched.recurrence)?.label || sched.recurrence}
                          </td>
                          <td className="py-4 text-right font-black text-white text-sm whitespace-nowrap">
                            {formatCurrency(sched.amount)}
                          </td>
                          <td className="py-4 text-center">
                            <div className="flex items-center justify-center gap-2">
                              {!sched.is_paid && (
                                <button
                                  onClick={() => handlePay(sched.id)}
                                  disabled={isPending}
                                  className="px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-slate-950 border border-emerald-500/25 font-bold transition-all duration-200 text-[10px] flex items-center gap-1"
                                  title="Segna come Pagato"
                                >
                                  <CheckIcon size={10} /> Pagato
                                </button>
                              )}
                              <button
                                onClick={() => handleDelete(sched.id)}
                                className="w-7 h-7 rounded-lg text-xs hover:bg-rose-500/10 hover:text-rose-400 border border-transparent hover:border-rose-500/20 flex items-center justify-center transition-all opacity-60 group-hover:opacity-100"
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
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

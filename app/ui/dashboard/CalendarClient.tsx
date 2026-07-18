"use client";

import { useState, useTransition, useMemo } from "react";
import { type Expense, type PaymentSchedule } from "@/lib/types/database";
import { deleteExpense } from "@/app/actions/expenses";
import { deleteSchedule, paySchedule } from "@/app/actions/schedules";
import { ArrowLeftIcon, ArrowRightIcon, DeleteIcon, CheckIcon, SchedulesIcon, ExpensesIcon } from "./icons";

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

export default function CalendarClient({ expenses: initialExpenses, schedules: initialSchedules }: CalendarClientProps) {
  const [expenses, setExpenses] = useState<ExpenseWithRelations[]>(initialExpenses);
  const [schedules, setSchedules] = useState<ScheduleWithRelations[]>(initialSchedules);
  const [isPending, startTransition] = useTransition();

  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(new Date().toISOString().split("T")[0]);

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
        dateStr: prevMonthDate.toISOString().split("T")[0],
        dayNum: prevDay,
        isCurrentMonth: false
      });
    }

    for (let i = 1; i <= daysInMonth; i++) {
      const currentMonthDate = new Date(year, month, i);
      cells.push({
        dateStr: currentMonthDate.toISOString().split("T")[0],
        dayNum: i,
        isCurrentMonth: true
      });
    }

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

  const getExpensesForDate = (dateStr: string) => {
    return expenses.filter(e => e.date === dateStr);
  };

  const getSchedulesForDate = (dateStr: string) => {
    return schedules.filter(s => s.due_date === dateStr);
  };

  const handlePaySchedule = (id: string) => {
    startTransition(async () => {
      try {
        const res = await paySchedule(id);
        if (!res.success) {
          alert(res.error || "Errore durante la registrazione del pagamento");
          return;
        }

        const target = schedules.find(s => s.id === id);
        if (!target) return;

        if (target.recurrence === "one-time") {
          setSchedules(prev => 
            prev.map(sched => sched.id === id ? { ...sched, is_paid: true } : sched)
          );
        } else {
          // Ricorrente: segna la corrente come pagata, e crea quella futura
          const nextDueDate = new Date(target.due_date);
          if (target.recurrence === "weekly") {
            nextDueDate.setDate(nextDueDate.getDate() + 7);
          } else if (target.recurrence === "monthly") {
            nextDueDate.setMonth(nextDueDate.getMonth() + 1);
          } else if (target.recurrence === "yearly") {
            nextDueDate.setFullYear(nextDueDate.getFullYear() + 1);
          }
          const nextDueDateStr = nextDueDate.toISOString().split("T")[0];

          const nextSched: ScheduleWithRelations = {
            ...target,
            id: Math.random().toString(),
            due_date: nextDueDateStr,
            is_paid: false,
          };

          setSchedules(prev => 
            prev.map(sched => sched.id === id ? { ...sched, is_paid: true } : sched)
                .concat(nextSched)
          );
        }

        // Inoltre, inseriamo la spesa di oggi
        const todayStr = new Date().toISOString().split("T")[0];
        const newExp: ExpenseWithRelations = {
          id: Math.random().toString(),
          user_id: "",
          amount: target.amount,
          category: target.category,
          category_id: target.category_id,
          supplier_id: target.supplier_id,
          description: `Pagamento programmato: ${target.description || "Nessuna descrizione"}`,
          date: todayStr,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          expense_categories: target.expense_categories,
          suppliers: target.suppliers
        };
        setExpenses(prev => [newExp, ...prev]);
      } catch (err: any) {
        alert(err.message || "Errore durante la registrazione");
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

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(val);
  };

  return (
    <div className="p-4 md:p-8 space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="animate-fade-in space-y-1">
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
          Calendario Finanziario
        </h1>
        <p className="text-sm text-slate-400">Visualizzazione unificata delle spese passate ed uscite future.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Calendario Mensile Unificato */}
        <div
          className="lg:col-span-2 rounded-2xl p-6 border shadow-2xl relative overflow-hidden group backdrop-blur-xl animate-fade-in"
          style={{
            background: "linear-gradient(135deg, hsla(240, 10%, 12%, 0.5), hsla(240, 10%, 10%, 0.8))",
            borderColor: "hsla(240, 5%, 18%, 0.7)",
          }}
        >
          <div className="absolute top-[-30%] left-[-20%] w-60 h-60 rounded-full bg-zinc-500/5 blur-[80px] pointer-events-none" />

          {/* Navigazione Mese */}
          <div className="flex justify-between items-center mb-6 relative z-10">
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

          <div className="grid grid-cols-7 gap-1 text-center font-bold text-slate-500 text-[10px] uppercase tracking-wider mb-2 relative z-10">
            <span>Lun</span>
            <span>Mar</span>
            <span>Mer</span>
            <span>Gio</span>
            <span>Ven</span>
            <span>Sab</span>
            <span>Dom</span>
          </div>

          <div className="grid grid-cols-7 gap-1 bg-zinc-950/20 p-1.5 rounded-xl border border-white/5 relative z-10">
            {calendarCells.map((cell, idx) => {
              const isSelected = selectedDate === cell.dateStr;
              const dayExpenses = getExpensesForDate(cell.dateStr);
              const daySchedules = getSchedulesForDate(cell.dateStr);
              
              const totalExpenses = dayExpenses.reduce((sum, e) => sum + Number(e.amount), 0);
              const hasPending = daySchedules.some(s => !s.is_paid);

              const todayStr = new Date().toISOString().split("T")[0];
              const isToday = cell.dateStr === todayStr;

              return (
                <button
                  key={idx}
                  onClick={() => setSelectedDate(cell.dateStr)}
                  className="aspect-square p-1 rounded-xl flex flex-col items-center justify-between border transition-all duration-200 relative group overflow-hidden"
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

                  {totalExpenses > 0 && (
                    <span className="text-[8px] font-black text-rose-400/90 whitespace-nowrap truncate max-w-full">
                      -{Math.round(totalExpenses)}€
                    </span>
                  )}

                  <div className="flex gap-0.5 justify-center w-full pb-0.5">
                    {hasPending && (
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shadow-[0_0_4px_rgba(245,158,11,0.5)] animate-pulse" />
                    )}
                    {daySchedules.some(s => s.is_paid) && (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_4px_rgba(16,185,129,0.5)]" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Dettaglio del Giorno Selezionato */}
        <div className="space-y-6 animate-fade-in">
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

            {/* SEZIONE 1: Spese Effettuate */}
            <div className="space-y-4">
              <h4 className="text-[10px] font-bold text-rose-400 uppercase tracking-widest flex items-center gap-1.5 border-b border-zinc-800 pb-2">
                <ExpensesIcon size={10} /> Spese Registrate ({selectedDateExpenses.length})
              </h4>

              {selectedDateExpenses.length === 0 ? (
                <p className="text-[10px] text-zinc-500 py-1 font-medium">Nessuna spesa effettuata.</p>
              ) : (
                <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1">
                  {selectedDateExpenses.map((exp) => {
                    const catName = exp.expense_categories?.name || exp.category;
                    const catColor = exp.expense_categories?.color || "slate";
                    const badge = COLOR_MAP[catColor] || COLOR_MAP.slate;

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
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black text-rose-400">
                            -{formatCurrency(exp.amount)}
                          </span>
                          <button
                            onClick={() => handleDeleteExpense(exp.id)}
                            className="p-1 rounded hover:bg-rose-500/10 text-slate-500 hover:text-rose-400 transition-colors"
                            title="Elimina Spesa"
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
                    const badge = COLOR_MAP[catColor] || COLOR_MAP.slate;

                    return (
                      <div
                        key={sched.id}
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
                              onClick={() => handlePaySchedule(sched.id)}
                              disabled={isPending}
                              className="p-1 rounded bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-slate-950 border border-emerald-500/25 font-bold transition-all"
                              title="Segna come Pagato"
                            >
                              <CheckIcon size={10} />
                            </button>
                          ) : (
                            <span className="text-[9px] font-bold text-emerald-400">Saldata</span>
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

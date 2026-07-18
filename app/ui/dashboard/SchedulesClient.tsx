"use client";

import { useState, useTransition } from "react";
import { type PaymentSchedule, type ExpenseCategory, type Supplier } from "@/lib/types/database";
import { createSchedule, deleteSchedule, paySchedule } from "@/app/actions/schedules";
import { DeleteIcon, CheckIcon, SchedulesIcon } from "./icons";

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

  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState(categories[0]?.id || "");
  const [supplierId, setSupplierId] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState(new Date().toISOString().split("T")[0]);
  const [recurrence, setRecurrence] = useState<"one-time" | "weekly" | "monthly" | "yearly">("one-time");

  const [filterPaid, setFilterPaid] = useState<"all" | "pending" | "paid">("pending");

  const resetForm = () => {
    setAmount("");
    setCategoryId(categories[0]?.id || "");
    setSupplierId("");
    setDescription("");
    setDueDate(new Date().toISOString().split("T")[0]);
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
          category_name: selectedCat.name,
          description,
          due_date: dueDate,
          recurrence,
        };

        const res = await createSchedule(payload);
        if (!res.success || !res.data) {
          alert(res.error || "Errore durante il salvataggio");
          return;
        }
        setSchedules(prev => [res.data, ...prev].sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime()));
        resetForm();
      } catch (err: any) {
        alert(err.message || "Errore durante la creazione");
      }
    });
  };

  const handlePay = (id: string) => {
    startTransition(async () => {
      try {
        const res = await paySchedule(id);
        if (!res.success) {
          alert(res.error || "Errore durante il pagamento");
          return;
        }

        const target = schedules.find(s => s.id === id);
        if (!target) return;

        if (target.recurrence === "one-time") {
          // Segna semplicemente come pagata
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
                .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())
          );
        }
      } catch (err: any) {
        alert(err.message || "Errore durante la registrazione del pagamento");
      }
    });
  };

  const handleDelete = (id: string) => {
    if (!confirm("Sei sicuro di voler eliminare questa scadenza?")) return;

    startTransition(async () => {
      try {
        const res = await deleteSchedule(id);
        if (!res.success) {
          alert(res.error || "Errore durante l'eliminazione");
          return;
        }
        setSchedules(prev => prev.filter(item => item.id !== id));
      } catch (err: any) {
        alert(err.message || "Errore durante l'eliminazione");
      }
    });
  };

  const filteredSchedules = schedules.filter(sched => {
    if (filterPaid === "pending") return !sched.is_paid;
    if (filterPaid === "paid") return sched.is_paid;
    return true;
  });

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(val);
  };

  return (
    <div className="p-4 md:p-8 space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="animate-fade-in space-y-1">
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
          Scadenziario Pagamenti
        </h1>
        <p className="text-sm text-slate-400">Pianifica le uscite future e automatizza la registrazione delle spese.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Form di pianificazione */}
        <div
          className="rounded-2xl p-6 border h-fit shadow-[0_0_30px_rgba(245,158,11,0.02)] relative overflow-hidden group backdrop-blur-xl animate-fade-in"
          style={{
            background: "linear-gradient(135deg, hsla(38, 60%, 12%, 0.08), hsla(240, 10%, 10%, 0.7))",
            borderColor: "hsla(38, 60%, 50%, 0.15)",
          }}
        >
          <div className="absolute top-[-30%] right-[-20%] w-40 h-40 rounded-full bg-amber-500/5 blur-[50px] pointer-events-none" />

          <h2 className="text-base font-extrabold bg-gradient-to-r from-white to-zinc-300 bg-clip-text text-transparent mb-5 tracking-tight flex items-center gap-2">
            <span className="text-amber-400"><SchedulesIcon size={16} /></span> Pianifica Pagamento
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4 relative z-10">
            {/* Importo */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Importo (€)</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                required
                className="w-full px-4 py-3 rounded-xl text-xs text-white focus:outline-none border transition-all duration-200"
                style={{
                  background: "hsl(240 10% 4% / 0.8)",
                  borderColor: "hsl(240 5% 18%)",
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = "hsl(38 90% 50%)";
                  e.target.style.boxShadow = "0 0 15px rgba(245,158,11,0.15)";
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = "hsl(240 5% 18%)";
                  e.target.style.boxShadow = "none";
                }}
              />
            </div>

            {/* Categoria */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Categoria</label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-xl text-xs text-white focus:outline-none border select-custom transition-all"
                style={{
                  background: "hsl(240 10% 4% / 0.8)",
                  borderColor: "hsl(240 5% 18%)",
                }}
                onFocus={(e) => e.target.style.borderColor = "hsl(38 90% 50%)"}
                onBlur={(e) => e.target.style.borderColor = "hsl(240 5% 18%)"}
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
              <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Fornitore / Servizio</label>
              <select
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                className="w-full px-4 py-3 rounded-xl text-xs text-white focus:outline-none border select-custom transition-all"
                style={{
                  background: "hsl(240 10% 4% / 0.8)",
                  borderColor: "hsl(240 5% 18%)",
                }}
                onFocus={(e) => e.target.style.borderColor = "hsl(38 90% 50%)"}
                onBlur={(e) => e.target.style.borderColor = "hsl(240 5% 18%)"}
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
              <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Data di Scadenza</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-xl text-xs text-white focus:outline-none border text-left transition-all"
                style={{
                  background: "hsl(240 10% 4% / 0.8)",
                  borderColor: "hsl(240 5% 18%)",
                }}
                onFocus={(e) => e.target.style.borderColor = "hsl(38 90% 50%)"}
                onBlur={(e) => e.target.style.borderColor = "hsl(240 5% 18%)"}
              />
            </div>

            {/* Ricorrenza */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Ricorrenza</label>
              <select
                value={recurrence}
                onChange={(e) => setRecurrence(e.target.value as any)}
                className="w-full px-4 py-3 rounded-xl text-xs text-white focus:outline-none border select-custom transition-all"
                style={{
                  background: "hsl(240 10% 4% / 0.8)",
                  borderColor: "hsl(240 5% 18%)",
                }}
                onFocus={(e) => e.target.style.borderColor = "hsl(38 90% 50%)"}
                onBlur={(e) => e.target.style.borderColor = "hsl(240 5% 18%)"}
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
              <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Note / Dettaglio</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Note aggiuntive..."
                className="w-full px-4 py-3 rounded-xl text-xs text-white focus:outline-none border transition-all"
                style={{
                  background: "hsl(240 10% 4% / 0.8)",
                  borderColor: "hsl(240 5% 18%)",
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = "hsl(38 90% 50%)";
                  e.target.style.boxShadow = "0 0 15px rgba(245,158,11,0.15)";
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = "hsl(240 5% 18%)";
                  e.target.style.boxShadow = "none";
                }}
              />
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="w-full py-3 rounded-xl text-xs font-extrabold text-white transition-all shadow-[0_0_20px_rgba(245,158,11,0.15)] hover:shadow-[0_0_30px_rgba(245,158,11,0.3)] active:scale-98 mt-2"
              style={{
                background: "linear-gradient(135deg, hsl(38 90% 50%), hsl(30 80% 45%))",
                cursor: isPending ? "not-allowed" : "pointer",
              }}
            >
              {isPending ? "Salvataggio..." : "Programma Pagamento"}
            </button>
          </form>
        </div>

        {/* Tabella Scadenze */}
        <div
          className="lg:col-span-2 rounded-2xl p-6 border flex flex-col space-y-5 shadow-2xl relative overflow-hidden group backdrop-blur-xl animate-fade-in"
          style={{
            background: "linear-gradient(135deg, hsla(240, 10%, 12%, 0.5), hsla(240, 10%, 10%, 0.8))",
            borderColor: "hsla(240, 5%, 18%, 0.7)",
          }}
        >
          <div className="absolute top-[-30%] left-[-20%] w-60 h-60 rounded-full bg-zinc-500/5 blur-[80px] pointer-events-none" />

          {/* Filtro dello Stato */}
          <div className="flex gap-2.5 relative z-10">
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
          <div className="flex-1 overflow-x-auto pr-1 relative z-10">
            {filteredSchedules.length === 0 ? (
              <div className="text-center py-16 text-slate-500 flex flex-col items-center justify-center">
                <span className="text-3xl mb-2">📅</span>
                <p className="text-sm">Nessun pagamento programmato trovato.</p>
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
                            <div className="text-[10px] text-slate-400 mt-0.5 max-w-[200px] truncate font-medium">
                              {sched.description}
                            </div>
                          )}
                        </td>
                        <td className="py-4">
                          <span
                            className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold border transition-transform duration-300 group-hover:scale-102"
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
                            {!sched.is_paid ? (
                              <button
                                onClick={() => handlePay(sched.id)}
                                disabled={isPending}
                                className="px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-slate-950 border border-emerald-500/25 font-bold transition-all duration-200 text-[10px] flex items-center gap-1"
                                title="Segna come Pagato"
                              >
                                <CheckIcon size={10} /> Pagato
                              </button>
                            ) : (
                              <span className="inline-flex items-center px-2.5 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold text-[9px] select-none">
                                Saldata
                              </span>
                            )}
                            <button
                              onClick={() => handleDelete(sched.id)}
                              className="w-7 h-7 rounded-lg text-xs hover:bg-rose-500/10 hover:text-rose-400 border border-transparent hover:border-rose-500/20 flex items-center justify-center transition-all opacity-0 group-hover:opacity-100"
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

      </div>
    </div>
  );
}

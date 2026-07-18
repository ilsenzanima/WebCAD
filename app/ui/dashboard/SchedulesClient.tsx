"use client";

import { useState, useTransition } from "react";
import { type PaymentSchedule } from "@/lib/types/database";
import { createSchedule, deleteSchedule, paySchedule } from "@/app/actions/schedules";

interface SchedulesClientProps {
  initialSchedules: PaymentSchedule[];
}

const CATEGORIES = [
  "🏠 Casa & Affitto",
  "🔌 Bollette & Utenze",
  "🛒 Spesa & Alimentari",
  "🚗 Auto & Trasporti",
  "🍔 Svago & Ristoranti",
  "💻 Tecnologia & Lavoro",
  "🏥 Salute & Assicurazioni",
  "💼 Tasse & Servizi",
  "📦 Altro",
];

const RECURRENCES = [
  { value: "one-time", label: "Una Tantum" },
  { value: "weekly", label: "Settimanale" },
  { value: "monthly", label: "Mensile" },
  { value: "yearly", label: "Annuale" },
];

const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  "🏠 Casa & Affitto": { bg: "rgba(99,102,241,0.12)", text: "hsl(245 85% 75%)", border: "rgba(99,102,241,0.2)" },
  "🔌 Bollette & Utenze": { bg: "rgba(245,158,11,0.12)", text: "hsl(38 90% 70%)", border: "rgba(245,158,11,0.2)" },
  "🛒 Spesa & Alimentari": { bg: "rgba(16,185,129,0.12)", text: "hsl(150 70% 70%)", border: "rgba(16,185,129,0.2)" },
  "🚗 Auto & Trasporti": { bg: "rgba(239,68,68,0.12)", text: "hsl(0 80% 75%)", border: "rgba(239,68,68,0.2)" },
  "🍔 Svago & Ristoranti": { bg: "rgba(236,72,153,0.12)", text: "hsl(330 80% 75%)", border: "rgba(236,72,153,0.2)" },
  "💻 Tecnologia & Lavoro": { bg: "rgba(14,165,233,0.12)", text: "hsl(200 85% 70%)", border: "rgba(14,165,233,0.2)" },
  "🏥 Salute & Assicurazioni": { bg: "rgba(34,197,94,0.12)", text: "hsl(142 60% 70%)", border: "rgba(34,197,94,0.2)" },
  "💼 Tasse & Servizi": { bg: "rgba(107,114,128,0.15)", text: "hsl(215 15% 75%)", border: "rgba(107,114,128,0.25)" },
  "📦 Altro": { bg: "rgba(168,85,247,0.12)", text: "hsl(270 80% 75%)", border: "rgba(168,85,247,0.2)" },
};

export default function SchedulesClient({ initialSchedules }: SchedulesClientProps) {
  const [schedules, setSchedules] = useState<PaymentSchedule[]>(initialSchedules);
  const [isPending, startTransition] = useTransition();

  // Stati del form
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState(new Date().toISOString().split("T")[0]);
  const [recurrence, setRecurrence] = useState<"one-time" | "weekly" | "monthly" | "yearly">("one-time");

  // Filtri
  const [filterPaid, setFilterPaid] = useState<"all" | "pending" | "paid">("pending");

  const resetForm = () => {
    setAmount("");
    setCategory(CATEGORIES[0]);
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

    startTransition(async () => {
      try {
        const payload = {
          amount: Number(amount),
          category,
          description,
          due_date: dueDate,
          recurrence,
        };

        await createSchedule(payload);
        
        const newSched: PaymentSchedule = {
          id: Math.random().toString(),
          user_id: "",
          amount: Number(amount),
          category,
          description,
          due_date: dueDate,
          recurrence,
          is_paid: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
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
      {/* Header con animazione */}
      <div className="animate-fade-in space-y-1">
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
          Scadenziario Pagamenti
        </h1>
        <p className="text-sm text-slate-400">Pianifica le uscite future e automatizza la registrazione delle spese.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Form di pianificazione (1 colonna) */}
        <div
          className="rounded-2xl p-6 border h-fit shadow-xl backdrop-blur-md"
          style={{
            background: "hsl(220 32% 10% / 0.8)",
            borderColor: "hsl(220 20% 16% / 0.7)",
          }}
        >
          <h2 className="text-base font-bold text-white mb-5 tracking-tight flex items-center gap-2">
            <span>📅</span> Pianifica Pagamento
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
                className="w-full px-4 py-3 rounded-xl text-xs text-white focus:outline-none transition-all duration-200 border"
                style={{
                  background: "hsl(220 26% 14% / 0.8)",
                  borderColor: "hsl(220 20% 22%)",
                }}
              />
            </div>

            {/* Categoria */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Categoria</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-4 py-3 rounded-xl text-xs text-white focus:outline-none border select-custom"
                style={{
                  background: "hsl(220 26% 14% / 0.8)",
                  borderColor: "hsl(220 20% 22%)",
                }}
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat} style={{ background: "hsl(220 32% 10%)" }}>
                    {cat}
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
                  background: "hsl(220 26% 14% / 0.8)",
                  borderColor: "hsl(220 20% 22%)",
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
                  background: "hsl(220 26% 14% / 0.8)",
                  borderColor: "hsl(220 20% 22%)",
                }}
              >
                {RECURRENCES.map((rec) => (
                  <option key={rec.value} value={rec.value} style={{ background: "hsl(220 32% 10%)" }}>
                    {rec.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Descrizione */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Descrizione / Intestatario</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="es. Affitto casa, Assicurazione auto..."
                className="w-full px-4 py-3 rounded-xl text-xs text-white focus:outline-none transition-all duration-200 border"
                style={{
                  background: "hsl(220 26% 14% / 0.8)",
                  borderColor: "hsl(220 20% 22%)",
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

        {/* Elenco Scadenze (2 colonne) */}
        <div
          className="lg:col-span-2 rounded-2xl p-6 border flex flex-col space-y-5 shadow-xl backdrop-blur-md"
          style={{
            background: "hsl(220 32% 10% / 0.8)",
            borderColor: "hsl(220 20% 16% / 0.7)",
          }}
        >
          {/* Filtro dello Stato con pulsanti moderni ed eleganti */}
          <div className="flex gap-2.5">
            <button
              onClick={() => setFilterPaid("pending")}
              className="px-4 py-2.5 rounded-xl text-xs font-bold transition-all duration-200"
              style={{
                background: filterPaid === "pending" ? "hsla(38, 90%, 50%, 0.12)" : "transparent",
                color: filterPaid === "pending" ? "hsl(38 90% 55%)" : "hsl(215 20% 65%)",
                border: `1px solid ${filterPaid === "pending" ? "hsl(38 90% 50% / 0.3)" : "hsl(220 20% 16% / 0.8)"}`,
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
                border: `1px solid ${filterPaid === "paid" ? "hsl(142 70% 45% / 0.3)" : "hsl(220 20% 16% / 0.8)"}`,
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
                border: `1px solid ${filterPaid === "all" ? "hsl(220 20% 30% / 0.3)" : "hsl(220 20% 16% / 0.8)"}`,
              }}
            >
              Tutti
            </button>
          </div>

          {/* Tabella Scadenze */}
          <div className="flex-1 overflow-x-auto pr-1">
            {filteredSchedules.length === 0 ? (
              <div className="text-center py-16 text-slate-500 flex flex-col items-center justify-center">
                <span className="text-4xl mb-2">📅</span>
                <p className="text-sm">Nessuna scadenza trovata.</p>
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b" style={{ borderColor: "hsl(220 20% 16% / 0.7)" }}>
                    <th className="pb-3.5 font-bold text-slate-400 uppercase tracking-wider text-[9px]">Scadenza</th>
                    <th className="pb-3.5 font-bold text-slate-400 uppercase tracking-wider text-[9px]">Descrizione</th>
                    <th className="pb-3.5 font-bold text-slate-400 uppercase tracking-wider text-[9px]">Categoria</th>
                    <th className="pb-3.5 font-bold text-slate-400 uppercase tracking-wider text-[9px]">Ricorrenza</th>
                    <th className="pb-3.5 font-bold text-slate-400 uppercase tracking-wider text-[9px] text-right">Importo</th>
                    <th className="pb-3.5 font-bold text-slate-400 uppercase tracking-wider text-[9px] text-center">Azioni</th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: "hsl(220 20% 16% / 0.4)" }}>
                  {filteredSchedules.map((sched, index) => {
                    const today = new Date();
                    const dueDateObj = new Date(sched.due_date);
                    const isOverdue = !sched.is_paid && dueDateObj < today;
                    const badge = CATEGORY_COLORS[sched.category] || { bg: "hsla(220, 20%, 30%, 0.12)", text: "white", border: "rgba(255,255,255,0.05)" };

                    return (
                      <tr key={sched.id} className="hover:bg-white/2 transition-all duration-150 group animate-fade-in" style={{ animationDelay: `${index * 20}ms` }}>
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
                        <td className="py-4 text-white font-bold max-w-[180px] truncate">
                          {sched.description || "Pagamento"}
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
                            {sched.category}
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
                                className="px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-slate-950 hover:border-emerald-500 border border-emerald-500/25 font-bold transition-all duration-200 text-[10px]"
                                title="Segna come Pagato"
                              >
                                Pagato ✔
                              </button>
                            )}
                            <button
                              onClick={() => handleDelete(sched.id)}
                              className="w-7 h-7 rounded-lg text-xs hover:bg-rose-500/10 hover:text-rose-400 border border-transparent hover:border-rose-500/20 flex items-center justify-center transition-all opacity-60 group-hover:opacity-100"
                              title="Elimina"
                            >
                              🗑️
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

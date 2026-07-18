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
        
        // Aggiunta locale temporanea prima del refresh
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
        
        // Aggiorna lo stato localmente
        setSchedules(prev => 
          prev.map(sched => {
            if (sched.id !== id) return sched;
            
            if (sched.recurrence === "one-time") {
              return { ...sched, is_paid: true };
            } else {
              // Sposta la data in avanti per l'anteprima
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
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">Scadenziario Pagamenti</h1>
        <p className="text-sm text-gray-400 mt-1">Pianifica le uscite future e automatizza la registrazione delle spese.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Form di pianificazione (1 colonna) */}
        <div
          className="rounded-2xl p-6 border h-fit"
          style={{
            background: "hsl(220 32% 10%)",
            borderColor: "hsl(220 20% 16%)",
          }}
        >
          <h2 className="text-lg font-bold text-white mb-4">📅 Pianifica Pagamento</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Importo */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-gray-400 uppercase">Importo (€)</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                required
                className="w-full px-4 py-2.5 rounded-xl text-sm text-white focus:outline-none"
                style={{
                  background: "hsl(220 26% 14%)",
                  border: "1px solid hsl(220 20% 22%)",
                }}
              />
            </div>

            {/* Categoria */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-gray-400 uppercase">Categoria</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl text-sm text-white focus:outline-none"
                style={{
                  background: "hsl(220 26% 14%)",
                  border: "1px solid hsl(220 20% 22%)",
                }}
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {/* Scadenza */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-gray-400 uppercase">Data di Scadenza</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                required
                className="w-full px-4 py-2.5 rounded-xl text-sm text-white focus:outline-none text-left"
                style={{
                  background: "hsl(220 26% 14%)",
                  border: "1px solid hsl(220 20% 22%)",
                }}
              />
            </div>

            {/* Ricorrenza */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-gray-400 uppercase">Ricorrenza</label>
              <select
                value={recurrence}
                onChange={(e) => setRecurrence(e.target.value as any)}
                className="w-full px-4 py-2.5 rounded-xl text-sm text-white focus:outline-none"
                style={{
                  background: "hsl(220 26% 14%)",
                  border: "1px solid hsl(220 20% 22%)",
                }}
              >
                {RECURRENCES.map((rec) => (
                  <option key={rec.value} value={rec.value}>
                    {rec.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Descrizione */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-gray-400 uppercase">Descrizione / Intestatario</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="es. Affitto mensile casa, Assicurazione auto..."
                className="w-full px-4 py-2.5 rounded-xl text-sm text-white focus:outline-none"
                style={{
                  background: "hsl(220 26% 14%)",
                  border: "1px solid hsl(220 20% 22%)",
                }}
              />
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="w-full py-2.5 rounded-xl text-xs font-semibold text-white transition-all shadow-md mt-2"
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
          className="lg:col-span-2 rounded-2xl p-6 border flex flex-col space-y-4"
          style={{
            background: "hsl(220 32% 10%)",
            borderColor: "hsl(220 20% 16%)",
          }}
        >
          {/* Filtro dello Stato */}
          <div className="flex gap-2">
            <button
              onClick={() => setFilterPaid("pending")}
              className="px-4 py-2 rounded-xl text-xs font-semibold transition-all"
              style={{
                background: filterPaid === "pending" ? "hsla(220, 90%, 56%, 0.12)" : "transparent",
                color: filterPaid === "pending" ? "hsl(220 90% 56%)" : "hsl(215 20% 65%)",
                border: `1px solid ${filterPaid === "pending" ? "hsl(220 90% 56% / 0.3)" : "hsl(220 20% 16%)"}`,
              }}
            >
              ⏳ Da Pagare
            </button>
            <button
              onClick={() => setFilterPaid("paid")}
              className="px-4 py-2 rounded-xl text-xs font-semibold transition-all"
              style={{
                background: filterPaid === "paid" ? "hsla(142, 70%, 45%, 0.12)" : "transparent",
                color: filterPaid === "paid" ? "hsl(142 70% 45%)" : "hsl(215 20% 65%)",
                border: `1px solid ${filterPaid === "paid" ? "hsl(142 70% 45% / 0.3)" : "hsl(220 20% 16%)"}`,
              }}
            >
              ✅ Pagati
            </button>
            <button
              onClick={() => setFilterPaid("all")}
              className="px-4 py-2 rounded-xl text-xs font-semibold transition-all"
              style={{
                background: filterPaid === "all" ? "hsla(220, 20%, 30%, 0.12)" : "transparent",
                color: filterPaid === "all" ? "white" : "hsl(215 20% 65%)",
                border: `1px solid ${filterPaid === "all" ? "hsl(220 20% 30% / 0.3)" : "hsl(220 20% 16%)"}`,
              }}
            >
              Tutti
            </button>
          </div>

          {/* Tabella Scadenze */}
          <div className="flex-1 overflow-x-auto">
            {filteredSchedules.length === 0 ? (
              <div className="text-center p-12 text-gray-500 flex flex-col items-center justify-center">
                <span className="text-4xl mb-2">📅</span>
                <p className="text-sm">Nessun pagamento programmato trovato.</p>
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b" style={{ borderColor: "hsl(220 20% 16%)" }}>
                    <th className="pb-3 font-semibold text-gray-400">Scadenza</th>
                    <th className="pb-3 font-semibold text-gray-400">Descrizione</th>
                    <th className="pb-3 font-semibold text-gray-400">Categoria</th>
                    <th className="pb-3 font-semibold text-gray-400">Ricorrenza</th>
                    <th className="pb-3 font-semibold text-gray-400 text-right">Importo</th>
                    <th className="pb-3 font-semibold text-gray-400 text-center">Azioni</th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: "hsl(220 20% 16%)" }}>
                  {filteredSchedules.map((sched) => {
                    const today = new Date();
                    const dueDateObj = new Date(sched.due_date);
                    const isOverdue = !sched.is_paid && dueDateObj < today;

                    return (
                      <tr key={sched.id} className="hover:bg-white/2 transition-colors">
                        <td className="py-3.5 font-medium" style={{ color: isOverdue ? "hsl(0 80% 70%)" : "hsl(215 20% 75%)" }}>
                          {dueDateObj.toLocaleDateString("it-IT")} {isOverdue && "(Scaduto)"}
                        </td>
                        <td className="py-3.5 text-white font-semibold">{sched.description || "Pagamento"}</td>
                        <td className="py-3.5 text-gray-400">{sched.category}</td>
                        <td className="py-3.5 text-gray-500 uppercase tracking-widest text-[9px]">
                          {RECURRENCES.find(r => r.value === sched.recurrence)?.label || sched.recurrence}
                        </td>
                        <td className="py-3.5 text-right font-bold text-white">
                          {formatCurrency(sched.amount)}
                        </td>
                        <td className="py-3.5 text-center">
                          <div className="flex items-center justify-center gap-2">
                            {!sched.is_paid && (
                              <button
                                onClick={() => handlePay(sched.id)}
                                disabled={isPending}
                                className="px-2 py-1 rounded bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 font-bold transition-all text-[10px]"
                                title="Segna come Pagato"
                              >
                                Pagato ✔
                              </button>
                            )}
                            <button
                              onClick={() => handleDelete(sched.id)}
                              className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors"
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

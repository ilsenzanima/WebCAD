"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { type PaymentSchedule, type ExpenseCategory, type Supplier } from "@/lib/types/database";
import { createSchedule, updateSchedule, deleteSchedule, paySchedule } from "@/app/actions/schedules";
import { createSupplier } from "@/app/actions/suppliers";
import { syncSchedulesToCalendar } from "@/app/actions/google";
import { DEDICATED_CALENDAR_NAME } from "@/lib/gcalendar";
import { formatCurrency, formatDate, toLocalDateStr } from "@/lib/format";
import { getNextDueDate } from "@/lib/recurrence";
import { DeleteIcon, EditIcon, CheckIcon, SchedulesIcon } from "./icons";

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
  googleConnected: boolean;
  onExpenseCreated?: (expense: any) => void;
  onSupplierCreated?: (supplier: Supplier) => void;
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

export default function SchedulesClient({ initialSchedules, categories, suppliers, googleConnected, onExpenseCreated, onSupplierCreated }: SchedulesClientProps) {
  const [schedules, setSchedules] = useState<ScheduleWithRelations[]>(initialSchedules);
  const [suppliersList, setSuppliersList] = useState<Supplier[]>(suppliers);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const googleError = searchParams.get("google_error");
    if (googleError) {
      alert(`Errore durante il collegamento a Google: ${googleError}`);
      router.replace("/dashboard/schedules");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState(categories[0]?.id || "");
  const [supplierId, setSupplierId] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState(toLocalDateStr());
  const [recurrence, setRecurrence] = useState<"one-time" | "weekly" | "monthly" | "yearly">("one-time");
  const [editingId, setEditingId] = useState<string | null>(null);

  const [filterPaid, setFilterPaid] = useState<"all" | "pending" | "paid">("pending");
  const [isSyncingCalendar, setIsSyncingCalendar] = useState(false);

  // Aggiunta rapida di un nuovo fornitore dal form
  const [isAddingSupplier, setIsAddingSupplier] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState("");
  const [newSupplierIsUtility, setNewSupplierIsUtility] = useState(false);
  const [newSupplierUnit, setNewSupplierUnit] = useState("kWh");
  const [isCreatingSupplier, setIsCreatingSupplier] = useState(false);

  const handleCreateSupplierInline = () => {
    if (!newSupplierName.trim()) {
      alert("Inserisci il nome del fornitore");
      return;
    }
    setIsCreatingSupplier(true);
    startTransition(async () => {
      try {
        const res = await createSupplier({
          name: newSupplierName.trim(),
          is_utility: newSupplierIsUtility,
          consumption_unit: newSupplierIsUtility ? newSupplierUnit : null,
        });
        if (!res.success || !res.data) {
          alert(res.error || "Errore durante la creazione del fornitore");
          return;
        }
        setSuppliersList(prev => [...prev, res.data].sort((a, b) => a.name.localeCompare(b.name)));
        setSupplierId(res.data.id);
        onSupplierCreated?.(res.data);
        setIsAddingSupplier(false);
        setNewSupplierName("");
        setNewSupplierIsUtility(false);
        setNewSupplierUnit("kWh");
      } catch (err: any) {
        alert(err.message || "Errore durante la creazione del fornitore");
      } finally {
        setIsCreatingSupplier(false);
      }
    });
  };

  const resetForm = () => {
    setAmount("");
    setCategoryId(categories[0]?.id || "");
    setSupplierId("");
    setDescription("");
    setDueDate(toLocalDateStr());
    setRecurrence("one-time");
    setEditingId(null);
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

        if (editingId) {
          const res = await updateSchedule(editingId, payload);
          if (!res.success || !res.data) {
            alert(res.error || "Errore durante la modifica");
            return;
          }
          setSchedules(prev =>
            prev.map(s => s.id === editingId ? res.data : s)
              .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())
          );
        } else {
          const res = await createSchedule(payload);
          if (!res.success || !res.data) {
            alert(res.error || "Errore durante il salvataggio");
            return;
          }
          setSchedules(prev => [res.data, ...prev].sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime()));
        }
        resetForm();
      } catch (err: any) {
        alert(err.message || "Errore durante il salvataggio");
      }
    });
  };

  const handleEdit = (item: ScheduleWithRelations) => {
    setEditingId(item.id);
    setAmount(String(item.amount));
    setCategoryId(item.category_id || categories[0]?.id || "");
    setSupplierId(item.supplier_id || "");
    setDescription(item.description || "");
    setDueDate(item.due_date);
    setRecurrence(item.recurrence);
  };

  const handlePay = (scheduleId: string) => {
    startTransition(async () => {
      try {
        const res = await paySchedule(scheduleId);
        if (!res.success) {
          alert(res.error || "Errore nel contrassegnare come pagato");
          return;
        }

        const target = schedules.find(s => s.id === scheduleId);

        setSchedules(prev => {
          const updated = prev.map(s => s.id === scheduleId ? { ...s, is_paid: true } : s);
          if (target && target.recurrence !== "one-time") {
            const nextDueDateStr = getNextDueDate(target.due_date, target.recurrence);
            const nextSched: ScheduleWithRelations = {
              ...target,
              id: Math.random().toString(),
              due_date: nextDueDateStr,
              is_paid: false,
            };
            return [...updated, nextSched].sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
          }
          return updated;
        });

        if (target && onExpenseCreated) {
          onExpenseCreated({
            id: Math.random().toString(),
            user_id: "",
            amount: target.amount,
            category: target.category,
            category_id: target.category_id,
            supplier_id: target.supplier_id,
            schedule_id: target.id,
            budget_id: target.budget_id,
            account_id: null,
            consumption_value: null,
            description: `Pagamento programmato: ${target.description || "Nessuna descrizione"}`,
            date: toLocalDateStr(),
            is_income: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            expense_categories: target.expense_categories,
            suppliers: target.suppliers,
          });
        }
      } catch (err: any) {
        alert(err.message || "Errore durante il salvataggio");
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
        if (editingId === id) resetForm();
      } catch (err: any) {
        alert(err.message || "Errore durante l'eliminazione");
      }
    });
  };

  // Sincronizzazione con il Calendario Google Separato
  const handleSyncGoogleCalendar = async () => {
    if (!googleConnected) {
      alert("Collega prima il tuo account Google per poter sincronizzare le scadenze su Calendar.");
      return;
    }
    if (schedules.length === 0) {
      alert("Nessuna scadenza da sincronizzare.");
      return;
    }

    setIsSyncingCalendar(true);
    try {
      const payload = schedules.map((s) => ({
        id: s.id,
        amount: s.amount,
        description: s.description,
        due_date: s.due_date,
        category: s.expense_categories?.name || s.category,
        supplier_name: s.suppliers?.name,
        is_paid: s.is_paid,
        google_event_id: (s as any).google_event_id ?? null,
      }));

      const res = await syncSchedulesToCalendar(payload);
      if (!res.success) {
        alert(res.error || "Errore sincronizzazione Google Calendar");
        return;
      }

      if (res.updates?.length) {
        setSchedules(prev => prev.map(s => {
          const match = res.updates!.find(u => u.id === s.id);
          return match ? { ...s, google_event_id: match.google_event_id } as any : s;
        }));
      }

      alert(`Sincronizzate ${res.synced} scadenze sul calendario dedicato '${DEDICATED_CALENDAR_NAME}'.`);
    } catch (err: any) {
      alert("Errore sincronizzazione Google Calendar: " + err.message);
    } finally {
      setIsSyncingCalendar(false);
    }
  };

  const filteredSchedules = schedules.filter(s => {
    if (filterPaid === "pending") return !s.is_paid;
    if (filterPaid === "paid") return s.is_paid;
    return true;
  });

  return (
    <div className="p-4 md:p-8 space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="animate-fade-in flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
            Scadenziario Pagamenti
          </h1>
          <p className="text-sm text-slate-400 mt-1">Pianifica le prossime uscite ed evita ritardi sulle bollette.</p>
        </div>

        {/* Bottone Sincronizzazione Calendario Google Separato / Collegamento */}
        {googleConnected ? (
          <button
            onClick={handleSyncGoogleCalendar}
            disabled={isSyncingCalendar}
            className="px-4 py-2.5 rounded-xl text-xs font-extrabold text-amber-300 bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 transition-all flex items-center gap-2 shadow-[0_0_15px_rgba(245,158,11,0.15)] disabled:opacity-50"
          >
            <span>📅</span> {isSyncingCalendar ? "Sincronizzazione in corso..." : "Sincronizza Calendario Google Dedicato"}
          </button>
        ) : (
          <a
            href="/api/google/connect?next=/dashboard/schedules"
            className="px-4 py-2.5 rounded-xl text-xs font-extrabold text-amber-300 bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 transition-all flex items-center gap-2 shadow-[0_0_15px_rgba(245,158,11,0.15)]"
          >
            <span>🔗</span> Collega Google per sincronizzare il Calendario
          </a>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Form Nuova Scadenza (1 Colonna) */}
        <div
          className="rounded-2xl p-6 border relative overflow-hidden group shadow-2xl backdrop-blur-xl animate-fade-in h-fit"
          style={{
            background: "linear-gradient(135deg, hsla(38, 60%, 15%, 0.08), hsla(240, 10%, 10%, 0.7))",
            borderColor: "hsla(38, 60%, 50%, 0.15)",
          }}
        >
          <div className="absolute top-[-30%] right-[-20%] w-40 h-40 rounded-full bg-amber-500/5 blur-[50px] pointer-events-none" />

          <h2 className="text-base font-extrabold bg-gradient-to-r from-white to-zinc-300 bg-clip-text text-transparent mb-5 tracking-tight flex items-center gap-2 justify-between">
            <span className="flex items-center gap-2">
              <span className="text-amber-400"><SchedulesIcon size={16} /></span>
              {editingId ? "Modifica Scadenza" : "Programma Scadenza"}
            </span>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="text-[9px] font-bold text-zinc-500 hover:text-white normal-case tracking-normal"
              >
                Annulla
              </button>
            )}
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
                className="w-full px-4 py-3 rounded-xl text-xs text-white focus:outline-none transition-all duration-200 border"
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
              <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Fornitore / Gestore</label>
              {!isAddingSupplier ? (
                <select
                  value={supplierId}
                  onChange={(e) => {
                    if (e.target.value === "__new__") {
                      setIsAddingSupplier(true);
                      return;
                    }
                    setSupplierId(e.target.value);
                  }}
                  className="w-full px-4 py-3 rounded-xl text-xs text-white focus:outline-none border select-custom transition-all"
                  style={{
                    background: "hsl(240 10% 4% / 0.8)",
                    borderColor: "hsl(240 5% 18%)",
                  }}
                >
                  <option value="" style={{ background: "hsl(240 10% 10%)" }}>Nessun Fornitore</option>
                  {suppliersList.map((sup) => (
                    <option key={sup.id} value={sup.id} style={{ background: "hsl(240 10% 10%)" }}>
                      {sup.name}
                    </option>
                  ))}
                  <option value="__new__" style={{ background: "hsl(240 10% 10%)" }}>+ Aggiungi nuovo fornitore...</option>
                </select>
              ) : (
                <div className="space-y-2 animate-fade-in">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      autoFocus
                      value={newSupplierName}
                      onChange={(e) => setNewSupplierName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleCreateSupplierInline(); } }}
                      placeholder="Nome nuovo fornitore"
                      className="flex-1 px-4 py-3 rounded-xl text-xs text-white focus:outline-none border transition-all"
                      style={{ background: "hsl(240 10% 4% / 0.8)", borderColor: "hsl(38 90% 50%)" }}
                    />
                    <button
                      type="button"
                      onClick={handleCreateSupplierInline}
                      disabled={isCreatingSupplier}
                      className="px-3 rounded-xl text-xs font-extrabold text-white bg-amber-600 hover:bg-amber-500 transition-all disabled:opacity-50"
                    >
                      ✓
                    </button>
                    <button
                      type="button"
                      onClick={() => { setIsAddingSupplier(false); setNewSupplierName(""); }}
                      className="px-3 rounded-xl text-xs font-bold text-zinc-400 hover:text-white border border-zinc-800"
                    >
                      ✕
                    </button>
                  </div>
                  <label className="flex items-center gap-2 text-[9px] font-bold text-zinc-500 uppercase tracking-wider cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newSupplierIsUtility}
                      onChange={(e) => setNewSupplierIsUtility(e.target.checked)}
                      className="accent-amber-500"
                    />
                    È un'utenza (luce, gas, acqua...)
                  </label>
                  {newSupplierIsUtility && (
                    <select
                      value={newSupplierUnit}
                      onChange={(e) => setNewSupplierUnit(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg text-[10px] text-white bg-zinc-950 border border-zinc-800 focus:outline-none"
                    >
                      <option value="kWh">kWh (luce)</option>
                      <option value="m³">m³ (gas/acqua)</option>
                      <option value="L">Litri</option>
                      <option value="GB">GB (dati)</option>
                    </select>
                  )}
                </div>
              )}
            </div>

            {/* Data Scadenza */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Data di Scadenza</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-xl text-xs text-white focus:outline-none border"
                style={{
                  background: "hsl(240 10% 4% / 0.8)",
                  borderColor: "hsl(240 5% 18%)",
                }}
              />
            </div>

            {/* Ricorrenza */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Ricorrenza Pagamento</label>
              <select
                value={recurrence}
                onChange={(e) => setRecurrence(e.target.value as any)}
                className="w-full px-4 py-3 rounded-xl text-xs text-white focus:outline-none border select-custom"
                style={{
                  background: "hsl(240 10% 4% / 0.8)",
                  borderColor: "hsl(240 5% 18%)",
                }}
              >
                {RECURRENCES.map((r) => (
                  <option key={r.value} value={r.value} style={{ background: "hsl(240 10% 10%)" }}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Descrizione / Note */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Descrizione / Note</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="es. Rata Mutuo, Bolletta Gas"
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
              className="w-full py-3 rounded-xl text-xs font-extrabold text-white transition-all shadow-[0_0_20px_rgba(245,158,11,0.15)] hover:shadow-[0_0_30px_rgba(245,158,11,0.3)] active:scale-98"
              style={{
                background: "linear-gradient(135deg, hsl(38 90% 50%), hsl(30 80% 45%))",
                cursor: isPending ? "not-allowed" : "pointer",
              }}
            >
              {isPending ? "Salvataggio..." : editingId ? "Salva Modifiche" : "Salva Scadenza"}
            </button>
          </form>
        </div>

        {/* Registro Tabellare Scadenze (2 Colonne) */}
        <div
          className="lg:col-span-2 rounded-2xl p-6 border flex flex-col space-y-5 shadow-2xl relative overflow-hidden group backdrop-blur-xl animate-fade-in"
          style={{
            background: "linear-gradient(135deg, hsla(240, 10%, 12%, 0.5), hsla(240, 10%, 10%, 0.8))",
            borderColor: "hsla(240, 5%, 18%, 0.7)",
          }}
        >
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 relative z-10">
            <h3 className="text-sm font-extrabold text-white tracking-wide">
              📋 Registro Scadenze & Pagamenti
            </h3>

            {/* Filtro Stato */}
            <div className="flex gap-2 p-1 bg-zinc-950/80 border border-white/10 rounded-xl text-[10px] font-bold">
              <button
                type="button"
                onClick={() => setFilterPaid("pending")}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  filterPaid === "pending" ? "bg-amber-500/20 text-amber-300 border border-amber-500/30" : "text-zinc-500"
                }`}
              >
                Da Saldare
              </button>
              <button
                type="button"
                onClick={() => setFilterPaid("paid")}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  filterPaid === "paid" ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" : "text-zinc-500"
                }`}
              >
                Saldate
              </button>
              <button
                type="button"
                onClick={() => setFilterPaid("all")}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  filterPaid === "all" ? "bg-zinc-800 text-white" : "text-zinc-500"
                }`}
              >
                Tutte
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-x-auto pr-1 relative z-10 max-h-[450px] overflow-y-auto">
            {filteredSchedules.length === 0 ? (
              <div className="text-center py-16 text-slate-500">
                <p className="text-xs">Nessuna scadenza trovata per il filtro selezionato.</p>
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b" style={{ borderColor: "hsl(240 5% 18% / 0.7)" }}>
                    <th className="pb-3.5 font-bold text-slate-400 uppercase tracking-wider text-[9px]">Data Scadenza</th>
                    <th className="pb-3.5 font-bold text-slate-400 uppercase tracking-wider text-[9px]">Fornitore & Note</th>
                    <th className="pb-3.5 font-bold text-slate-400 uppercase tracking-wider text-[9px]">Categoria</th>
                    <th className="pb-3.5 font-bold text-slate-400 uppercase tracking-wider text-[9px] text-right">Importo</th>
                    <th className="pb-3.5 font-bold text-slate-400 uppercase tracking-wider text-[9px] text-center">Azioni</th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: "hsl(240 5% 18% / 0.3)" }}>
                  {filteredSchedules.map((item) => {
                    const catName = item.expense_categories?.name || item.category;
                    const catColor = item.expense_categories?.color || "slate";
                    const badge = COLOR_MAP[catColor] || COLOR_MAP.slate;

                    return (
                      <tr key={item.id} className="hover:bg-white/2 transition-all duration-150 group">
                        <td className="py-4 text-slate-300 font-semibold whitespace-nowrap">
                          {formatDate(item.due_date)}
                        </td>
                        <td className="py-4 pr-3">
                          <div className="text-white font-bold max-w-[180px] truncate">
                            {item.suppliers?.name || "Nessun Fornitore"}
                          </div>
                          {item.description && (
                            <div className="text-[10px] text-slate-400 mt-0.5 max-w-[180px] truncate font-medium">
                              {item.description}
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
                        <td className={`py-4 text-right font-black text-sm whitespace-nowrap ${item.is_paid ? "text-emerald-400" : "text-amber-400"}`}>
                          {formatCurrency(item.amount)}
                        </td>
                        <td className="py-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {!item.is_paid ? (
                              <button
                                onClick={() => handlePay(item.id)}
                                className="px-2.5 py-1 rounded-lg text-[10px] font-extrabold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 transition-all flex items-center gap-1"
                                title="Segna come Saldata"
                              >
                                <CheckIcon size={12} />
                                <span>Salda</span>
                              </button>
                            ) : (
                              <span className="px-2.5 py-1 rounded-lg text-[10px] font-extrabold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20">
                                Saldata
                              </span>
                            )}
                            <button
                              onClick={() => handleEdit(item)}
                              className="p-1 rounded text-slate-500 hover:text-sky-400 hover:bg-sky-500/10 transition-all opacity-0 group-hover:opacity-100"
                              title="Modifica"
                            >
                              <EditIcon size={12} />
                            </button>
                            <button
                              onClick={() => handleDelete(item.id)}
                              className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-all opacity-0 group-hover:opacity-100"
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

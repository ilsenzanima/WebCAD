"use client";

import { useState, useTransition, useEffect, Fragment } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { type PaymentSchedule, type ExpenseCategory, type Supplier } from "@/lib/types/database";
import { createSchedule, updateSchedule, deleteSchedule, paySchedule, splitScheduleIntoInstallments, rescheduleSchedule } from "@/app/actions/schedules";
import { createBudget } from "@/app/actions/budget";
import { BUDGET_PERIODS } from "@/lib/budgetCalc";
import { createSupplier } from "@/app/actions/suppliers";
import { syncSchedulesToCalendar } from "@/app/actions/google";
import { DEDICATED_CALENDAR_NAME } from "@/lib/gcalendar";
import { formatCurrency, formatDate, toLocalDateStr } from "@/lib/format";
import { getNextDueDate } from "@/lib/recurrence";
import { DeleteIcon, EditIcon, CheckIcon, SchedulesIcon } from "./icons";
import { getCategoryBadgeStyle } from "@/lib/categoryColors";

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

  // Ripianificazione rapida (nuova data) per le scadenze non saldate e gia' scadute
  const [reschedulingId, setReschedulingId] = useState<string | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState("");

  // Divisione in rate: importo per rata calcolato automaticamente ma modificabile a mano
  const [splittingId, setSplittingId] = useState<string | null>(null);
  const [splitCount, setSplitCount] = useState(2);
  const [splitStartDate, setSplitStartDate] = useState("");
  const [splitInstallments, setSplitInstallments] = useState<{ amount: string; due_date: string }[]>([]);

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

  // Crea anche una voce di budget ricorrente collegata, cosi' la scadenza entra nelle stime
  // dei mesi futuri e nella Ripartizione 50/30/20 senza doverla reinserire a mano nel Budget.
  const [addToBudget, setAddToBudget] = useState(false);
  const [budgetType, setBudgetType] = useState<"need" | "want" | "emergency">("need");
  const [budgetPeriodicity, setBudgetPeriodicity] = useState<"weekly" | "monthly" | "bimonthly" | "quarterly" | "semiannual" | "annual">("monthly");
  const [budgetIsEstimated, setBudgetIsEstimated] = useState(false);

  const resetForm = () => {
    setAmount("");
    setCategoryId(categories[0]?.id || "");
    setSupplierId("");
    setDescription("");
    setDueDate(toLocalDateStr());
    setRecurrence("one-time");
    setEditingId(null);
    setAddToBudget(false);
    setBudgetType("need");
    setBudgetPeriodicity("monthly");
    setBudgetIsEstimated(false);
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
        let linkedBudgetId: string | null = null;

        if (!editingId && addToBudget) {
          const budgetRes = await createBudget({
            amount: Number(amount),
            category_id: categoryId,
            supplier_id: supplierId || null,
            type: budgetType,
            label: description.trim() || selectedCat.name,
            periodicity: budgetPeriodicity,
            is_estimated: budgetIsEstimated,
            day_of_month: new Date(`${dueDate}T00:00:00`).getDate(),
          });
          if (!budgetRes.success || !budgetRes.data) {
            alert(budgetRes.error || "Errore durante la creazione della previsione nel Budget");
            return;
          }
          linkedBudgetId = budgetRes.data.id;
        }

        const payload = {
          amount: Number(amount),
          category_id: categoryId,
          supplier_id: supplierId || null,
          category_name: selectedCat.name,
          description,
          due_date: dueDate,
          recurrence,
          ...(linkedBudgetId ? { budget_id: linkedBudgetId } : {}),
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

  const todayStr = toLocalDateStr();
  const isOverdue = (item: ScheduleWithRelations) => !item.is_paid && item.due_date < todayStr;

  const startReschedule = (item: ScheduleWithRelations) => {
    setReschedulingId(item.id);
    setRescheduleDate(todayStr);
  };

  const cancelReschedule = () => {
    setReschedulingId(null);
    setRescheduleDate("");
  };

  const saveReschedule = (item: ScheduleWithRelations) => {
    if (!rescheduleDate) {
      alert("Seleziona una data valida");
      return;
    }
    startTransition(async () => {
      try {
        const res = await rescheduleSchedule(item.id, rescheduleDate);
        if (!res.success || !res.data) {
          alert(res.error || "Errore durante la ripianificazione");
          return;
        }
        setSchedules(prev =>
          prev.map(s => s.id === item.id ? res.data : s)
            .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())
        );
        cancelReschedule();
      } catch (err: any) {
        alert(err.message || "Errore durante la ripianificazione");
      }
    });
  };

  // Divide l'importo totale in `n` rate mensili a partire da `startDateStr`, in parti uguali
  // arrotondate a 2 decimali: l'eventuale resto di arrotondamento va sull'ultima rata cosi'
  // che la somma delle rate torni sempre esatta all'importo originale.
  const buildEvenInstallments = (totalAmount: number, n: number, startDateStr: string) => {
    const start = new Date(`${startDateStr}T00:00:00`);
    const per = Math.floor((totalAmount / n) * 100) / 100;
    const arr: { amount: string; due_date: string }[] = [];
    let runningSum = 0;
    for (let i = 0; i < n; i++) {
      const d = new Date(start);
      d.setMonth(d.getMonth() + i);
      const isLast = i === n - 1;
      const amt = isLast ? Math.round((totalAmount - runningSum) * 100) / 100 : per;
      runningSum += amt;
      arr.push({ amount: amt.toFixed(2), due_date: toLocalDateStr(d) });
    }
    return arr;
  };

  const startSplit = (item: ScheduleWithRelations) => {
    setSplittingId(item.id);
    setSplitCount(2);
    setSplitStartDate(item.due_date);
    setSplitInstallments(buildEvenInstallments(item.amount, 2, item.due_date));
  };

  const cancelSplit = () => {
    setSplittingId(null);
    setSplitInstallments([]);
  };

  const handleSplitCountChange = (item: ScheduleWithRelations, rawCount: number) => {
    const n = Math.max(2, Math.min(36, rawCount || 2));
    setSplitCount(n);
    setSplitInstallments(buildEvenInstallments(item.amount, n, splitStartDate || item.due_date));
  };

  const handleSplitStartDateChange = (item: ScheduleWithRelations, newDate: string) => {
    setSplitStartDate(newDate);
    if (newDate) setSplitInstallments(buildEvenInstallments(item.amount, splitCount, newDate));
  };

  const redistributeSplitEvenly = (item: ScheduleWithRelations) => {
    setSplitInstallments(buildEvenInstallments(item.amount, splitCount, splitStartDate || item.due_date));
  };

  const updateSplitInstallment = (idx: number, field: "amount" | "due_date", value: string) => {
    setSplitInstallments(prev => prev.map((inst, i) => i === idx ? { ...inst, [field]: value } : inst));
  };

  const splitTotal = splitInstallments.reduce((sum, inst) => sum + (Number(inst.amount) || 0), 0);

  const saveSplit = (item: ScheduleWithRelations) => {
    if (splitInstallments.some(inst => !inst.amount || isNaN(Number(inst.amount)) || Number(inst.amount) <= 0 || !inst.due_date)) {
      alert("Inserisci un importo valido e una data per ogni rata");
      return;
    }
    startTransition(async () => {
      try {
        const res = await splitScheduleIntoInstallments(
          item.id,
          splitInstallments.map(inst => ({ amount: Number(inst.amount), due_date: inst.due_date }))
        );
        if (!res.success || !res.data) {
          alert(res.error || "Errore durante la divisione in rate");
          return;
        }
        setSchedules(prev => {
          const withoutOriginal = prev.filter(s => s.id !== item.id);
          return [...withoutOriginal, ...res.data].sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
        });
        cancelSplit();
      } catch (err: any) {
        alert(err.message || "Errore durante la divisione in rate");
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

            {/* Aggiungi anche come previsione ricorrente nel Budget */}
            {!editingId && (
              <div className="space-y-2 p-3 rounded-xl border border-indigo-500/20 bg-indigo-500/[0.03]">
                <label className="flex items-center gap-2 text-[10px] font-bold text-zinc-300 uppercase tracking-wider cursor-pointer">
                  <input
                    type="checkbox"
                    checked={addToBudget}
                    onChange={(e) => {
                      setAddToBudget(e.target.checked);
                      if (e.target.checked) {
                        setBudgetPeriodicity(recurrence === "weekly" ? "weekly" : recurrence === "yearly" ? "annual" : "monthly");
                      }
                    }}
                    className="accent-indigo-500"
                  />
                  📊 Aggiungi anche come previsione nel Budget
                </label>
                {addToBudget && (
                  <div className="space-y-2.5 animate-fade-in pt-1">
                    <p className="text-[9px] text-zinc-500 leading-relaxed">
                      Crea anche una voce ricorrente nella pagina Budget, cosi' questa spesa entra nelle stime dei prossimi mesi e nella Ripartizione 50/30/20.
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="block text-[8px] font-bold text-zinc-500 uppercase tracking-wider">Tipo</label>
                        <select
                          value={budgetType}
                          onChange={(e) => setBudgetType(e.target.value as any)}
                          className="w-full px-2 py-2 rounded-lg text-[10px] text-white bg-zinc-950 border border-zinc-800 focus:outline-none select-custom"
                        >
                          <option value="need" style={{ background: "hsl(240 10% 10%)" }}>Bisogno</option>
                          <option value="want" style={{ background: "hsl(240 10% 10%)" }}>Desiderio</option>
                          <option value="emergency" style={{ background: "hsl(240 10% 10%)" }}>Imprevisto</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="block text-[8px] font-bold text-zinc-500 uppercase tracking-wider">Periodicità Budget</label>
                        <select
                          value={budgetPeriodicity}
                          onChange={(e) => setBudgetPeriodicity(e.target.value as any)}
                          className="w-full px-2 py-2 rounded-lg text-[10px] text-white bg-zinc-950 border border-zinc-800 focus:outline-none select-custom"
                        >
                          {BUDGET_PERIODS.map((p) => (
                            <option key={p.value} value={p.value} style={{ background: "hsl(240 10% 10%)" }}>{p.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <label className="flex items-center gap-2 text-[9px] font-bold text-zinc-500 uppercase tracking-wider cursor-pointer">
                      <input
                        type="checkbox"
                        checked={budgetIsEstimated}
                        onChange={(e) => setBudgetIsEstimated(e.target.checked)}
                        className="accent-amber-500"
                      />
                      Importo stimato (non certo)
                    </label>
                  </div>
                )}
              </div>
            )}

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
                    const badge = getCategoryBadgeStyle(catColor);

                    return (
                      <Fragment key={item.id}>
                      <tr className="hover:bg-white/2 transition-all duration-150 group">
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
                          {reschedulingId === item.id ? (
                            <div className="flex items-center justify-center gap-1 animate-fade-in">
                              <input
                                type="date"
                                autoFocus
                                value={rescheduleDate}
                                onChange={(e) => setRescheduleDate(e.target.value)}
                                onKeyDown={(e) => { if (e.key === "Enter") saveReschedule(item); if (e.key === "Escape") cancelReschedule(); }}
                                className="px-2 py-1 rounded-lg text-[10px] text-white bg-zinc-950 border border-rose-500/50 focus:outline-none"
                              />
                              <button onClick={() => saveReschedule(item)} className="text-emerald-400 hover:text-emerald-300 text-[10px] font-bold px-1" title="Conferma nuova data">✓</button>
                              <button onClick={cancelReschedule} className="text-zinc-500 hover:text-white text-[10px] font-bold px-1" title="Annulla">✕</button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-center gap-1.5 flex-wrap">
                              {isOverdue(item) && (
                                <button
                                  onClick={() => startReschedule(item)}
                                  className="px-2 py-1 rounded-lg text-[10px] font-extrabold text-rose-300 bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 transition-all"
                                  title="Sposta questa scadenza a una nuova data"
                                >
                                  🗓 Ripianifica
                                </button>
                              )}
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
                              {!item.is_paid && (
                                <button
                                  onClick={() => splittingId === item.id ? cancelSplit() : startSplit(item)}
                                  className={`p-1 rounded transition-all text-[10px] ${
                                    splittingId === item.id
                                      ? "text-amber-400 bg-amber-500/10"
                                      : "text-slate-500 hover:text-amber-400 hover:bg-amber-500/10 opacity-0 group-hover:opacity-100"
                                  }`}
                                  title="Dividi in rate"
                                >
                                  ✂
                                </button>
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
                          )}
                        </td>
                      </tr>
                      {splittingId === item.id && (
                        <tr className="bg-white/[0.02]">
                          <td colSpan={5} className="py-4 px-1">
                            <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.03] p-4 space-y-3 animate-fade-in">
                              <div className="flex items-center justify-between">
                                <h4 className="text-[11px] font-extrabold text-amber-300">
                                  ✂ Dividi "{item.description || item.category}" in rate
                                </h4>
                                <button onClick={cancelSplit} className="text-[9px] font-bold text-zinc-500 hover:text-white">Chiudi</button>
                              </div>

                              <div className="flex flex-wrap gap-3 items-end">
                                <div className="space-y-1">
                                  <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-wider">Numero di rate</label>
                                  <input
                                    type="number"
                                    min={2}
                                    max={36}
                                    value={splitCount}
                                    onChange={(e) => handleSplitCountChange(item, Number(e.target.value))}
                                    className="w-20 px-2 py-1.5 rounded-lg text-xs text-white bg-zinc-950 border border-zinc-800 focus:outline-none"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-wider">Prima rata il</label>
                                  <input
                                    type="date"
                                    value={splitStartDate}
                                    onChange={(e) => handleSplitStartDateChange(item, e.target.value)}
                                    className="px-2 py-1.5 rounded-lg text-xs text-white bg-zinc-950 border border-zinc-800 focus:outline-none"
                                  />
                                </div>
                                <button
                                  type="button"
                                  onClick={() => redistributeSplitEvenly(item)}
                                  className="px-3 py-1.5 rounded-lg text-[10px] font-bold text-amber-300 bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20 transition-all"
                                  title="Ricalcola le rate in parti uguali, sovrascrivendo le modifiche manuali"
                                >
                                  ↺ Distribuisci equamente
                                </button>
                              </div>

                              <p className="text-[9px] text-zinc-500">
                                Le rate sono divise in automatico in parti uguali: modifica ogni importo per riflettere l'esatta rateizzazione comunicata dal fornitore (es. con interessi inclusi).
                              </p>

                              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                                {splitInstallments.map((inst, idx) => (
                                  <div key={idx} className="flex items-center gap-2 text-[10px]">
                                    <span className="w-14 flex-shrink-0 text-zinc-500 font-bold">Rata {idx + 1}</span>
                                    <input
                                      type="number"
                                      step="0.01"
                                      min="0.01"
                                      value={inst.amount}
                                      onChange={(e) => updateSplitInstallment(idx, "amount", e.target.value)}
                                      className="w-24 px-2 py-1 rounded-lg text-right text-white bg-zinc-950 border border-zinc-800 focus:outline-none"
                                    />
                                    <input
                                      type="date"
                                      value={inst.due_date}
                                      onChange={(e) => updateSplitInstallment(idx, "due_date", e.target.value)}
                                      className="px-2 py-1 rounded-lg text-white bg-zinc-950 border border-zinc-800 focus:outline-none"
                                    />
                                  </div>
                                ))}
                              </div>

                              <div className="flex items-center justify-between flex-wrap gap-2 text-[10px] font-bold pt-2 border-t border-white/5">
                                <span className="text-zinc-400">
                                  Totale rate: <span className="text-white">{formatCurrency(splitTotal)}</span>
                                  <span className="text-zinc-600"> / Originale: {formatCurrency(item.amount)}</span>
                                </span>
                                {Math.abs(splitTotal - item.amount) > 0.005 && (
                                  <span className={splitTotal > item.amount ? "text-amber-400" : "text-sky-400"}>
                                    {splitTotal > item.amount ? "+" : ""}{formatCurrency(splitTotal - item.amount)} {splitTotal > item.amount ? "in più" : "in meno"} rispetto all'originale
                                  </span>
                                )}
                              </div>

                              <button
                                type="button"
                                onClick={() => saveSplit(item)}
                                disabled={isPending}
                                className="w-full py-2 rounded-lg text-[10px] font-extrabold text-white transition-all disabled:opacity-50"
                                style={{
                                  background: "linear-gradient(135deg, hsl(38 90% 50%), hsl(30 80% 45%))",
                                  cursor: isPending ? "not-allowed" : "pointer",
                                }}
                              >
                                {isPending ? "Salvataggio..." : `Conferma divisione in ${splitCount} rate`}
                              </button>
                            </div>
                          </td>
                        </tr>
                      )}
                      </Fragment>
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

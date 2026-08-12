"use client";

import { useState, useTransition, useEffect, Fragment } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { type PaymentSchedule, type ExpenseCategory, type Supplier } from "@/lib/types/database";
import { createSchedule, updateSchedule, deleteSchedule, paySchedule, unpaySchedule, splitScheduleIntoInstallments, rescheduleSchedule } from "@/app/actions/schedules";
import { createSupplier } from "@/app/actions/suppliers";
import { syncSchedulesToCalendar } from "@/app/actions/google";
import { DEDICATED_CALENDAR_NAME } from "@/lib/gcalendar";
import { uploadAndLinkDocument } from "@/lib/uploadDocument";
import { monthInputToDate, syncPeriodEnd } from "@/lib/period";
import { formatCurrency, formatDate, toLocalDateStr } from "@/lib/format";
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
  onExpenseDeleted?: (expenseIds: string[]) => void;
  onSupplierCreated?: (supplier: Supplier) => void;
}

const RECURRENCES = [
  { value: "one-time", label: "Una Tantum" },
  { value: "weekly", label: "Settimanale" },
  { value: "monthly", label: "Mensile" },
  { value: "bimonthly", label: "Bimestrale" },
  { value: "quarterly", label: "Trimestrale" },
  { value: "semiannual", label: "Semestrale" },
  { value: "yearly", label: "Annuale" },
];

const MONTH_LABELS = [
  "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
  "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre",
];

export default function SchedulesClient({ initialSchedules, categories, suppliers, googleConnected, onExpenseCreated, onExpenseDeleted, onSupplierCreated }: SchedulesClientProps) {
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
  const [recurrence, setRecurrence] = useState<"one-time" | "weekly" | "monthly" | "bimonthly" | "quarterly" | "semiannual" | "yearly">("one-time");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  const [filterPaid, setFilterPaid] = useState<"all" | "pending" | "paid" | "reschedule">("pending");
  const [isSyncingCalendar, setIsSyncingCalendar] = useState(false);

  // Ripianificazione rapida (nuova data) per le scadenze non saldate e gia' scadute
  const [reschedulingId, setReschedulingId] = useState<string | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState("");

  // Divisione in rate: importo per rata calcolato automaticamente ma modificabile a mano
  const [splittingId, setSplittingId] = useState<string | null>(null);
  const [splitCount, setSplitCount] = useState(2);
  const [splitStartDate, setSplitStartDate] = useState("");
  const [splitInstallments, setSplitInstallments] = useState<{ amount: string; due_date: string }[]>([]);

  // Conferma di saldo: prima di registrare la spesa chiede sempre l'importo reale (puo'
  // differire dalla stima), e per i fornitori-utenza anche il consumo del periodo e,
  // facoltativamente, il documento (bolletta) da allegare, cosi' restano tracciati sulla spesa
  // generata.
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

  // La scadenza stessa e' la previsione (finche' non viene saldata): questi campi coprono i
  // casi che prima vivevano solo nelle "voci di budget" (mutui/finanziamenti con una data di
  // fine nota, importo certo o stimato), cosi' non serve piu' un doppio inserimento.
  const [isEstimated, setIsEstimated] = useState(false);
  const [hasDuration, setHasDuration] = useState(false);
  // Entrata ricorrente (es. stipendio) invece di un'uscita: categoria e fornitore non sono
  // obbligatori in questo caso, dato che servono solo a classificare le spese.
  const [isIncome, setIsIncome] = useState(false);
  const now = new Date();
  const [endMonthInput, setEndMonthInput] = useState(now.getMonth() + 1);
  const [endYearInput, setEndYearInput] = useState(now.getFullYear());

  const resetForm = () => {
    setAmount("");
    setCategoryId(categories[0]?.id || "");
    setSupplierId("");
    setDescription("");
    setDueDate(toLocalDateStr());
    setRecurrence("one-time");
    setEditingId(null);
    setIsEstimated(false);
    setHasDuration(false);
    setEndMonthInput(now.getMonth() + 1);
    setEndYearInput(now.getFullYear());
    setIsIncome(false);
    setIsFormOpen(false);
  };

  const openNewForm = () => {
    resetForm();
    setIsFormOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      alert("Inserisci un importo valido");
      return;
    }

    const selectedCat = categories.find(c => c.id === categoryId);
    if (!isIncome && !selectedCat) {
      alert("Seleziona una categoria valida");
      return;
    }

    let endMonth: number | null = null;
    let endYear: number | null = null;
    if (hasDuration) {
      if (endYearInput < now.getFullYear() || (endYearInput === now.getFullYear() && endMonthInput < now.getMonth() + 1)) {
        alert("La data di fine non può essere nel passato");
        return;
      }
      endMonth = endMonthInput;
      endYear = endYearInput;
    }

    startTransition(async () => {
      try {
        const payload = {
          amount: Number(amount),
          category_id: isIncome ? (categoryId || null) : categoryId,
          supplier_id: isIncome ? null : (supplierId || null),
          category_name: selectedCat ? selectedCat.name : (description.trim() || "Entrata"),
          description,
          due_date: dueDate,
          recurrence,
          is_estimated: isEstimated,
          end_month: endMonth,
          end_year: endYear,
          is_income: isIncome,
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
    setIsFormOpen(true);
    setEditingId(item.id);
    setAmount(String(item.amount));
    setCategoryId(item.category_id || categories[0]?.id || "");
    setSupplierId(item.supplier_id || "");
    setDescription(item.description || "");
    setDueDate(item.due_date);
    setRecurrence(item.recurrence);
    setIsEstimated(item.is_estimated || false);
    setIsIncome(item.is_income || false);
    if (item.end_year && item.end_month) {
      setHasDuration(true);
      setEndMonthInput(item.end_month);
      setEndYearInput(item.end_year);
    } else {
      setHasDuration(false);
      setEndMonthInput(now.getMonth() + 1);
      setEndYearInput(now.getFullYear());
    }
  };

  const handlePay = (
    scheduleId: string,
    amount: number,
    consumptionValue: number | null = null,
    docFile: File | null = null,
    docType: "contratto" | "bolletta" | "altro" = "bolletta",
    periodStart: string | null = null,
    periodEnd: string | null = null
  ) => {
    startTransition(async () => {
      try {
        const res = await paySchedule(scheduleId, amount, consumptionValue, periodStart, periodEnd);
        if (!res.success || !res.data) {
          alert(res.error || "Errore nel contrassegnare come pagato");
          return;
        }
        const newExpense = res.data;

        const target = schedules.find(s => s.id === scheduleId);

        setSchedules(prev => {
          const updated = prev.map(s => s.id === scheduleId ? { ...s, is_paid: true } : s);
          if (res.nextSchedule) {
            return [...updated, res.nextSchedule as ScheduleWithRelations].sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
          }
          return updated;
        });

        if (target && onExpenseCreated) {
          onExpenseCreated({
            ...newExpense,
            expense_categories: target.expense_categories,
            suppliers: target.suppliers,
          });
        }

        if (docFile) {
          await uploadAndLinkDocument({
            file: docFile,
            expenseId: newExpense.id,
            supplierId: target?.supplier_id ?? null,
            suppliersList,
            title: target?.description || target?.category || "Bolletta",
            docType,
            googleConnected,
          });
        }

        if (payingId === scheduleId) cancelPay();
      } catch (err: any) {
        alert(err.message || "Errore durante il salvataggio");
      }
    });
  };

  const supplierOf = (item: ScheduleWithRelations) => suppliersList.find(s => s.id === item.supplier_id) || null;

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

  // Il saldo chiede sempre conferma dell'importo reale (puo' differire dalla stima), cosi' un
  // clic su "Salda" non registra piu' automaticamente l'importo pianificato senza controllo.
  const handlePayClick = (item: ScheduleWithRelations) => {
    if (payingId === item.id) {
      cancelPay();
    } else {
      startPay(item);
    }
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
    handlePay(
      item.id,
      amount,
      value,
      payDocFile,
      payDocType,
      monthInputToDate(payPeriodStart),
      monthInputToDate(payPeriodEnd || payPeriodStart)
    );
  };

  // Annulla il saldo di una scadenza cliccata "Salda" per errore: elimina la spesa generata e,
  // se non ancora saldata, la prossima occorrenza che il saldo aveva creato automaticamente.
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
        if (onExpenseDeleted && res.deletedExpenseIds?.length) {
          onExpenseDeleted(res.deletedExpenseIds);
        }
      } catch (err: any) {
        alert(err.message || "Errore durante l'annullamento del saldo");
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
    if (filterPaid === "reschedule") return isOverdue(s);
    return true;
  });

  const rescheduleCount = schedules.filter(isOverdue).length;

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

      {isFormOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4 animate-fade-in overflow-y-auto"
          onClick={resetForm}
        >
        <div
          className="relative w-full max-w-lg my-8 rounded-2xl p-6 border shadow-2xl backdrop-blur-xl animate-fade-in max-h-[90vh] overflow-y-auto"
          style={{
            background: "linear-gradient(135deg, hsla(38, 60%, 15%, 0.08), hsla(240, 10%, 10%, 0.97))",
            borderColor: "hsla(38, 60%, 50%, 0.15)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="absolute top-[-30%] right-[-20%] w-40 h-40 rounded-full bg-amber-500/5 blur-[50px] pointer-events-none" />

          <button
            type="button"
            onClick={resetForm}
            className="absolute top-4 right-4 text-zinc-400 hover:text-white text-lg leading-none z-20"
            aria-label="Chiudi"
          >
            ✕
          </button>

          <h2 className="text-base font-extrabold bg-gradient-to-r from-white to-zinc-300 bg-clip-text text-transparent mb-5 tracking-tight flex items-center gap-2">
            <span className="text-amber-400"><SchedulesIcon size={16} /></span>
            {editingId ? "Modifica Scadenza" : "Programma Scadenza"}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4 relative z-10">
            {/* Tipo: Uscita o Entrata ricorrente (es. stipendio) */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Tipo</label>
              <div className="flex gap-2 p-1 bg-zinc-950/60 border border-white/5 rounded-xl text-[10px] font-bold">
                <button
                  type="button"
                  onClick={() => setIsIncome(false)}
                  className="flex-1 py-2 rounded-lg transition-all"
                  style={{
                    background: !isIncome ? "hsl(240 10% 15%)" : "transparent",
                    color: !isIncome ? "white" : "hsl(240 5% 55%)",
                  }}
                >
                  📅 Uscita
                </button>
                <button
                  type="button"
                  onClick={() => setIsIncome(true)}
                  className="flex-1 py-2 rounded-lg transition-all"
                  style={{
                    background: isIncome ? "hsla(150, 80%, 45%, 0.12)" : "transparent",
                    color: isIncome ? "hsl(150 80% 55%)" : "hsl(240 5% 55%)",
                  }}
                >
                  💰 Entrata
                </button>
              </div>
            </div>

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

            {/* Categoria (facoltativa per un'entrata: serve solo a classificare le uscite) */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Categoria</label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                required={!isIncome}
                className="w-full px-4 py-3 rounded-xl text-xs text-white focus:outline-none border select-custom transition-all"
                style={{
                  background: "hsl(240 10% 4% / 0.8)",
                  borderColor: "hsl(240 5% 18%)",
                }}
              >
                {isIncome && (
                  <option value="" style={{ background: "hsl(240 10% 10%)" }}>Nessuna</option>
                )}
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id} style={{ background: "hsl(240 10% 10%)" }}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Fornitore (non si applica a un'entrata) */}
            {!isIncome && (
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
            )}

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

            {/* Stima Importo (Certezza) */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Stima Importo</label>
              <div className="flex gap-2 p-1 bg-zinc-950/60 border border-white/5 rounded-xl text-[10px] font-bold">
                <button
                  type="button"
                  onClick={() => setIsEstimated(false)}
                  className="flex-1 py-2 rounded-lg transition-all"
                  style={{
                    background: !isEstimated ? "hsl(240 10% 15%)" : "transparent",
                    color: !isEstimated ? "white" : "hsl(240 5% 55%)",
                  }}
                >
                  Importo Certo
                </button>
                <button
                  type="button"
                  onClick={() => setIsEstimated(true)}
                  className="flex-1 py-2 rounded-lg transition-all"
                  style={{
                    background: isEstimated ? "hsla(38, 90%, 50%, 0.12)" : "transparent",
                    color: isEstimated ? "hsl(38 90% 60%)" : "hsl(240 5% 55%)",
                  }}
                >
                  Importo Stimato
                </button>
              </div>
            </div>

            {/* Durata Limitata (es. mutuo o finanziamento gia' in corso, con l'ultima rata nota) */}
            {recurrence !== "one-time" && (
              <div className="space-y-1.5 animate-fade-in">
                <label className="flex items-center gap-2 text-[10px] font-bold text-zinc-400 uppercase tracking-wider cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hasDuration}
                    onChange={(e) => setHasDuration(e.target.checked)}
                    className="accent-amber-500"
                  />
                  Ha una scadenza (mutuo, finanziamento...)
                </label>
                {hasDuration && (
                  <div className="animate-fade-in space-y-1.5">
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        value={endMonthInput}
                        onChange={(e) => setEndMonthInput(Number(e.target.value))}
                        className="w-full px-3 py-3 rounded-xl text-xs text-white focus:outline-none border select-custom transition-all"
                        style={{ background: "hsl(240 10% 4% / 0.8)", borderColor: "hsl(240 5% 18%)" }}
                      >
                        {MONTH_LABELS.map((m, i) => (
                          <option key={m} value={i + 1} style={{ background: "hsl(240 10% 10%)" }}>{m}</option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min={now.getFullYear()}
                        step="1"
                        value={endYearInput}
                        onChange={(e) => setEndYearInput(Number(e.target.value))}
                        placeholder="Anno"
                        className="w-full px-4 py-3 rounded-xl text-xs text-white focus:outline-none border transition-all duration-200"
                        style={{ background: "hsl(240 10% 4% / 0.8)", borderColor: "hsl(240 5% 18%)" }}
                      />
                    </div>
                    <p className="text-[9px] text-zinc-500 mt-1">
                      Indica il mese/anno dell'ultima rata: dopo quella data, saldando questa scadenza non ne verra' generata una successiva.
                    </p>
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
        </div>
      )}

      {/* Registro Tabellare Scadenze (larghezza piena) */}
      <div
        className="rounded-2xl p-6 border flex flex-col space-y-5 shadow-2xl relative overflow-hidden group backdrop-blur-xl animate-fade-in"
        style={{
          background: "linear-gradient(135deg, hsla(240, 10%, 12%, 0.5), hsla(240, 10%, 10%, 0.8))",
          borderColor: "hsla(240, 5%, 18%, 0.7)",
        }}
      >
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 relative z-10">
          <h3 className="text-sm font-extrabold text-white tracking-wide">
            📋 Registro Scadenze & Pagamenti
          </h3>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
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
                onClick={() => setFilterPaid("reschedule")}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 ${
                  filterPaid === "reschedule" ? "bg-rose-500/20 text-rose-300 border border-rose-500/30" : "text-zinc-500"
                }`}
              >
                Da Ripianificare
                {rescheduleCount > 0 && (
                  <span className="inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full text-[9px] bg-rose-500/30 text-rose-200">
                    {rescheduleCount}
                  </span>
                )}
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

            <button
              type="button"
              onClick={openNewForm}
              className="px-4 py-2.5 rounded-xl text-xs font-extrabold text-white transition-all shadow-lg active:scale-98 flex items-center justify-center gap-2"
              style={{
                background: "linear-gradient(135deg, hsl(38 90% 50%), hsl(30 80% 45%))",
              }}
            >
              <span>＋</span> Nuova Scadenza
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
                  {filteredSchedules.map((item, index) => {
                    const catName = item.expense_categories?.name || item.category;
                    const catColor = item.expense_categories?.color || "slate";
                    const badge = getCategoryBadgeStyle(catColor);
                    const isMonthBoundary = index > 0 && item.due_date?.slice(0, 7) !== filteredSchedules[index - 1].due_date?.slice(0, 7);

                    return (
                      <Fragment key={item.id}>
                      <tr
                        className="hover:bg-white/2 transition-all duration-150 group"
                        style={isMonthBoundary ? { borderTopWidth: "2px", borderTopColor: "hsl(38 90% 50% / 0.5)" } : undefined}
                      >
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
                          <div className="flex flex-wrap gap-1 mt-1">
                            {item.is_income && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[7px] font-bold border bg-emerald-500/10 text-emerald-300 border-emerald-500/20">
                                💰 Entrata
                              </span>
                            )}
                            {item.recurrence !== "one-time" && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[7px] font-bold border bg-zinc-800/50 text-zinc-400 border-zinc-700">
                                🔁 {RECURRENCES.find(r => r.value === item.recurrence)?.label}
                              </span>
                            )}
                            {item.is_estimated && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[7px] font-bold border bg-amber-500/10 text-amber-300 border-amber-500/20">
                                Stimato
                              </span>
                            )}
                            {item.end_year && item.end_month && (
                              <span
                                className="inline-flex items-center px-1.5 py-0.5 rounded text-[7px] font-bold border bg-indigo-500/10 text-indigo-300 border-indigo-500/20"
                                title="Ultimo mese in cui questa scadenza si ripete"
                              >
                                🏁 fino a {MONTH_LABELS[item.end_month - 1].slice(0, 3)} {item.end_year}
                              </span>
                            )}
                          </div>
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
                        <td className={`py-4 text-right font-black text-sm whitespace-nowrap ${item.is_income ? "text-emerald-400" : item.is_paid ? "text-emerald-400" : "text-amber-400"}`}>
                          {item.is_income ? "+" : ""}{formatCurrency(item.amount)}
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
                                  onClick={() => handlePayClick(item)}
                                  className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold border transition-all flex items-center gap-1 ${
                                    payingId === item.id
                                      ? "text-emerald-300 bg-emerald-500/20 border-emerald-500/40"
                                      : "text-emerald-400 bg-emerald-500/10 border-emerald-500/20 hover:bg-emerald-500/20"
                                  }`}
                                  title="Segna come Saldata"
                                >
                                  <CheckIcon size={12} />
                                  <span>Salda</span>
                                </button>
                              ) : (
                                <span className="inline-flex items-center gap-1">
                                  <span className="px-2.5 py-1 rounded-lg text-[10px] font-extrabold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20">
                                    Saldata
                                  </span>
                                  <button
                                    onClick={() => handleUnpay(item)}
                                    className="p-1 rounded text-slate-500 hover:text-amber-400 hover:bg-amber-500/10 transition-all text-[10px] opacity-0 group-hover:opacity-100"
                                    title="Annulla il saldo (es. cliccato per errore): elimina la spesa registrata"
                                  >
                                    ↺
                                  </button>
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
                      {payingId === item.id && (
                        <tr className="bg-white/[0.02]">
                          <td colSpan={5} className="py-4 px-1">
                            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.03] p-4 space-y-3 animate-fade-in">
                              <div className="flex items-center justify-between">
                                <h4 className="text-[11px] font-extrabold text-emerald-300">
                                  ✓ Salda "{item.description || item.category}"{item.suppliers?.name ? ` — ${item.suppliers.name}` : ""}
                                </h4>
                                <button onClick={cancelPay} className="text-[9px] font-bold text-zinc-500 hover:text-white">Chiudi</button>
                              </div>

                              <div className="flex flex-wrap gap-3 items-end">
                                <div className="space-y-1">
                                  <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-wider">Importo reale (€)</label>
                                  <input
                                    type="number"
                                    step="0.01"
                                    min="0.01"
                                    autoFocus
                                    value={payAmount}
                                    onChange={(e) => setPayAmount(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === "Enter") confirmPay(item); if (e.key === "Escape") cancelPay(); }}
                                    className="w-32 px-3 py-2 rounded-lg text-xs text-white bg-zinc-950 border border-emerald-500/50 focus:outline-none"
                                  />
                                  {Number(payAmount) !== item.amount && payAmount.trim() && !isNaN(Number(payAmount)) && (
                                    <p className="text-[8px] text-amber-400 font-semibold">Diverso dal previsto ({formatCurrency(item.amount)})</p>
                                  )}
                                </div>
                                {supplierOf(item)?.is_utility && (
                                <div className="space-y-1">
                                  <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-wider">
                                    Consumo del periodo ({supplierOf(item)?.consumption_unit || "unità"})
                                  </label>
                                  <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={payConsumptionValue}
                                    onChange={(e) => setPayConsumptionValue(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === "Enter") confirmPay(item); if (e.key === "Escape") cancelPay(); }}
                                    placeholder={`es. 320 ${supplierOf(item)?.consumption_unit || ""}`}
                                    className="w-40 px-3 py-2 rounded-lg text-xs text-white bg-zinc-950 border border-zinc-800 focus:outline-none"
                                  />
                                </div>
                                )}
                                {supplierOf(item)?.is_utility && (
                                <div className="space-y-1">
                                  <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-wider">Periodo di copertura</label>
                                  <div className="flex items-center gap-1.5">
                                    <input
                                      type="month"
                                      value={payPeriodStart}
                                      onChange={(e) => handlePayPeriodStartChange(e.target.value)}
                                      className="w-32 px-2 py-2 rounded-lg text-xs text-white bg-zinc-950 border border-zinc-800 focus:outline-none"
                                    />
                                    <span className="text-[9px] text-zinc-500">al</span>
                                    <input
                                      type="month"
                                      value={payPeriodEnd}
                                      min={payPeriodStart || undefined}
                                      disabled={!payPeriodStart}
                                      onChange={(e) => setPayPeriodEnd(e.target.value)}
                                      className="w-32 px-2 py-2 rounded-lg text-xs text-white bg-zinc-950 border border-zinc-800 focus:outline-none disabled:opacity-40"
                                    />
                                  </div>
                                </div>
                                )}
                                {supplierOf(item)?.is_utility && (
                                <div className="space-y-1">
                                  <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-wider">Allega documento (facoltativo)</label>
                                  {googleConnected ? (
                                    <input
                                      type="file"
                                      accept="application/pdf,image/*"
                                      onChange={handlePayDocFileChange}
                                      className="text-[10px] text-slate-300 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-[9px] file:font-bold file:bg-sky-500/20 file:text-sky-300 hover:file:bg-sky-500/30 cursor-pointer"
                                    />
                                  ) : (
                                    <a
                                      href="/dashboard/schedules"
                                      onClick={(e) => { e.preventDefault(); window.location.href = "/api/google/connect?next=/dashboard/schedules"; }}
                                      className="inline-block px-2.5 py-1.5 rounded-lg text-[9px] font-extrabold text-amber-300 bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20"
                                    >
                                      🔗 Collega Google Drive per allegare
                                    </a>
                                  )}
                                </div>
                                )}
                                {payDocFile && (
                                  <div className="space-y-1">
                                    <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-wider">Tipo documento</label>
                                    <select
                                      value={payDocType}
                                      onChange={(e) => setPayDocType(e.target.value as any)}
                                      className="px-2 py-2 rounded-lg text-[10px] text-white bg-zinc-950 border border-zinc-800 focus:outline-none"
                                    >
                                      <option value="bolletta">📄 Bolletta</option>
                                      <option value="contratto">📑 Contratto</option>
                                      <option value="altro">📎 Altro</option>
                                    </select>
                                  </div>
                                )}
                                <button
                                  onClick={() => confirmPay(item)}
                                  disabled={isPending}
                                  className="px-3 py-2 rounded-lg text-[10px] font-extrabold text-white bg-emerald-600 hover:bg-emerald-500 transition-all disabled:opacity-50"
                                >
                                  Conferma pagamento
                                </button>
                                <button
                                  onClick={cancelPay}
                                  className="px-3 py-2 rounded-lg text-[10px] font-extrabold text-zinc-400 bg-zinc-900 border border-zinc-800 hover:text-white transition-all"
                                >
                                  Annulla
                                </button>
                              </div>
                              <p className="text-[9px] text-zinc-500">Puoi lasciare consumo e documento vuoti e saldare comunque: verranno segnalati come mancanti nell'elenco spese.</p>
                            </div>
                          </td>
                        </tr>
                      )}
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
  );
}

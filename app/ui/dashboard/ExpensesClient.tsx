"use client";

import { useState, useTransition, useMemo, useEffect, Fragment } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { type Expense, type ExpenseCategory, type Supplier, type SupplierDocument, type Account } from "@/lib/types/database";
import { createExpense, updateExpense, deleteExpense } from "@/app/actions/expenses";
import { createSupplierDocument, deleteSupplierDocument } from "@/app/actions/documents";
import { createSupplier } from "@/app/actions/suppliers";
import { uploadSupplierDocumentToDrive } from "@/app/actions/google";
import { formatCurrency, formatFileSize, formatDate, toLocalDateStr } from "@/lib/format";
import SchedulesClient from "./SchedulesClient";
import { EditIcon, DeleteIcon, ExpensesIcon } from "./icons";
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

interface ExpensesClientProps {
  initialExpenses: any[];
  categories: ExpenseCategory[];
  suppliers: Supplier[];
  initialSchedules: any[];
  initialDocuments: SupplierDocument[];
  initialAccounts: Account[];
  googleConnected: boolean;
}

type MainTab = "uscite" | "entrate" | "scadenze";

export default function ExpensesClient({
  initialExpenses,
  categories,
  suppliers,
  initialSchedules,
  initialDocuments,
  initialAccounts,
  googleConnected,
}: ExpensesClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [expenses, setExpenses] = useState<ExpenseWithRelations[]>(initialExpenses);
  const [documents, setDocuments] = useState<SupplierDocument[]>(initialDocuments);
  const [suppliersList, setSuppliersList] = useState<Supplier[]>(suppliers);
  const [isPending, startTransition] = useTransition();

  // Tab principale: "uscite" | "entrate" | "scadenze"
  const tabParam = searchParams.get("tab");
  const [mainTab, setMainTabState] = useState<MainTab>(
    tabParam === "scadenze" || tabParam === "entrate" ? tabParam : "uscite"
  );

  useEffect(() => {
    const t = searchParams.get("tab");
    if (t === "scadenze" || t === "entrate" || t === "uscite") setMainTabState(t);
  }, [searchParams]);

  const setMainTab = (t: MainTab) => {
    setMainTabState(t);
    router.replace(`/dashboard/expenses?tab=${t}`);
  };

  const isIncomeMode = mainTab === "entrate";

  // Form states
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState(categories[0]?.id || "");
  const [supplierId, setSupplierId] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(toLocalDateStr());
  const [consumptionValue, setConsumptionValue] = useState("");
  const [accountId, setAccountId] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);

  // Documento allegato al momento della registrazione (spesa/entrata)
  const [newDocFile, setNewDocFile] = useState<File | null>(null);
  const [newDocType, setNewDocType] = useState<"contratto" | "bolletta" | "altro">("bolletta");

  // Aggiunta rapida di un nuovo fornitore dal form
  const [isAddingSupplier, setIsAddingSupplier] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState("");
  const [newSupplierIsUtility, setNewSupplierIsUtility] = useState(false);
  const [newSupplierUnit, setNewSupplierUnit] = useState("kWh");
  const [isCreatingSupplier, setIsCreatingSupplier] = useState(false);

  const selectedSupplier = suppliersList.find(s => s.id === supplierId) || null;

  // Filtri ricerca
  const [filterCategoryId, setFilterCategoryId] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Allegati: pannello espanso per una singola registrazione alla volta
  const [expandedExpenseId, setExpandedExpenseId] = useState<string | null>(null);
  const [attachTitle, setAttachTitle] = useState("");
  const [attachFile, setAttachFile] = useState<File | null>(null);
  const [attachDocType, setAttachDocType] = useState<"contratto" | "bolletta" | "altro">("bolletta");
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);

  const docsByExpense = useMemo(() => {
    const map: Record<string, SupplierDocument[]> = {};
    documents.forEach((d) => {
      if (!d.expense_id) return;
      (map[d.expense_id] ||= []).push(d);
    });
    return map;
  }, [documents]);

  const resetForm = () => {
    setAmount("");
    setCategoryId(categories[0]?.id || "");
    setSupplierId("");
    setDescription("");
    setDate(toLocalDateStr());
    setConsumptionValue("");
    setAccountId("");
    setEditingId(null);
    setNewDocFile(null);
    setNewDocType("bolletta");
    setIsAddingSupplier(false);
    setNewSupplierName("");
    setNewSupplierIsUtility(false);
    setNewSupplierUnit("kWh");
  };

  // Carica su Google Drive e collega il documento a una spesa/entrata (ed eventualmente al fornitore)
  const uploadAndLinkDocument = async (
    file: File,
    expenseId: string,
    supplierIdForDoc: string | null,
    title: string,
    docType: "contratto" | "bolletta" | "altro" = "bolletta"
  ) => {
    if (!googleConnected) {
      alert("Spesa salvata, ma per allegare documenti devi prima collegare il tuo account Google Drive.");
      return;
    }
    try {
      const uploadFormData = new FormData();
      uploadFormData.append("file", file);
      uploadFormData.append("fileName", `${title}_${file.name}`);

      const driveRes = await uploadSupplierDocumentToDrive(uploadFormData);
      if (!driveRes.success || !driveRes.data) {
        alert(driveRes.error || "La registrazione è stata salvata ma il caricamento dell'allegato su Google Drive è fallito.");
        return;
      }

      const fileUrl = driveRes.data.webViewLink || driveRes.data.webContentLink || `https://drive.google.com/file/d/${driveRes.data.id}/view`;

      const res = await createSupplierDocument({
        expense_id: expenseId,
        supplier_id: supplierIdForDoc,
        title,
        file_url: fileUrl,
        provider: "gdrive",
        file_size: file.size,
        doc_type: docType,
      });

      if (!res.success || !res.data) {
        alert(res.error || "La registrazione è stata salvata ma il salvataggio dell'allegato è fallito.");
        return;
      }

      setDocuments(prev => [res.data, ...prev]);
    } catch (err: any) {
      alert(err.message || "Errore durante il caricamento dell'allegato");
    }
  };

  const handleNewDocFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      alert("Il file supera la dimensione massima consigliata di 10MB");
      return;
    }
    setNewDocFile(file);
  };

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      alert("Inserisci un importo valido");
      return;
    }

    const selectedCat = categories.find(c => c.id === categoryId);
    if (!isIncomeMode && !selectedCat) {
      alert("Seleziona una categoria valida");
      return;
    }

    startTransition(async () => {
      try {
        const payload = {
          amount: Number(amount),
          category_id: isIncomeMode ? null : categoryId,
          supplier_id: isIncomeMode ? null : (supplierId || null),
          category_name: isIncomeMode ? "Entrata" : (selectedCat?.name || "Generica"),
          description,
          date,
          is_income: isIncomeMode,
          consumption_value: (!isIncomeMode && selectedSupplier?.is_utility && consumptionValue)
            ? Number(consumptionValue)
            : null,
          account_id: accountId || null,
        };

        let targetExpenseId: string | null = null;

        if (editingId) {
          const res = await updateExpense(editingId, payload);
          if (!res.success) {
            alert(res.error || "Errore durante la modifica");
            return;
          }
          targetExpenseId = editingId;
          setExpenses(prev =>
            prev.map(item => {
              if (item.id !== editingId) return item;
              const matchingSupplier = suppliersList.find(s => s.id === supplierId);
              return {
                ...item,
                ...payload,
                expense_categories: isIncomeMode ? null : (selectedCat ? { name: selectedCat.name, color: selectedCat.color } : null),
                suppliers: isIncomeMode ? null : (matchingSupplier ? { name: matchingSupplier.name } : null)
              };
            })
          );
        } else {
          const res = await createExpense(payload);
          if (!res.success || !res.data) {
            alert(res.error || "Errore durante il salvataggio");
            return;
          }
          targetExpenseId = res.data.id;
          setExpenses(prev => [res.data, ...prev]);
        }

        if (newDocFile && targetExpenseId) {
          const title = description.trim() || (isIncomeMode ? "Entrata" : "Spesa");
          await uploadAndLinkDocument(newDocFile, targetExpenseId, payload.supplier_id, title, newDocType);
        }

        resetForm();
      } catch (err: any) {
        alert(err.message || "Si è verificato un errore");
      }
    });
  };

  const handleEdit = (exp: ExpenseWithRelations) => {
    setMainTab(exp.is_income ? "entrate" : "uscite");
    setEditingId(exp.id);
    setAmount(exp.amount.toString());
    setCategoryId(exp.category_id || categories[0]?.id || "");
    setSupplierId(exp.supplier_id || "");
    setDescription(exp.description || "");
    setDate(exp.date);
    setConsumptionValue(exp.consumption_value != null ? String(exp.consumption_value) : "");
    setAccountId(exp.account_id || "");
    setNewDocFile(null);
  };

  const handleDelete = (id: string) => {
    if (!confirm("Sei sicuro di voler eliminare questa registrazione?")) return;

    startTransition(async () => {
      try {
        const res = await deleteExpense(id);
        if (!res.success) {
          alert(res.error || "Errore durante l'eliminazione");
          return;
        }
        setExpenses(prev => prev.filter(item => item.id !== id));
        if (editingId === id) resetForm();
      } catch (err: any) {
        alert(err.message || "Errore durante l'eliminazione");
      }
    });
  };

  const toggleAttachPanel = (exp: ExpenseWithRelations) => {
    if (expandedExpenseId === exp.id) {
      setExpandedExpenseId(null);
      return;
    }
    setExpandedExpenseId(exp.id);
    setAttachTitle(exp.description || (exp.is_income ? "Entrata" : "Spesa"));
    setAttachFile(null);
  };

  const handleAttachFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      alert("Il file supera la dimensione massima consigliata di 10MB");
      return;
    }
    setAttachFile(file);
  };

  const handleUploadAttachment = (expenseId: string, supplierIdForDoc: string | null) => {
    if (!attachFile || !attachTitle.trim()) {
      alert("Seleziona un file e inserisci un titolo");
      return;
    }
    if (!googleConnected) {
      alert("Collega prima il tuo account Google Drive per poter allegare un file.");
      return;
    }

    setIsUploadingDoc(true);
    startTransition(async () => {
      try {
        await uploadAndLinkDocument(attachFile, expenseId, supplierIdForDoc, attachTitle.trim(), attachDocType);
        setAttachFile(null);
        setAttachTitle("");
        setAttachDocType("bolletta");
      } finally {
        setIsUploadingDoc(false);
      }
    });
  };

  const handleDeleteAttachment = (docId: string) => {
    if (!confirm("Eliminare questo allegato?")) return;
    startTransition(async () => {
      try {
        const res = await deleteSupplierDocument(docId);
        if (!res.success) {
          alert(res.error || "Errore durante l'eliminazione dell'allegato");
          return;
        }
        setDocuments(prev => prev.filter(d => d.id !== docId));
      } catch (err: any) {
        alert(err.message || "Errore durante l'eliminazione dell'allegato");
      }
    });
  };

  // Calcolo Totali del mese per il tab attivo
  const monthlyTotal = useMemo(() => {
    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = now.getMonth();

    return expenses
      .filter(exp => {
        const eDate = new Date(exp.date);
        const isCurMonth = eDate.getFullYear() === curYear && eDate.getMonth() === curMonth;
        return isCurMonth && (isIncomeMode ? exp.is_income : !exp.is_income);
      })
      .reduce((sum, exp) => sum + Number(exp.amount), 0);
  }, [expenses, isIncomeMode]);

  // Lista filtrata separata per il tab attivo
  const filteredList = useMemo(() => {
    return expenses.filter(exp => {
      const matchType = isIncomeMode ? exp.is_income : !exp.is_income;
      const matchCategory = filterCategoryId === "all" || exp.category_id === filterCategoryId;
      const matchSearch = exp.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          exp.expense_categories?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          exp.suppliers?.name.toLowerCase().includes(searchQuery.toLowerCase());
      return matchType && matchCategory && matchSearch;
    });
  }, [expenses, isIncomeMode, filterCategoryId, searchQuery]);


  return (
    <div className="p-4 md:p-8 space-y-8 max-w-7xl mx-auto">
      {/* Header con i 3 tab principali */}
      <div className="animate-fade-in flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
            Spese, Entrate e Scadenze
          </h1>
          <p className="text-sm text-slate-400 mt-1">Registra i movimenti reali, allega le bollette e tieni traccia delle scadenze.</p>
        </div>

        {/* Tab Switcher con Neon Glow */}
        <div className="flex gap-2 p-1.5 bg-zinc-950/80 border border-white/10 rounded-2xl w-fit shadow-xl">
          <button
            type="button"
            onClick={() => setMainTab("uscite")}
            className={`px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 ${
              mainTab === "uscite"
                ? "bg-rose-500/20 text-rose-400 border border-rose-500/30 shadow-[0_0_20px_rgba(244,63,94,0.25)]"
                : "text-zinc-400 hover:text-white hover:bg-white/5"
            }`}
          >
            <span>💸</span> Uscite
          </button>
          <button
            type="button"
            onClick={() => setMainTab("entrate")}
            className={`px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 ${
              mainTab === "entrate"
                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.25)]"
                : "text-zinc-400 hover:text-white hover:bg-white/5"
            }`}
          >
            <span>💰</span> Entrate
          </button>
          <button
            type="button"
            onClick={() => setMainTab("scadenze")}
            className={`px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 ${
              mainTab === "scadenze"
                ? "bg-amber-500/20 text-amber-400 border border-amber-500/30 shadow-[0_0_20px_rgba(245,158,11,0.25)]"
                : "text-zinc-400 hover:text-white hover:bg-white/5"
            }`}
          >
            <span>📅</span> Scadenze
          </button>
        </div>
      </div>

      {mainTab === "scadenze" ? (
        <SchedulesClient
          initialSchedules={initialSchedules}
          categories={categories}
          suppliers={suppliersList}
          googleConnected={googleConnected}
          onExpenseCreated={(exp) => setExpenses(prev => [exp, ...prev])}
          onSupplierCreated={(sup) => setSuppliersList(prev => [...prev, sup].sort((a, b) => a.name.localeCompare(b.name)))}
        />
      ) : (
        <>
          {/* KPI Card Risorse per il tab attivo */}
          <div
            className="rounded-2xl p-5 border relative overflow-hidden group backdrop-blur-xl animate-fade-in"
            style={{
              background: isIncomeMode
                ? "linear-gradient(135deg, hsla(150, 60%, 15%, 0.08), hsla(240, 10%, 10%, 0.7))"
                : "linear-gradient(135deg, hsla(350, 60%, 15%, 0.08), hsla(240, 10%, 10%, 0.7))",
              borderColor: isIncomeMode
                ? "hsla(150, 60%, 50%, 0.15)"
                : "hsla(350, 60%, 50%, 0.15)",
            }}
          >
            <div className="flex justify-between items-center relative z-10">
              <div>
                <h4 className={`text-[10px] font-bold uppercase tracking-widest ${isIncomeMode ? "text-emerald-400" : "text-rose-400"}`}>
                  {isIncomeMode ? "Totale Entrate Questo Mese" : "Totale Uscite Questo Mese"}
                </h4>
                <p className="text-3xl font-black text-white mt-1">{formatCurrency(monthlyTotal)}</p>
              </div>
              <div className={`p-3.5 rounded-2xl text-xl font-bold ${
                isIncomeMode ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
              }`}>
                {isIncomeMode ? "📈" : "📉"}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

            {/* Form di Inserimento */}
            <div
              className="rounded-2xl p-6 border relative overflow-hidden group shadow-2xl backdrop-blur-xl animate-fade-in h-fit"
              style={{
                background: isIncomeMode
                  ? "linear-gradient(135deg, hsla(150, 60%, 15%, 0.08), hsla(240, 10%, 10%, 0.7))"
                  : "linear-gradient(135deg, hsla(350, 60%, 15%, 0.08), hsla(240, 10%, 10%, 0.7))",
                borderColor: isIncomeMode
                  ? "hsla(150, 60%, 50%, 0.15)"
                  : "hsla(350, 60%, 50%, 0.15)",
              }}
            >
              <div className="absolute top-[-30%] right-[-20%] w-40 h-40 rounded-full bg-rose-500/5 blur-[50px] pointer-events-none" />

              <h2 className="text-base font-extrabold bg-gradient-to-r from-white to-zinc-300 bg-clip-text text-transparent mb-5 tracking-tight flex items-center gap-2">
                <span className={isIncomeMode ? "text-emerald-400" : "text-rose-400"}><ExpensesIcon size={16} /></span>
                {editingId ? (isIncomeMode ? "Modifica Entrata" : "Modifica Spesa") : (isIncomeMode ? "Nuova Entrata" : "Nuova Spesa")}
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
                      e.target.style.borderColor = isIncomeMode ? "hsl(142 70% 45%)" : "hsl(350 85% 55%)";
                      e.target.style.boxShadow = isIncomeMode ? "0 0 15px rgba(16,185,129,0.15)" : "0 0 15px rgba(244,63,94,0.15)";
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = "hsl(240 5% 18%)";
                      e.target.style.boxShadow = "none";
                    }}
                  />
                </div>

                {/* Categoria (Solo se Uscita) */}
                {!isIncomeMode && (
                  <div className="space-y-1.5 animate-fade-in">
                    <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Categoria Spesa</label>
                    <select
                      value={categoryId}
                      onChange={(e) => setCategoryId(e.target.value)}
                      required
                      className="w-full px-4 py-3 rounded-xl text-xs text-white focus:outline-none border select-custom transition-all"
                      style={{
                        background: "hsl(240 10% 4% / 0.8)",
                        borderColor: "hsl(240 5% 18%)",
                      }}
                      onFocus={(e) => {
                        e.target.style.borderColor = "hsl(350 85% 55%)";
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = "hsl(240 5% 18%)";
                      }}
                    >
                      {categories.length === 0 ? (
                        <option value="">Nessuna categoria configurata</option>
                      ) : (
                        categories.map((cat) => (
                          <option key={cat.id} value={cat.id} style={{ background: "hsl(240 10% 10%)" }}>
                            {cat.name}
                          </option>
                        ))
                      )}
                    </select>
                  </div>
                )}

                {/* Fornitore (Solo se Uscita) */}
                {!isIncomeMode && (
                  <div className="space-y-1.5 animate-fade-in">
                    <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Fornitore / Servizio</label>
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
                        onFocus={(e) => {
                          e.target.style.borderColor = "hsl(350 85% 55%)";
                        }}
                        onBlur={(e) => {
                          e.target.style.borderColor = "hsl(240 5% 18%)";
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
                            style={{ background: "hsl(240 10% 4% / 0.8)", borderColor: "hsl(350 85% 55%)" }}
                          />
                          <button
                            type="button"
                            onClick={handleCreateSupplierInline}
                            disabled={isCreatingSupplier}
                            className="px-3 rounded-xl text-xs font-extrabold text-white bg-rose-600 hover:bg-rose-500 transition-all disabled:opacity-50"
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
                            className="accent-rose-500"
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

                {/* Consumo (solo se il fornitore selezionato e' un'utenza) */}
                {!isIncomeMode && selectedSupplier?.is_utility && (
                  <div className="space-y-1.5 animate-fade-in">
                    <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                      Consumo del periodo ({selectedSupplier.consumption_unit || "unità"})
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={consumptionValue}
                      onChange={(e) => setConsumptionValue(e.target.value)}
                      placeholder={`es. 320 ${selectedSupplier.consumption_unit || ""}`}
                      className="w-full px-4 py-3 rounded-xl text-xs text-white focus:outline-none border transition-all"
                      style={{
                        background: "hsl(240 10% 4% / 0.8)",
                        borderColor: "hsl(240 5% 18%)",
                      }}
                    />
                  </div>
                )}

                {/* Data */}
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Data registrata</label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    required
                    className="w-full px-4 py-3 rounded-xl text-xs text-white focus:outline-none border text-left transition-all"
                    style={{
                      background: "hsl(240 10% 4% / 0.8)",
                      borderColor: "hsl(240 5% 18%)",
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = isIncomeMode ? "hsl(142 70% 45%)" : "hsl(350 85% 55%)";
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = "hsl(240 5% 18%)";
                    }}
                  />
                </div>

                {/* Conto (facoltativo) */}
                {initialAccounts.length > 0 && (
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Conto (facoltativo)</label>
                    <select
                      value={accountId}
                      onChange={(e) => setAccountId(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl text-xs text-white focus:outline-none border select-custom transition-all"
                      style={{
                        background: "hsl(240 10% 4% / 0.8)",
                        borderColor: "hsl(240 5% 18%)",
                      }}
                    >
                      <option value="" style={{ background: "hsl(240 10% 10%)" }}>Nessun conto</option>
                      {initialAccounts.map((acc) => (
                        <option key={acc.id} value={acc.id} style={{ background: "hsl(240 10% 10%)" }}>
                          {acc.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Descrizione / Note */}
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                    {isIncomeMode ? "Origine / Descrizione (es. Stipendio, Rimborso)" : "Note / Causale Spesa"}
                  </label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder={isIncomeMode ? "es. Stipendio mese corrente, Rendita" : "es. Spesa alimentari, Rifornimento carburante"}
                    className="w-full px-4 py-3 rounded-xl text-xs text-white focus:outline-none transition-all duration-200 border"
                    style={{
                      background: "hsl(240 10% 4% / 0.8)",
                      borderColor: "hsl(240 5% 18%)",
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = isIncomeMode ? "hsl(142 70% 45%)" : "hsl(350 85% 55%)";
                      e.target.style.boxShadow = isIncomeMode ? "0 0 15px rgba(16,185,129,0.15)" : "0 0 15px rgba(244,63,94,0.15)";
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = "hsl(240 5% 18%)";
                      e.target.style.boxShadow = "none";
                    }}
                  />
                </div>

                {/* Allega documento (bolletta/ricevuta/busta paga) */}
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                    📎 Allega documento su Drive (facoltativo)
                  </label>
                  <input
                    type="file"
                    accept="application/pdf,image/*"
                    onChange={handleNewDocFileChange}
                    className="w-full px-3 py-2 rounded-xl text-xs text-slate-300 focus:outline-none border border-zinc-800 bg-zinc-950/80 file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-[10px] file:font-bold file:bg-sky-500/20 file:text-sky-300 hover:file:bg-sky-500/30 cursor-pointer"
                  />
                  {newDocFile && (
                    <>
                      <p className="text-[9px] text-sky-400 font-semibold truncate">📄 {newDocFile.name}</p>
                      <select
                        value={newDocType}
                        onChange={(e) => setNewDocType(e.target.value as any)}
                        className="w-full px-3 py-2 rounded-lg text-[10px] text-white bg-zinc-950 border border-zinc-800 focus:outline-none"
                      >
                        <option value="bolletta">📄 Bolletta / Ricevuta</option>
                        <option value="contratto">📑 Contratto</option>
                        <option value="altro">📎 Altro</option>
                      </select>
                    </>
                  )}
                  {newDocFile && !googleConnected && (
                    <p className="text-[9px] text-amber-400 font-semibold">
                      Collega prima <a href="/api/google/connect?next=/dashboard/expenses" className="underline">Google Drive</a> per poterlo caricare.
                    </p>
                  )}
                </div>

                {/* Pulsanti */}
                <div className="flex gap-3 pt-2">
                  {editingId && (
                    <button
                      type="button"
                      onClick={resetForm}
                      className="flex-1 py-3 rounded-xl text-xs font-bold text-slate-300 hover:text-white transition-all border border-zinc-800"
                      style={{
                        background: "hsl(240 10% 15%)",
                      }}
                    >
                      Annulla
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={isPending}
                    className="flex-1 py-3 rounded-xl text-xs font-extrabold text-white transition-all shadow-[0_0_20px_rgba(244,63,94,0.15)] hover:shadow-[0_0_30px_rgba(244,63,94,0.3)] active:scale-98"
                    style={{
                      background: isIncomeMode
                        ? "linear-gradient(135deg, hsl(142 70% 45%), hsl(150 60% 35%))"
                        : "linear-gradient(135deg, hsl(350 85% 55%), hsl(340 75% 45%))",
                      cursor: isPending ? "not-allowed" : "pointer",
                    }}
                  >
                    {isPending ? "Salvataggio..." : editingId ? "Salva Modifiche" : (isIncomeMode ? "Registra Entrata" : "Registra Spesa")}
                  </button>
                </div>
              </form>
            </div>

            {/* Tabella Registro (2 Colonne) */}
            <div
              className="lg:col-span-2 rounded-2xl p-6 border flex flex-col space-y-5 shadow-2xl relative overflow-hidden group backdrop-blur-xl animate-fade-in"
              style={{
                background: "linear-gradient(135deg, hsla(240, 10%, 12%, 0.5), hsla(240, 10%, 10%, 0.8))",
                borderColor: "hsla(240, 5%, 18%, 0.7)",
              }}
            >
              <div className="absolute top-[-30%] left-[-20%] w-60 h-60 rounded-full bg-zinc-500/5 blur-[80px] pointer-events-none" />

              {/* Filtri */}
              <div className="flex flex-col sm:flex-row gap-3 relative z-10">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={isIncomeMode ? "Cerca entrate..." : "Cerca per note o fornitore..."}
                    className="w-full pl-4 pr-10 py-3 rounded-xl text-xs text-white focus:outline-none border transition-all"
                    style={{
                      background: "hsl(240 10% 4% / 0.6)",
                      borderColor: "hsl(240 5% 15% / 0.8)",
                    }}
                    onFocus={(e) => e.target.style.borderColor = "hsl(240 5% 35%)"}
                    onBlur={(e) => e.target.style.borderColor = "hsl(240 5% 15% / 0.8)"}
                  />
                </div>

                {!isIncomeMode && (
                  <select
                    value={filterCategoryId}
                    onChange={(e) => setFilterCategoryId(e.target.value)}
                    className="px-4 py-3 rounded-xl text-xs text-white focus:outline-none border"
                    style={{
                      background: "hsl(240 10% 4% / 0.6)",
                      borderColor: "hsl(240 5% 15% / 0.8)",
                    }}
                  >
                    <option value="all">Tutte le Categorie</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id} style={{ background: "hsl(240 10% 10%)" }}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Elenco Tabella */}
              <div className="flex-1 overflow-x-auto pr-1 relative z-10">
                {filteredList.length === 0 ? (
                  <div className="text-center py-16 text-slate-500 flex flex-col items-center justify-center">
                    <span className="text-3xl mb-2">{isIncomeMode ? "💰" : "💸"}</span>
                    <p className="text-xs">{isIncomeMode ? "Nessuna entrata registrata." : "Nessuna spesa trovata."}</p>
                  </div>
                ) : (
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b" style={{ borderColor: "hsl(240 5% 18% / 0.7)" }}>
                        <th className="pb-3.5 font-bold text-slate-400 uppercase tracking-wider text-[9px]">Data</th>
                        <th className="pb-3.5 font-bold text-slate-400 uppercase tracking-wider text-[9px]">
                          {isIncomeMode ? "Descrizione Entrata" : "Fornitore & Note"}
                        </th>
                        {!isIncomeMode && (
                          <th className="pb-3.5 font-bold text-slate-400 uppercase tracking-wider text-[9px]">Categoria</th>
                        )}
                        <th className="pb-3.5 font-bold text-slate-400 uppercase tracking-wider text-[9px] text-right">Importo</th>
                        <th className="pb-3.5 font-bold text-slate-400 uppercase tracking-wider text-[9px] text-center">Azioni</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y" style={{ borderColor: "hsl(240 5% 18% / 0.3)" }}>
                      {filteredList.map((exp, index) => {
                        const catName = exp.expense_categories?.name || exp.category;
                        const catColor = exp.expense_categories?.color || "slate";
                        const badge = getCategoryBadgeStyle(catColor);
                        const attachments = docsByExpense[exp.id] || [];
                        const isExpanded = expandedExpenseId === exp.id;

                        return (
                          <Fragment key={exp.id}>
                            <tr className="hover:bg-white/2 transition-all duration-150 group animate-fade-in" style={{ animationDelay: `${index * 15}ms` }}>
                              <td className="py-4 text-slate-300 font-semibold whitespace-nowrap align-top">
                                {formatDate(exp.date)}
                              </td>
                              <td className="py-4 pr-3 align-top">
                                {isIncomeMode ? (
                                  <div className="text-white font-bold">{exp.description || "Entrata Senza Descrizione"}</div>
                                ) : (
                                  <>
                                    <div className="text-white font-bold max-w-[200px] truncate">
                                      {exp.suppliers?.name || "Nessun Fornitore"}
                                    </div>
                                    {exp.description && (
                                      <div className="text-[10px] text-slate-400 mt-0.5 max-w-[200px] truncate font-medium">
                                        {exp.description}
                                      </div>
                                    )}
                                  </>
                                )}
                                {exp.schedule_id && (
                                  <div className="text-[8px] text-amber-500/80 font-bold uppercase tracking-wider mt-0.5">
                                    📅 Da scadenza pagata
                                  </div>
                                )}
                              </td>
                              {!isIncomeMode && (
                                <td className="py-4 align-top">
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
                              )}
                              <td className={`py-4 text-right font-black text-sm whitespace-nowrap align-top ${isIncomeMode ? "text-emerald-400" : "text-rose-400"}`}>
                                {isIncomeMode ? "+" : "-"}{formatCurrency(exp.amount)}
                              </td>
                              <td className="py-4 text-center align-top">
                                <div className="flex items-center justify-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                  <button
                                    onClick={() => toggleAttachPanel(exp)}
                                    className={`w-7 h-7 rounded-lg text-xs border flex items-center justify-center transition-all relative ${
                                      isExpanded ? "bg-sky-500/20 text-sky-300 border-sky-500/30" : "border-transparent hover:bg-sky-500/10 hover:text-sky-400 hover:border-sky-500/20"
                                    }`}
                                    title="Allegati"
                                  >
                                    📎
                                    {attachments.length > 0 && (
                                      <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-sky-500 text-white text-[8px] font-bold flex items-center justify-center">
                                        {attachments.length}
                                      </span>
                                    )}
                                  </button>
                                  <button
                                    onClick={() => handleEdit(exp)}
                                    className="w-7 h-7 rounded-lg text-xs hover:bg-blue-500/10 hover:text-blue-400 border border-transparent hover:border-blue-500/20 flex items-center justify-center transition-all"
                                    title="Modifica"
                                  >
                                    <EditIcon size={12} />
                                  </button>
                                  <button
                                    onClick={() => handleDelete(exp.id)}
                                    className="w-7 h-7 rounded-lg text-xs hover:bg-rose-500/10 hover:text-rose-400 border border-transparent hover:border-rose-500/20 flex items-center justify-center transition-all"
                                    title="Elimina"
                                  >
                                    <DeleteIcon size={12} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                            {isExpanded && (
                              <tr>
                                <td colSpan={isIncomeMode ? 4 : 5} className="pb-4">
                                  <div className="p-4 rounded-xl bg-zinc-950/60 border border-zinc-800/80 space-y-3">
                                    {attachments.length > 0 && (
                                      <div className="space-y-1.5">
                                        {attachments.map((doc) => (
                                          <div key={doc.id} className="flex items-center justify-between gap-2 p-2 rounded-lg bg-zinc-900/60 border border-zinc-800/60">
                                            <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="text-[11px] font-bold text-sky-300 hover:text-sky-200 truncate flex-1">
                                              {doc.doc_type === "contratto" ? "📑" : "📄"} {doc.title} <span className="text-zinc-500 font-medium">{formatFileSize(doc.file_size)}</span>
                                            </a>
                                            <button
                                              onClick={() => handleDeleteAttachment(doc.id)}
                                              className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-all"
                                              title="Elimina allegato"
                                            >
                                              <DeleteIcon size={11} />
                                            </button>
                                          </div>
                                        ))}
                                      </div>
                                    )}

                                    {!googleConnected ? (
                                      <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[10px] text-amber-300 space-y-2">
                                        <p className="font-semibold">Collega Google Drive per allegare documenti.</p>
                                        <a
                                          href="/api/google/connect?next=/dashboard/expenses"
                                          className="inline-block px-3 py-1.5 rounded-lg text-[9px] font-extrabold text-white bg-amber-600 hover:bg-amber-500 transition-all"
                                        >
                                          🔗 Collega account Google
                                        </a>
                                      </div>
                                    ) : (
                                      <div className="flex flex-col sm:flex-row gap-2">
                                        <input
                                          type="file"
                                          accept="application/pdf,image/*"
                                          onChange={handleAttachFileChange}
                                          className="flex-1 text-[10px] text-slate-300 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-[9px] file:font-bold file:bg-sky-500/20 file:text-sky-300 hover:file:bg-sky-500/30 cursor-pointer"
                                        />
                                        <input
                                          type="text"
                                          value={attachTitle}
                                          onChange={(e) => setAttachTitle(e.target.value)}
                                          placeholder="Titolo allegato"
                                          className="px-3 py-1.5 rounded-lg text-[10px] text-white bg-zinc-950 border border-zinc-800 focus:outline-none"
                                        />
                                        <select
                                          value={attachDocType}
                                          onChange={(e) => setAttachDocType(e.target.value as any)}
                                          className="px-2 py-1.5 rounded-lg text-[10px] text-white bg-zinc-950 border border-zinc-800 focus:outline-none"
                                        >
                                          <option value="bolletta">📄 Bolletta</option>
                                          <option value="contratto">📑 Contratto</option>
                                          <option value="altro">📎 Altro</option>
                                        </select>
                                        <button
                                          onClick={() => handleUploadAttachment(exp.id, exp.supplier_id)}
                                          disabled={isUploadingDoc || !attachFile}
                                          className="px-3 py-1.5 rounded-lg text-[10px] font-extrabold text-white bg-sky-600 hover:bg-sky-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                                        >
                                          {isUploadingDoc ? "Caricamento..." : "Carica"}
                                        </button>
                                      </div>
                                    )}
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
        </>
      )}
    </div>
  );
}

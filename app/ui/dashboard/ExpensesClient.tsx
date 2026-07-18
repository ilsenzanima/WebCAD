"use client";

import { useState, useTransition } from "react";
import { type Expense } from "@/lib/types/database";
import { createExpense, updateExpense, deleteExpense } from "@/app/actions/expenses";

interface ExpensesClientProps {
  initialExpenses: Expense[];
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

export default function ExpensesClient({ initialExpenses }: ExpensesClientProps) {
  const [expenses, setExpenses] = useState<Expense[]>(initialExpenses);
  const [isPending, startTransition] = useTransition();

  // Stati del form
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);

  // Stato per la modifica
  const [editingId, setEditingId] = useState<string | null>(null);

  // Filtri
  const [filterCategory, setFilterCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const resetForm = () => {
    setAmount("");
    setCategory(CATEGORIES[0]);
    setDescription("");
    setDate(new Date().toISOString().split("T")[0]);
    setEditingId(null);
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
          date,
        };

        if (editingId) {
          await updateExpense(editingId, payload);
          // Ottimizzazione locale immediata prima del refetch
          setExpenses(prev =>
            prev.map(item =>
              item.id === editingId
                ? { ...item, ...payload }
                : item
            )
          );
        } else {
          await createExpense(payload);
          // Aggiunta locale temporanea (verrà sovrascritta dal server component)
          const newExp: Expense = {
            id: Math.random().toString(), // id temporaneo
            user_id: "",
            amount: Number(amount),
            category,
            description,
            date,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          setExpenses(prev => [newExp, ...prev].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
        }
        resetForm();
      } catch (err: any) {
        alert(err.message || "Si è verificato un errore");
      }
    });
  };

  const handleEdit = (exp: Expense) => {
    setEditingId(exp.id);
    setAmount(exp.amount.toString());
    setCategory(exp.category);
    setDescription(exp.description || "");
    setDate(exp.date);
  };

  const handleDelete = (id: string) => {
    if (!confirm("Sei sicuro di voler eliminare questa spesa?")) return;

    startTransition(async () => {
      try {
        await deleteExpense(id);
        setExpenses(prev => prev.filter(item => item.id !== id));
      } catch (err: any) {
        alert(err.message || "Errore durante l'eliminazione");
      }
    });
  };

  // Filtra e ordina localmente le spese
  const filteredExpenses = expenses.filter(exp => {
    const matchesCategory = filterCategory === "all" || exp.category === filterCategory;
    const matchesSearch = exp.description?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          exp.category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(val);
  };

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">Gestione Spese</h1>
          <p className="text-sm text-gray-400 mt-1">Registra le transazioni e tieni traccia delle tue uscite.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Form di inserimento/modifica (1 colonna) */}
        <div
          className="rounded-2xl p-6 border h-fit"
          style={{
            background: "hsl(220 32% 10%)",
            borderColor: "hsl(220 20% 16%)",
          }}
        >
          <h2 className="text-lg font-bold text-white mb-4">
            {editingId ? "📝 Modifica Spesa" : "💰 Registra Nuova Spesa"}
          </h2>

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
                className="w-full px-4 py-2.5 rounded-xl text-sm text-white focus:outline-none transition-colors"
                style={{
                  background: "hsl(220 26% 14%)",
                  border: "1px solid hsl(220 20% 22%)",
                }}
                onFocus={(e) => e.target.style.borderColor = "hsl(220 90% 56%)"}
                onBlur={(e) => e.target.style.borderColor = "hsl(220 20% 22%)"}
              />
            </div>

            {/* Categoria */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-gray-400 uppercase">Categoria</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl text-sm text-white focus:outline-none transition-colors"
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

            {/* Data */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-gray-400 uppercase">Data</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="w-full px-4 py-2.5 rounded-xl text-sm text-white focus:outline-none transition-colors text-left"
                style={{
                  background: "hsl(220 26% 14%)",
                  border: "1px solid hsl(220 20% 22%)",
                }}
              />
            </div>

            {/* Descrizione */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-gray-400 uppercase">Descrizione / Fornitore</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="es. Spesa Esselunga, Bolletta Luce..."
                className="w-full px-4 py-2.5 rounded-xl text-sm text-white focus:outline-none transition-colors"
                style={{
                  background: "hsl(220 26% 14%)",
                  border: "1px solid hsl(220 20% 22%)",
                }}
                onFocus={(e) => e.target.style.borderColor = "hsl(220 90% 56%)"}
                onBlur={(e) => e.target.style.borderColor = "hsl(220 20% 22%)"}
              />
            </div>

            {/* Pulsanti */}
            <div className="flex gap-3 pt-2">
              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="flex-1 py-2.5 rounded-xl text-xs font-semibold text-white/70 hover:text-white transition-colors"
                  style={{
                    background: "hsl(220 20% 16%)",
                    border: "1px solid hsl(220 20% 22%)",
                  }}
                >
                  Annulla
                </button>
              )}
              <button
                type="submit"
                disabled={isPending}
                className="flex-1 py-2.5 rounded-xl text-xs font-semibold text-white transition-all shadow-md"
                style={{
                  background: "linear-gradient(135deg, hsl(220 90% 56%), hsl(215 85% 48%))",
                  cursor: isPending ? "not-allowed" : "pointer",
                }}
              >
                {isPending ? "Salvataggio..." : editingId ? "Salva Modifiche" : "Aggiungi Spesa"}
              </button>
            </div>
          </form>
        </div>

        {/* Lista e Tabella Spese (2 colonne) */}
        <div
          className="lg:col-span-2 rounded-2xl p-6 border flex flex-col space-y-4"
          style={{
            background: "hsl(220 32% 10%)",
            borderColor: "hsl(220 20% 16%)",
          }}
        >
          {/* Barra Filtri */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cerca per descrizione..."
                className="w-full pl-4 pr-10 py-2 rounded-xl text-xs text-white focus:outline-none"
                style={{
                  background: "hsl(220 26% 14%)",
                  border: "1px solid hsl(220 20% 22%)",
                }}
              />
            </div>

            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="px-4 py-2 rounded-xl text-xs text-white focus:outline-none"
              style={{
                background: "hsl(220 26% 14%)",
                border: "1px solid hsl(220 20% 22%)",
              }}
            >
              <option value="all">Tutte le Categorie</option>
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Elenco Spese */}
          <div className="flex-1 overflow-x-auto">
            {filteredExpenses.length === 0 ? (
              <div className="text-center p-12 text-gray-500 flex flex-col items-center justify-center">
                <span className="text-4xl mb-2">🍽️</span>
                <p className="text-sm">Nessuna spesa trovata per i criteri selezionati.</p>
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b" style={{ borderColor: "hsl(220 20% 16%)" }}>
                    <th className="pb-3 font-semibold text-gray-400">Data</th>
                    <th className="pb-3 font-semibold text-gray-400">Descrizione</th>
                    <th className="pb-3 font-semibold text-gray-400">Categoria</th>
                    <th className="pb-3 font-semibold text-gray-400 text-right">Importo</th>
                    <th className="pb-3 font-semibold text-gray-400 text-center">Azioni</th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: "hsl(220 20% 16%)" }}>
                  {filteredExpenses.map((exp) => (
                    <tr key={exp.id} className="hover:bg-white/2 transition-colors">
                      <td className="py-3.5 text-gray-300 font-medium">
                        {new Date(exp.date).toLocaleDateString("it-IT")}
                      </td>
                      <td className="py-3.5 text-white font-semibold">
                        {exp.description || "-"}
                      </td>
                      <td className="py-3.5 text-gray-400">{exp.category}</td>
                      <td className="py-3.5 text-right font-bold text-red-400">
                        -{formatCurrency(exp.amount)}
                      </td>
                      <td className="py-3.5 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleEdit(exp)}
                            className="p-1.5 rounded-lg text-blue-400 hover:bg-blue-500/10 transition-colors"
                            title="Modifica"
                          >
                            ✏️
                          </button>
                          <button
                            onClick={() => handleDelete(exp.id)}
                            className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors"
                            title="Elimina"
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

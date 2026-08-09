"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function createSupplierDocument(formData: {
  supplier_id?: string | null;
  expense_id?: string | null;
  schedule_id?: string | null;
  title: string;
  file_url: string;
  provider?: "local" | "gdrive" | "onedrive";
  file_size?: number | null;
  doc_type?: "contratto" | "bolletta" | "altro";
  gdrive_file_id?: string | null;
  document_year?: number | null;
}) {
  try {
    if (!formData.supplier_id && !formData.expense_id && !formData.schedule_id) {
      throw new Error("Nessun elemento a cui collegare il documento");
    }

    const supabase = (await createClient()) as any;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Non autenticato");

    const { data, error } = await supabase.from("supplier_documents").insert({
      user_id: user.id,
      supplier_id: formData.supplier_id || null,
      expense_id: formData.expense_id || null,
      schedule_id: formData.schedule_id || null,
      title: formData.title,
      file_url: formData.file_url,
      provider: formData.provider || "local",
      file_size: formData.file_size || null,
      doc_type: formData.doc_type || "altro",
      gdrive_file_id: formData.gdrive_file_id || null,
      document_year: formData.document_year || null,
    }).select().single();

    if (error) throw new Error(error.message);

    if (formData.supplier_id) revalidatePath(`/dashboard/suppliers/${formData.supplier_id}`);
    if (formData.expense_id) revalidatePath("/dashboard/expenses");
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Collega un documento a un fornitore registrando anche il dato finanziario che rappresenta:
 * se "is_paid" e' true crea una Spesa gia' registrata (con la data di pagamento fornita),
 * altrimenti crea una Scadenza da saldare (con la data di scadenza fornita). Usata sia dallo
 * smistamento Scansioni sia dal caricamento diretto dalla scheda fornitore, cosi' assegnare
 * una bolletta scansionata o caricata puo' anche popolare importo/consumo/scadenza in un colpo
 * solo invece di dover poi ripetere l'inserimento in Spese o Scadenze.
 */
export async function createDocumentWithFinancials(formData: {
  supplier_id: string;
  title: string;
  file_url: string;
  gdrive_file_id?: string | null;
  file_size?: number | null;
  doc_type: "contratto" | "bolletta" | "altro";
  document_year?: number | null;
  amount?: number | null;
  category_id?: string | null;
  category_name?: string;
  consumption_value?: number | null;
  is_paid?: boolean;
  date?: string | null;
}) {
  try {
    const supabase = (await createClient()) as any;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Non autenticato");

    let expenseId: string | null = null;
    let scheduleId: string | null = null;

    if (formData.amount && formData.amount > 0) {
      if (!formData.date) throw new Error("Inserisci una data per registrare l'importo");

      if (formData.is_paid) {
        const { data: expense, error } = await supabase.from("expenses").insert({
          user_id: user.id,
          amount: formData.amount,
          category: formData.category_name || "Generica",
          category_id: formData.category_id || null,
          supplier_id: formData.supplier_id,
          consumption_value: formData.consumption_value ?? null,
          description: formData.title,
          date: formData.date,
        }).select().single();
        if (error) throw new Error(error.message);
        expenseId = expense.id;
      } else {
        const { data: schedule, error } = await supabase.from("payment_schedules").insert({
          user_id: user.id,
          amount: formData.amount,
          category: formData.category_name || "Generica",
          category_id: formData.category_id || null,
          supplier_id: formData.supplier_id,
          description: formData.title,
          due_date: formData.date,
          is_paid: false,
        }).select().single();
        if (error) throw new Error(error.message);
        scheduleId = schedule.id;
      }
    }

    const { data: doc, error: docError } = await supabase.from("supplier_documents").insert({
      user_id: user.id,
      supplier_id: formData.supplier_id,
      expense_id: expenseId,
      schedule_id: scheduleId,
      title: formData.title,
      file_url: formData.file_url,
      provider: "gdrive",
      file_size: formData.file_size ?? null,
      doc_type: formData.doc_type,
      gdrive_file_id: formData.gdrive_file_id ?? null,
      document_year: formData.document_year ?? null,
    }).select().single();

    if (docError) throw new Error(docError.message);

    revalidatePath(`/dashboard/suppliers/${formData.supplier_id}`);
    revalidatePath("/dashboard/expenses");
    revalidatePath("/dashboard/schedules");
    revalidatePath("/dashboard/scansioni");
    revalidatePath("/dashboard/calendar");

    return { success: true, data: { document: doc, expenseId, scheduleId } };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function deleteSupplierDocument(id: string, supplierId?: string) {
  try {
    const supabase = (await createClient()) as any;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Non autenticato");

    const { error } = await supabase
      .from("supplier_documents")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) throw new Error(error.message);

    if (supplierId) revalidatePath(`/dashboard/suppliers/${supplierId}`);
    revalidatePath("/dashboard/expenses");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function getExpenseDocuments() {
  try {
    const supabase = (await createClient()) as any;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Non autenticato");

    const { data, error } = await supabase
      .from("supplier_documents")
      .select("*")
      .eq("user_id", user.id)
      .not("expense_id", "is", null)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    return data || [];
  } catch (err: any) {
    console.error("Errore getExpenseDocuments:", err.message);
    return [];
  }
}

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

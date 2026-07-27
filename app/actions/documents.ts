"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function createSupplierDocument(formData: {
  supplier_id: string;
  expense_id?: string | null;
  schedule_id?: string | null;
  title: string;
  file_url: string;
  provider?: "local" | "gdrive" | "onedrive";
  file_size?: number | null;
}) {
  try {
    const supabase = (await createClient()) as any;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Non autenticato");

    const { data, error } = await supabase.from("supplier_documents").insert({
      user_id: user.id,
      supplier_id: formData.supplier_id,
      expense_id: formData.expense_id || null,
      schedule_id: formData.schedule_id || null,
      title: formData.title,
      file_url: formData.file_url,
      provider: formData.provider || "local",
      file_size: formData.file_size || null,
    }).select().single();

    if (error) throw new Error(error.message);

    revalidatePath(`/dashboard/suppliers/${formData.supplier_id}`);
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function deleteSupplierDocument(id: string, supplierId: string) {
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

    revalidatePath(`/dashboard/suppliers/${supplierId}`);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

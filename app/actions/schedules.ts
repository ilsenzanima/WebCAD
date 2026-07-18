"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function getSchedules() {
  try {
    const supabase = (await createClient()) as any;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Non autenticato");

    const { data, error } = await supabase
      .from("payment_schedules")
      .select("*, expense_categories(name, color), suppliers(name)")
      .order("due_date", { ascending: true });

    if (error) throw new Error(error.message);
    return data || [];
  } catch (err: any) {
    console.error("Errore getSchedules:", err.message);
    return [];
  }
}

export async function createSchedule(formData: {
  amount: number;
  category_id: string | null;
  supplier_id: string | null;
  category_name: string;
  description: string;
  due_date: string;
  recurrence: "one-time" | "weekly" | "monthly" | "yearly";
}) {
  try {
    const supabase = (await createClient()) as any;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Non autenticato");

    const { data, error } = await supabase.from("payment_schedules").insert({
      user_id: user.id,
      amount: formData.amount,
      category: formData.category_name,
      category_id: formData.category_id || null,
      supplier_id: formData.supplier_id || null,
      description: formData.description || null,
      due_date: formData.due_date,
      recurrence: formData.recurrence,
      is_paid: false,
    }).select("*, expense_categories(name, color), suppliers(name)").single();

    if (error) throw new Error(error.message);

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/schedules");
    revalidatePath("/dashboard/calendar");
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function deleteSchedule(id: string) {
  try {
    const supabase = (await createClient()) as any;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Non autenticato");

    const { error } = await supabase
      .from("payment_schedules")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) throw new Error(error.message);

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/schedules");
    revalidatePath("/dashboard/calendar");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function paySchedule(id: string) {
  try {
    const supabase = (await createClient()) as any;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Non autenticato");

    // 1. Recupera la pianificazione
    const { data: schedule, error: fetchError } = await supabase
      .from("payment_schedules")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (fetchError || !schedule) {
      throw new Error(fetchError?.message || "Pianificazione non trovata");
    }

    // 2. Crea la spesa corrispondente (ereditando category_id e supplier_id)
    const today = new Date().toISOString().split("T")[0];
    const { error: expenseError } = await supabase.from("expenses").insert({
      user_id: user.id,
      amount: schedule.amount,
      category: schedule.category,
      category_id: schedule.category_id,
      supplier_id: schedule.supplier_id,
      description: `Pagamento programmato: ${schedule.description || "Nessuna descrizione"}`,
      date: today,
    });

    if (expenseError) throw new Error(expenseError.message);

    // 3. Segna SEMPRE il record corrente come pagato (is_paid = true)
    const { error: updateError } = await supabase
      .from("payment_schedules")
      .update({ is_paid: true })
      .eq("id", id);
    if (updateError) throw new Error(updateError.message);

    // 4. Se è ricorrente, crea una nuova scadenza per il ciclo successivo con is_paid = false
    if (schedule.recurrence !== "one-time") {
      const nextDueDate = new Date(schedule.due_date);
      if (schedule.recurrence === "weekly") {
        nextDueDate.setDate(nextDueDate.getDate() + 7);
      } else if (schedule.recurrence === "monthly") {
        nextDueDate.setMonth(nextDueDate.getMonth() + 1);
      } else if (schedule.recurrence === "yearly") {
        nextDueDate.setFullYear(nextDueDate.getFullYear() + 1);
      }

      const nextDueDateStr = nextDueDate.toISOString().split("T")[0];

      const { error: insertNextError } = await supabase.from("payment_schedules").insert({
        user_id: user.id,
        amount: schedule.amount,
        category: schedule.category,
        category_id: schedule.category_id,
        supplier_id: schedule.supplier_id,
        description: schedule.description,
        due_date: nextDueDateStr,
        recurrence: schedule.recurrence,
        is_paid: false,
      });

      if (insertNextError) throw new Error(insertNextError.message);
    }

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/expenses");
    revalidatePath("/dashboard/schedules");
    revalidatePath("/dashboard/calendar");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

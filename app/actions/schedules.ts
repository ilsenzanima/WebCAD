"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { getNextDueDate } from "@/lib/recurrence";

export async function getSchedules() {
  try {
    const supabase = (await createClient()) as any;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Non autenticato");

    const { data, error } = await supabase
      .from("payment_schedules")
      .select("*, expense_categories(name, color), suppliers(name)")
      .eq("user_id", user.id)
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

export async function updateSchedule(id: string, formData: {
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

    const { data, error } = await supabase
      .from("payment_schedules")
      .update({
        amount: formData.amount,
        category: formData.category_name,
        category_id: formData.category_id || null,
        supplier_id: formData.supplier_id || null,
        description: formData.description || null,
        due_date: formData.due_date,
        recurrence: formData.recurrence,
      })
      .eq("id", id)
      .eq("user_id", user.id)
      .select("*, expense_categories(name, color), suppliers(name)")
      .single();

    if (error) throw new Error(error.message);

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/expenses");
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

    // 2. Crea la spesa corrispondente (ereditando category_id, supplier_id e budget_id)
    const today = new Date().toISOString().split("T")[0];
    const { error: expenseError } = await supabase.from("expenses").insert({
      user_id: user.id,
      amount: schedule.amount,
      category: schedule.category,
      category_id: schedule.category_id,
      supplier_id: schedule.supplier_id,
      schedule_id: schedule.id,
      budget_id: schedule.budget_id,
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
      const nextDueDateStr = getNextDueDate(schedule.due_date, schedule.recurrence);

      const { error: insertNextError } = await supabase.from("payment_schedules").insert({
        user_id: user.id,
        amount: schedule.amount,
        category: schedule.category,
        category_id: schedule.category_id,
        supplier_id: schedule.supplier_id,
        budget_id: schedule.budget_id,
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

// Genera una scadenza da pagare a partire da una voce di budget ricorrente
// (es. "Mutuo" con giorno del mese 15), collegandola tramite budget_id.
// Se la scadenza e' ricorrente, quando viene pagata (paySchedule) il budget_id
// viene ereditato sia dalla spesa generata sia dalla scadenza del mese successivo,
// cosi' la catena budget -> scadenza -> spesa resta collegata mese dopo mese.
export async function generateScheduleFromBudget(budgetId: string, formData: {
  amount: number;
  due_date: string;
  recurrence?: "one-time" | "weekly" | "monthly" | "yearly";
}) {
  try {
    const supabase = (await createClient()) as any;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Non autenticato");

    const { data: budget, error: budgetError } = await supabase
      .from("budgets")
      .select("*")
      .eq("id", budgetId)
      .eq("user_id", user.id)
      .single();

    if (budgetError || !budget) throw new Error(budgetError?.message || "Voce di budget non trovata");

    const { data, error } = await supabase.from("payment_schedules").insert({
      user_id: user.id,
      amount: formData.amount,
      category: budget.label,
      category_id: budget.category_id,
      supplier_id: budget.supplier_id,
      budget_id: budget.id,
      description: budget.label,
      due_date: formData.due_date,
      recurrence: formData.recurrence || "monthly",
      is_paid: false,
    }).select("*, expense_categories(name, color), suppliers(name)").single();

    if (error) throw new Error(error.message);

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/expenses");
    revalidatePath("/dashboard/schedules");
    revalidatePath("/dashboard/budget");
    revalidatePath("/dashboard/calendar");
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

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

// Divide una scadenza non ancora saldata in piu' rate (es. una bolletta che il fornitore
// permette di rateizzare): l'importo di ogni rata e' calcolato lato client (di norma in parti
// uguali, ma modificabile a piacere per riflettere eventuali interessi/maggiorazioni comunicati
// dal fornitore) e passato gia' pronto qui. La scadenza originale diventa la prima rata, le altre
// vengono create come nuove scadenze "una tantum" che ereditano categoria/fornitore/budget_id.
export async function splitScheduleIntoInstallments(id: string, installments: { amount: number; due_date: string }[]) {
  try {
    const supabase = (await createClient()) as any;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Non autenticato");

    if (!Array.isArray(installments) || installments.length < 2) {
      throw new Error("Servono almeno 2 rate per dividere una scadenza");
    }
    if (installments.some(i => !i.due_date || !(i.amount > 0))) {
      throw new Error("Ogni rata deve avere un importo positivo e una data valida");
    }

    const { data: original, error: fetchError } = await supabase
      .from("payment_schedules")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (fetchError || !original) throw new Error(fetchError?.message || "Scadenza non trovata");
    if (original.is_paid) throw new Error("Non puoi dividere in rate una scadenza gia' saldata");

    const total = installments.length;
    const baseDescription = (original.description || original.category || "").replace(/\s*\(Rata \d+\/\d+\)$/, "");

    const { data: firstInstallment, error: updateError } = await supabase
      .from("payment_schedules")
      .update({
        amount: installments[0].amount,
        due_date: installments[0].due_date,
        description: `${baseDescription} (Rata 1/${total})`,
        recurrence: "one-time",
      })
      .eq("id", id)
      .eq("user_id", user.id)
      .select("*, expense_categories(name, color), suppliers(name)")
      .single();

    if (updateError) throw new Error(updateError.message);

    const restRows = installments.slice(1).map((inst, idx) => ({
      user_id: user.id,
      amount: inst.amount,
      category: original.category,
      category_id: original.category_id,
      supplier_id: original.supplier_id,
      budget_id: original.budget_id,
      description: `${baseDescription} (Rata ${idx + 2}/${total})`,
      due_date: inst.due_date,
      recurrence: "one-time",
      is_paid: false,
    }));

    const { data: restInstallments, error: insertError } = await supabase
      .from("payment_schedules")
      .insert(restRows)
      .select("*, expense_categories(name, color), suppliers(name)");

    if (insertError) throw new Error(insertError.message);

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/expenses");
    revalidatePath("/dashboard/schedules");
    revalidatePath("/dashboard/budget");
    revalidatePath("/dashboard/calendar");
    return { success: true, data: [firstInstallment, ...(restInstallments || [])] };
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

"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { getNextDueDate, isRecurrenceEnded } from "@/lib/recurrence";

type RecurrenceType = "one-time" | "weekly" | "monthly" | "bimonthly" | "quarterly" | "semiannual" | "yearly";

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
  recurrence: RecurrenceType;
  is_estimated?: boolean;
  end_month?: number | null;
  end_year?: number | null;
  budget_id?: string | null;
  is_income?: boolean;
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
      is_estimated: formData.is_estimated ?? false,
      end_month: formData.end_month || null,
      end_year: formData.end_year || null,
      budget_id: formData.budget_id || null,
      is_income: formData.is_income ?? false,
      is_paid: false,
    }).select("*, expense_categories(name, color), suppliers(name)").single();

    if (error) throw new Error(error.message);

    revalidatePath("/dashboard/overview");
    revalidatePath("/dashboard/schedules");
    revalidatePath("/dashboard/budget");
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
  recurrence: RecurrenceType;
  is_estimated?: boolean;
  end_month?: number | null;
  end_year?: number | null;
  is_income?: boolean;
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
        is_estimated: formData.is_estimated ?? false,
        end_month: formData.end_month || null,
        end_year: formData.end_year || null,
        is_income: formData.is_income ?? false,
      })
      .eq("id", id)
      .eq("user_id", user.id)
      .select("*, expense_categories(name, color), suppliers(name)")
      .single();

    if (error) throw new Error(error.message);

    revalidatePath("/dashboard/overview");
    revalidatePath("/dashboard/expenses");
    revalidatePath("/dashboard/schedules");
    revalidatePath("/dashboard/budget");
    revalidatePath("/dashboard/calendar");
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// Sposta una scadenza scaduta e non saldata a una nuova data (pulsante "Ripianifica" in Scadenze).
// A differenza di updateSchedule, marca la scadenza come was_rescheduled cosi' che compaia con un
// banner dedicato ovunque venga elencata nella pagina Budget, invece di sembrare una voce normale.
export async function rescheduleSchedule(id: string, newDueDate: string) {
  try {
    const supabase = (await createClient()) as any;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Non autenticato");

    const { data, error } = await supabase
      .from("payment_schedules")
      .update({ due_date: newDueDate, was_rescheduled: true })
      .eq("id", id)
      .eq("user_id", user.id)
      .select("*, expense_categories(name, color), suppliers(name)")
      .single();

    if (error) throw new Error(error.message);

    revalidatePath("/dashboard/overview");
    revalidatePath("/dashboard/expenses");
    revalidatePath("/dashboard/schedules");
    revalidatePath("/dashboard/budget");
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

    revalidatePath("/dashboard/overview");
    revalidatePath("/dashboard/schedules");
    revalidatePath("/dashboard/calendar");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function paySchedule(id: string, amountOverride?: number | null, consumptionValue?: number | null) {
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

    // 2. Crea la spesa corrispondente (ereditando category_id, supplier_id e budget_id;
    // consumption_value solo se fornito, tipicamente per i fornitori-utenza). L'importo e'
    // quello confermato dall'utente al momento del saldo (puo' differire dalla stima della
    // scadenza, che resta invariata per le occorrenze future). Restituiamo la riga creata
    // cosi' chi chiama puo' collegarci un documento (expense_id reale).
    const today = new Date().toISOString().split("T")[0];
    const finalAmount = amountOverride != null ? amountOverride : schedule.amount;
    const { data: newExpense, error: expenseError } = await supabase.from("expenses").insert({
      user_id: user.id,
      amount: finalAmount,
      category: schedule.category,
      category_id: schedule.category_id,
      supplier_id: schedule.supplier_id,
      schedule_id: schedule.id,
      budget_id: schedule.budget_id,
      consumption_value: consumptionValue ?? null,
      is_income: schedule.is_income ?? false,
      description: schedule.is_income
        ? `Entrata programmata: ${schedule.description || "Nessuna descrizione"}`
        : `Pagamento programmato: ${schedule.description || "Nessuna descrizione"}`,
      date: today,
    }).select().single();

    if (expenseError) throw new Error(expenseError.message);

    // 3. Segna SEMPRE il record corrente come pagato (is_paid = true)
    const { error: updateError } = await supabase
      .from("payment_schedules")
      .update({ is_paid: true })
      .eq("id", id);
    if (updateError) throw new Error(updateError.message);

    // 4. Se è ricorrente e non ha superato la sua eventuale data di fine (es. ultima rata di
    // un finanziamento), crea una nuova scadenza per il ciclo successivo con is_paid = false
    if (schedule.recurrence !== "one-time") {
      const nextDueDateStr = getNextDueDate(schedule.due_date, schedule.recurrence);

      if (!isRecurrenceEnded(nextDueDateStr, schedule.end_month, schedule.end_year)) {
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
          is_estimated: schedule.is_estimated,
          end_month: schedule.end_month,
          end_year: schedule.end_year,
          is_income: schedule.is_income,
          generated_from_schedule_id: schedule.id,
          is_paid: false,
        });

        if (insertNextError) throw new Error(insertNextError.message);
      }
    }

    revalidatePath("/dashboard/overview");
    revalidatePath("/dashboard/expenses");
    revalidatePath("/dashboard/schedules");
    revalidatePath("/dashboard/calendar");
    return { success: true, data: newExpense };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// Annulla il saldo di una scadenza cliccata "Salda" per errore: elimina la spesa generata,
// rimuove l'occorrenza successiva che il saldo aveva creato automaticamente (solo se ancora
// non saldata, per non toccare una catena gia' andata avanti) e riporta la scadenza a non saldata.
export async function unpaySchedule(id: string) {
  try {
    const supabase = (await createClient()) as any;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Non autenticato");

    const { data: schedule, error: fetchError } = await supabase
      .from("payment_schedules")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (fetchError || !schedule) throw new Error(fetchError?.message || "Scadenza non trovata");
    if (!schedule.is_paid) throw new Error("Questa scadenza non risulta saldata");

    // 1. Elimina la spesa generata dal saldo (l'eventuale documento allegato resta,
    // semplicemente perde il collegamento alla spesa: expenses.schedule_id -> ON DELETE SET NULL
    // su supplier_documents.expense_id).
    const { data: deletedExpenses, error: deleteExpenseError } = await supabase
      .from("expenses")
      .delete()
      .eq("schedule_id", id)
      .eq("user_id", user.id)
      .select("id");
    if (deleteExpenseError) throw new Error(deleteExpenseError.message);

    // 2. Se il saldo aveva generato l'occorrenza successiva e nessuno l'ha ancora saldata,
    // rimuovila: altrimenti resterebbe un doppione dopo aver riaperto questa.
    const { data: nextOccurrence } = await supabase
      .from("payment_schedules")
      .select("id, is_paid")
      .eq("generated_from_schedule_id", id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (nextOccurrence && !nextOccurrence.is_paid) {
      const { error: deleteNextError } = await supabase
        .from("payment_schedules")
        .delete()
        .eq("id", nextOccurrence.id)
        .eq("user_id", user.id);
      if (deleteNextError) throw new Error(deleteNextError.message);
    }

    // 3. Riporta la scadenza a non saldata
    const { data, error: updateError } = await supabase
      .from("payment_schedules")
      .update({ is_paid: false })
      .eq("id", id)
      .eq("user_id", user.id)
      .select("*, expense_categories(name, color), suppliers(name)")
      .single();
    if (updateError) throw new Error(updateError.message);

    revalidatePath("/dashboard/overview");
    revalidatePath("/dashboard/expenses");
    revalidatePath("/dashboard/schedules");
    revalidatePath("/dashboard/budget");
    revalidatePath("/dashboard/calendar");
    return {
      success: true,
      data,
      deletedNextOccurrenceId: nextOccurrence && !nextOccurrence.is_paid ? nextOccurrence.id : null,
      deletedExpenseIds: (deletedExpenses || []).map((e: any) => e.id),
    };
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
      is_income: original.is_income,
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

    revalidatePath("/dashboard/overview");
    revalidatePath("/dashboard/expenses");
    revalidatePath("/dashboard/schedules");
    revalidatePath("/dashboard/budget");
    revalidatePath("/dashboard/calendar");
    return { success: true, data: [firstInstallment, ...(restInstallments || [])] };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

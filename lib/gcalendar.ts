/**
 * Helper per Integrazione Google Calendar API v3
 * Gestisce la creazione ed il popolamento di un Calendario Google Separato/Dedicato:
 * "Scadenze & Bollette - Gestionale"
 */

export const DEDICATED_CALENDAR_NAME = "Scadenze & Bollette - Gestionale";

/**
 * Cerca un calendario dedicato esistente oppure ne crea uno nuovo dedicato sul profilo Google dell'utente
 */
export async function getOrCreateDedicatedGoogleCalendar(accessToken: string): Promise<string> {
  if (!accessToken) {
    throw new Error("Token di accesso Google non presente.");
  }

  // 1. Cerca nei calendari dell'utente se ne esiste già uno chiamato "Scadenze & Bollette - Gestionale"
  const listRes = await fetch("https://www.googleapis.com/calendar/v3/users/me/calendarList", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (listRes.ok) {
    const listData = await listRes.json();
    const existingCal = listData.items?.find((item: any) => item.summary === DEDICATED_CALENDAR_NAME);
    if (existingCal) {
      return existingCal.id;
    }
  }

  // 2. Se non esiste, crea un nuovo calendario secondario dedicato
  const createRes = await fetch("https://www.googleapis.com/calendar/v3/calendars", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      summary: DEDICATED_CALENDAR_NAME,
      description: "Calendario dedicato generato in automatico dal Gestionale Spese & Pagamenti per il tracciamento bollette.",
      timeZone: "Europe/Rome",
    }),
  });

  if (!createRes.ok) {
    const errText = await createRes.text();
    throw new Error(`Impossibile creare il calendario dedicato su Google: ${errText}`);
  }

  const newCal = await createRes.json();
  return newCal.id;
}

/**
 * Inserisce o aggiorna un evento di scadenza sul Calendario Google Dedicato
 */
export async function syncScheduleToGoogleCalendar({
  schedule,
  accessToken,
  calendarId,
  eventId,
}: {
  schedule: {
    id: string;
    amount: number;
    description?: string | null;
    due_date: string;
    category?: string;
    supplier_name?: string;
    is_paid?: boolean;
  };
  accessToken: string;
  calendarId: string;
  eventId?: string | null;
}) {
  if (!accessToken || !calendarId) return null;

  const formattedAmount = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(schedule.amount);
  const statusPrefix = schedule.is_paid ? "✅ SALDATA: " : "💸 SCADENZA: ";
  const supplierInfo = schedule.supplier_name ? ` (${schedule.supplier_name})` : "";
  const title = `${statusPrefix}${schedule.description || schedule.category || "Pagamento"}${supplierInfo} - ${formattedAmount}`;

  // Data di inizio e fine dell'evento (giornata intera o ore diurne)
  const eventDate = schedule.due_date; // AAAA-MM-DD

  const eventPayload = {
    summary: title,
    description: `Pagamento programmato nel Gestionale Spese.\nImporto: ${formattedAmount}\nStato: ${schedule.is_paid ? "Saldata" : "Da Saldare"}`,
    start: {
      date: eventDate,
    },
    end: {
      date: eventDate,
    },
    reminders: {
      useDefault: false,
      overrides: [
        { method: "popup", minutes: 24 * 60 }, // Notifica 24 ore prima
        { method: "popup", minutes: 2 * 60 },  // Notifica 2 ore prima
      ],
    },
    colorId: schedule.is_paid ? "10" : "5", // Colore su Google Calendar (Verde se saldata, Giallo/Ambra se in scadenza)
  };

  // Se esiste già un evento collegato a questa scadenza lo aggiorna (PATCH),
  // altrimenti ne crea uno nuovo (POST), per evitare duplicati ad ogni sincronizzazione.
  const url = eventId
    ? `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`
    : `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`;

  const response = await fetch(url, {
    method: eventId ? "PATCH" : "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(eventPayload),
  });

  if (!response.ok) {
    const err = await response.text();
    console.warn("Errore sincronizzazione evento Google Calendar:", err);
    return null;
  }

  return await response.json();
}

/**
 * Inserisce o aggiorna sul Calendario Google Dedicato l'evento collegato a una spesa o
 * entrata gia' registrata (a differenza di una scadenza, qui il movimento e' gia' avvenuto).
 */
export async function syncExpenseToGoogleCalendar({
  expense,
  accessToken,
  calendarId,
  eventId,
}: {
  expense: {
    id: string;
    amount: number;
    description?: string | null;
    date: string;
    category?: string;
    supplier_name?: string;
    is_income?: boolean;
  };
  accessToken: string;
  calendarId: string;
  eventId?: string | null;
}) {
  if (!accessToken || !calendarId) return null;

  const formattedAmount = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(expense.amount);
  const statusPrefix = expense.is_income ? "💰 ENTRATA: " : "💶 SPESA: ";
  const supplierInfo = expense.supplier_name ? ` (${expense.supplier_name})` : "";
  const title = `${statusPrefix}${expense.description || expense.category || "Movimento"}${supplierInfo} - ${formattedAmount}`;

  const eventDate = expense.date; // AAAA-MM-DD

  const eventPayload = {
    summary: title,
    description: `Movimento registrato nel Gestionale Spese.\nImporto: ${formattedAmount}\nTipo: ${expense.is_income ? "Entrata" : "Spesa"}`,
    start: {
      date: eventDate,
    },
    end: {
      date: eventDate,
    },
    colorId: expense.is_income ? "10" : "11", // Verde per le entrate, Rosso/Pomodoro per le spese gia' effettuate
  };

  const url = eventId
    ? `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`
    : `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`;

  const response = await fetch(url, {
    method: eventId ? "PATCH" : "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(eventPayload),
  });

  if (!response.ok) {
    const err = await response.text();
    console.warn("Errore sincronizzazione evento Google Calendar (spesa):", err);
    return null;
  }

  return await response.json();
}

/**
 * Elimina un evento dal Calendario Google Dedicato (usato quando la scadenza o la spesa
 * collegata viene eliminata, o quando un saldo viene annullato).
 */
export async function deleteGoogleCalendarEvent({
  accessToken,
  calendarId,
  eventId,
}: {
  accessToken: string;
  calendarId: string;
  eventId: string;
}) {
  if (!accessToken || !calendarId || !eventId) return;

  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  // 404/410 = l'evento non esiste piu' (es. rimosso a mano su Google): va bene cosi'.
  if (!response.ok && response.status !== 404 && response.status !== 410) {
    const err = await response.text();
    console.warn("Errore eliminazione evento Google Calendar:", err);
  }
}

/** Converte una riga payment_schedules (con eventuali join) nell'input atteso dalla sync. */
export function scheduleRowToCalendarInput(row: any) {
  return {
    id: row.id,
    amount: row.amount,
    description: row.description,
    due_date: row.due_date,
    category: row.expense_categories?.name || row.category,
    supplier_name: row.suppliers?.name,
    is_paid: row.is_paid,
    google_event_id: row.google_event_id ?? null,
  };
}

/** Converte una riga expenses (con eventuali join) nell'input atteso dalla sync. */
export function expenseRowToCalendarInput(row: any) {
  return {
    id: row.id,
    amount: row.amount,
    description: row.description,
    date: row.date,
    category: row.expense_categories?.name || row.category,
    supplier_name: row.suppliers?.name,
    is_income: row.is_income,
    google_event_id: row.google_event_id ?? null,
  };
}

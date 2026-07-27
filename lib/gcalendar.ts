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

  const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(eventPayload),
  });

  if (!response.ok) {
    const err = await response.text();
    console.warn("Errore creazione evento Google Calendar:", err);
    return null;
  }

  return await response.json();
}

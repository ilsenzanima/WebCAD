"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import {
  uploadFileToGoogleDrive,
  refreshGoogleAccessToken,
  listFilesInFolder,
  getOrCreateSupplierYearFolderId,
  moveFileToFolder,
  GOOGLE_CONFIG,
} from "@/lib/gdrive";
import { getOrCreateDedicatedGoogleCalendar, syncScheduleToGoogleCalendar } from "@/lib/gcalendar";
import { createDocumentWithFinancials } from "@/app/actions/documents";

const EXPIRY_SAFETY_BUFFER_MS = 60 * 1000;

/**
 * Restituisce un access token Google valido per l'utente corrente,
 * rinnovandolo tramite il refresh token se scaduto.
 */
async function getValidAccessToken(supabase: any, userId: string): Promise<string> {
  const { data: tokenRow, error } = await supabase
    .from("user_google_tokens")
    .select("access_token, refresh_token, expires_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!tokenRow) {
    throw new Error("Account Google non collegato. Collega il tuo account Google prima di continuare.");
  }

  const expiresAt = new Date(tokenRow.expires_at).getTime();
  if (expiresAt - EXPIRY_SAFETY_BUFFER_MS > Date.now()) {
    return tokenRow.access_token;
  }

  if (!tokenRow.refresh_token) {
    throw new Error("Sessione Google scaduta. Ricollega il tuo account Google.");
  }

  const refreshed = await refreshGoogleAccessToken(tokenRow.refresh_token);
  const newExpiresAt = new Date(Date.now() + refreshed.expiresIn * 1000).toISOString();

  const { error: updateError } = await supabase
    .from("user_google_tokens")
    .update({ access_token: refreshed.accessToken, expires_at: newExpiresAt, updated_at: new Date().toISOString() })
    .eq("user_id", userId);

  if (updateError) throw new Error(updateError.message);

  return refreshed.accessToken;
}

export async function getGoogleConnectionStatus() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { connected: false };

  const { data } = await supabase
    .from("user_google_tokens")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  return { connected: !!data };
}

export async function disconnectGoogleDrive() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Non autenticato");

    const { error } = await supabase.from("user_google_tokens").delete().eq("user_id", user.id);
    if (error) throw new Error(error.message);

    revalidatePath("/dashboard/suppliers");
    revalidatePath("/dashboard/expenses");
    revalidatePath("/dashboard/settings");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Errore durante lo scollegamento" };
  }
}

export async function uploadSupplierDocumentToDrive(formData: FormData) {
  try {
    const supabase = (await createClient()) as any;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Non autenticato");

    const file = formData.get("file") as File | null;
    const fileName = formData.get("fileName") as string | null;
    if (!file || !fileName) throw new Error("File mancante");

    const supplierName = formData.get("supplierName") as string | null;
    const yearRaw = formData.get("year") as string | null;

    const accessToken = await getValidAccessToken(supabase, user.id);

    // Se conosciamo il fornitore, archiviamo il file nella sua cartella
    // organizzata per anno (<radice>/<Fornitore>/<Anno>) invece che alla rinfusa.
    const folderId = supplierName
      ? await getOrCreateSupplierYearFolderId({
          supplierName,
          year: yearRaw ? Number(yearRaw) : new Date().getFullYear(),
          accessToken,
        })
      : GOOGLE_CONFIG.rootFolderId;

    const result = await uploadFileToGoogleDrive({
      file,
      fileName,
      accessToken,
      folderId,
    });

    return { success: true, data: result };
  } catch (err: any) {
    return { success: false, error: err.message || "Errore durante il caricamento su Google Drive" };
  }
}

/**
 * Elenca i documenti ancora da smistare nella cartella "Scansioni" (inbox),
 * per la pagina di triage /dashboard/scansioni.
 */
export async function listScansioniDocuments() {
  try {
    const supabase = (await createClient()) as any;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Non autenticato");

    const accessToken = await getValidAccessToken(supabase, user.id);
    const files = await listFilesInFolder({ folderId: GOOGLE_CONFIG.scansioniFolderId, accessToken });

    const data = files.map((f) => ({
      id: f.id,
      name: f.name,
      mimeType: f.mimeType,
      size: f.size ? Number(f.size) : null,
      createdTime: f.createdTime || null,
      previewUrl: `https://drive.google.com/file/d/${f.id}/preview`,
      webViewLink: f.webViewLink || `https://drive.google.com/file/d/${f.id}/view`,
    }));

    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message || "Errore durante il recupero dei documenti da smistare", data: [] };
  }
}

/**
 * Assegna un documento scansionato (nella cartella "Scansioni") a un fornitore:
 * sposta il file nella cartella <radice>/<Fornitore>/<Anno> su Drive e crea il
 * record collegato in supplier_documents. Il file esce dalla cartella Scansioni.
 */
export async function assignScansioneDocument({
  fileId,
  fileSize,
  supplierId,
  supplierName,
  year,
  title,
  docType,
  amount,
  categoryId,
  categoryName,
  consumptionValue,
  periodStart,
  periodEnd,
  isPaid,
  date,
}: {
  fileId: string;
  fileSize?: number | null;
  supplierId: string;
  supplierName: string;
  year: number;
  title: string;
  docType: "contratto" | "bolletta" | "altro";
  amount?: number | null;
  categoryId?: string | null;
  categoryName?: string;
  consumptionValue?: number | null;
  periodStart?: string | null;
  periodEnd?: string | null;
  isPaid?: boolean;
  date?: string | null;
}) {
  try {
    const supabase = (await createClient()) as any;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Non autenticato");

    if (!supplierId || !supplierName) throw new Error("Seleziona il fornitore a cui assegnare il documento");
    if (!year || year < 1900) throw new Error("Anno non valido");

    const accessToken = await getValidAccessToken(supabase, user.id);

    const targetFolderId = await getOrCreateSupplierYearFolderId({ supplierName, year, accessToken });

    const moved = await moveFileToFolder({
      fileId,
      newParentId: targetFolderId,
      oldParentId: GOOGLE_CONFIG.scansioniFolderId,
      accessToken,
    });

    const fileUrl = moved.webViewLink || moved.webContentLink || `https://drive.google.com/file/d/${fileId}/view`;

    const docRes = await createDocumentWithFinancials({
      supplier_id: supplierId,
      title,
      file_url: fileUrl,
      gdrive_file_id: fileId,
      file_size: fileSize ?? null,
      doc_type: docType,
      document_year: year,
      amount,
      category_id: categoryId,
      category_name: categoryName,
      consumption_value: consumptionValue,
      period_start: periodStart,
      period_end: periodEnd,
      is_paid: isPaid,
      date,
    });

    if (!docRes.success) throw new Error(docRes.error || "Errore durante la creazione del documento");

    revalidatePath("/dashboard/scansioni");
    revalidatePath(`/dashboard/suppliers/${supplierId}`);

    return { success: true, data: docRes.data };
  } catch (err: any) {
    return { success: false, error: err.message || "Errore durante l'assegnazione del documento" };
  }
}

export async function syncSchedulesToCalendar(schedules: {
  id: string;
  amount: number;
  description?: string | null;
  due_date: string;
  category?: string;
  supplier_name?: string;
  is_paid?: boolean;
  google_event_id?: string | null;
}[]) {
  try {
    const supabase = (await createClient()) as any;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Non autenticato");

    const accessToken = await getValidAccessToken(supabase, user.id);
    const calendarId = await getOrCreateDedicatedGoogleCalendar(accessToken);

    const updates: { id: string; google_event_id: string }[] = [];

    for (const schedule of schedules) {
      const event = await syncScheduleToGoogleCalendar({
        schedule,
        accessToken,
        calendarId,
        eventId: schedule.google_event_id,
      });

      if (event?.id && event.id !== schedule.google_event_id) {
        await supabase
          .from("payment_schedules")
          .update({ google_event_id: event.id })
          .eq("id", schedule.id)
          .eq("user_id", user.id);
        updates.push({ id: schedule.id, google_event_id: event.id });
      }
    }

    revalidatePath("/dashboard/schedules");
    return { success: true, synced: schedules.length, updates };
  } catch (err: any) {
    return { success: false, error: err.message || "Errore durante la sincronizzazione con Google Calendar" };
  }
}

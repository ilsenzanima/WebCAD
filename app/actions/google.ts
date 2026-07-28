"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { uploadFileToGoogleDrive, refreshGoogleAccessToken, GOOGLE_CONFIG } from "@/lib/gdrive";

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
    throw new Error("Google Drive non collegato. Collega il tuo account Google prima di caricare un file.");
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
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Non autenticato");

  await supabase.from("user_google_tokens").delete().eq("user_id", user.id);
  revalidatePath("/dashboard/suppliers");
  return { success: true };
}

export async function uploadSupplierDocumentToDrive(formData: FormData) {
  try {
    const supabase = (await createClient()) as any;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Non autenticato");

    const file = formData.get("file") as File | null;
    const fileName = formData.get("fileName") as string | null;
    if (!file || !fileName) throw new Error("File mancante");

    const accessToken = await getValidAccessToken(supabase, user.id);

    const result = await uploadFileToGoogleDrive({
      file,
      fileName,
      accessToken,
      folderId: GOOGLE_CONFIG.rootFolderId,
    });

    return { success: true, data: result };
  } catch (err: any) {
    return { success: false, error: err.message || "Errore durante il caricamento su Google Drive" };
  }
}

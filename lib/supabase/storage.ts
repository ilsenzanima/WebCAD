import { createClient } from "./client";

/**
 * Converte una stringa Base64 (DataURL) in un Blob.
 */
export function base64ToBlob(base64: string): { blob: Blob; mimeType: string } {
  const parts = base64.split(";base64,");
  if (parts.length < 2) {
    throw new Error("Formato Base64 non valido. Manca ';base64,'");
  }
  const mimeType = parts[0].split(":")[1];
  const byteCharacters = atob(parts[1]);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], { type: mimeType });
  return { blob, mimeType };
}

/**
 * Carica un file codificato in Base64 (DataURL) nel bucket Supabase "plans" e restituisce l'URL pubblico.
 */
export async function uploadBase64ToStorage(
  base64Data: string,
  prefix: string = "file"
): Promise<string> {
  const { blob, mimeType } = base64ToBlob(base64Data);

  // Determina l'estensione del file in base al mimeType
  let ext = "bin";
  if (mimeType.includes("png")) ext = "png";
  else if (mimeType.includes("jpeg") || mimeType.includes("jpg")) ext = "jpg";
  else if (mimeType.includes("pdf")) ext = "pdf";
  else if (mimeType.includes("glb") || mimeType.includes("model")) ext = "glb";
  else if (mimeType.includes("gltf")) ext = "gltf";

  const fileName = `${prefix}_${crypto.randomUUID()}.${ext}`;
  const supabase = createClient();

  const { data, error } = await supabase.storage
    .from("plans")
    .upload(fileName, blob, {
      contentType: mimeType,
      cacheControl: "2592000", // 30 giorni di cache
      upsert: true,
    });

  if (error) {
    throw new Error(`Errore durante l'upload del file a Supabase Storage: ${error.message}`);
  }

  const { data: { publicUrl } } = supabase.storage
    .from("plans")
    .getPublicUrl(data.path);

  return publicUrl;
}

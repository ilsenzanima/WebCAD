/**
 * Helper per Integrazione Google Drive, Google Calendar e Google Tasks API
 * Cartella Radice Google Drive: 1fgA-JTpfzPRIlJ8xJeQ95Grxi6hVUnB9
 */

export const GOOGLE_CONFIG = {
  clientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "",
  clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
  rootFolderId: process.env.NEXT_PUBLIC_GOOGLE_DRIVE_ROOT_FOLDER_ID || "1fgA-JTpfzPRIlJ8xJeQ95Grxi6hVUnB9",
  scopes: {
    drive: "https://www.googleapis.com/auth/drive.file",
    calendar: "https://www.googleapis.com/auth/calendar.events",
    tasks: "https://www.googleapis.com/auth/tasks",
  },
};

/**
 * Carica un file direttamente nella cartella radice di Google Drive dell'utente
 */
export async function uploadFileToGoogleDrive({
  file,
  fileName,
  accessToken,
  folderId = GOOGLE_CONFIG.rootFolderId,
}: {
  file: File | Blob;
  fileName: string;
  accessToken?: string;
  folderId?: string;
}) {
  if (!accessToken) {
    throw new Error("Token di accesso Google non fornito. Effettua l'accesso con Google.");
  }

  const metadata = {
    name: fileName,
    parents: [folderId],
  };

  const formData = new FormData();
  formData.append(
    "metadata",
    new Blob([JSON.stringify(metadata)], { type: "application/json" })
  );
  formData.append("file", file);

  const response = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,webContentLink",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: formData,
    }
  );

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Errore durante il caricamento su Google Drive: ${errText}`);
  }

  const result = await response.json();
  return {
    id: result.id,
    name: result.name,
    webViewLink: result.webViewLink as string,
    webContentLink: result.webContentLink as string,
  };
}

/**
 * Utility per aprire la cartella radice su Google Drive
 */
export function getGoogleDriveFolderUrl(folderId?: string) {
  const targetId = folderId || GOOGLE_CONFIG.rootFolderId;
  return `https://drive.google.com/drive/folders/${targetId}`;
}

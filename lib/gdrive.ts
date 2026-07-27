/**
 * Configurazione ed Utility per Integrazione Google Drive API
 * Cartella Radice: 1fgA-JTpfzPRIlJ8xJeQ95Grxi6hVUnB9
 */

export const GOOGLE_DRIVE_CONFIG = {
  clientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "",
  clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
  rootFolderId: process.env.NEXT_PUBLIC_GOOGLE_DRIVE_ROOT_FOLDER_ID || "1fgA-JTpfzPRIlJ8xJeQ95Grxi6hVUnB9",
  scopes: ["https://www.googleapis.com/auth/drive.file"],
};

/**
 * Utility per generare il link di visualizzazione della cartella radice su Google Drive
 */
export function getGoogleDriveFolderUrl(folderId?: string) {
  const targetId = folderId || GOOGLE_DRIVE_CONFIG.rootFolderId;
  return `https://drive.google.com/drive/folders/${targetId}`;
}

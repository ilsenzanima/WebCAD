/**
 * Helper per Integrazione Google Drive, Google Calendar e Google Tasks API
 * Cartella Radice Google Drive: 1fgA-JTpfzPRIlJ8xJeQ95Grxi6hVUnB9
 */

export const GOOGLE_CONFIG = {
  clientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "",
  clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
  rootFolderId: process.env.NEXT_PUBLIC_GOOGLE_DRIVE_ROOT_FOLDER_ID || "1fgA-JTpfzPRIlJ8xJeQ95Grxi6hVUnB9",
  // Cartella "inbox" dove arrivano i documenti scansionati da smistare manualmente
  // tra i fornitori (pagina /dashboard/scansioni).
  scansioniFolderId: process.env.NEXT_PUBLIC_GOOGLE_DRIVE_SCANSIONI_FOLDER_ID || "1IMJ-WTnVAJquaMA-A-QRvFjU0N64HA10",
  scopes: {
    // Serve lo scope "drive" completo (non il piu' ristretto "drive.file")
    // perche' la pagina di smistamento deve leggere ed eventualmente spostare
    // file che l'utente ha aggiunto direttamente su Drive (cartella
    // "Scansioni"), non solo quelli creati dall'app stessa.
    drive: "https://www.googleapis.com/auth/drive",
    calendar: "https://www.googleapis.com/auth/calendar.events",
    tasks: "https://www.googleapis.com/auth/tasks",
  },
};

const DRIVE_FOLDER_MIME_TYPE = "application/vnd.google-apps.folder";

/** Effettua l'escape di un valore testuale da inserire in una query Drive `q=`. */
function escapeDriveQueryValue(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

async function driveFetch(url: string, accessToken: string, init?: RequestInit) {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init?.headers || {}),
    },
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Errore nella chiamata a Google Drive: ${errText}`);
  }

  return response.json();
}

/**
 * Elenca i file (non le cartelle) contenuti direttamente in una cartella Drive.
 */
export async function listFilesInFolder({
  folderId,
  accessToken,
}: {
  folderId: string;
  accessToken: string;
}) {
  const query = `'${escapeDriveQueryValue(folderId)}' in parents and trashed = false and mimeType != '${DRIVE_FOLDER_MIME_TYPE}'`;
  const fields = "files(id,name,mimeType,size,createdTime,webViewLink,webContentLink,thumbnailLink)";
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=${encodeURIComponent(fields)}&pageSize=200&orderBy=createdTime`;

  const result = await driveFetch(url, accessToken);
  return (result.files || []) as {
    id: string;
    name: string;
    mimeType: string;
    size?: string;
    createdTime?: string;
    webViewLink?: string;
    webContentLink?: string;
    thumbnailLink?: string;
  }[];
}

/**
 * Trova una sottocartella per nome dentro `parentId`; se non esiste la crea.
 * Restituisce l'id della cartella trovata/creata.
 */
export async function findOrCreateFolder({
  name,
  parentId,
  accessToken,
}: {
  name: string;
  parentId: string;
  accessToken: string;
}): Promise<string> {
  const query = `mimeType = '${DRIVE_FOLDER_MIME_TYPE}' and name = '${escapeDriveQueryValue(name)}' and '${escapeDriveQueryValue(parentId)}' in parents and trashed = false`;
  const listUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=${encodeURIComponent("files(id,name)")}`;

  const existing = await driveFetch(listUrl, accessToken);
  if (existing.files && existing.files.length > 0) {
    return existing.files[0].id as string;
  }

  const created = await driveFetch(
    "https://www.googleapis.com/drive/v3/files?fields=id",
    accessToken,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        mimeType: DRIVE_FOLDER_MIME_TYPE,
        parents: [parentId],
      }),
    }
  );

  return created.id as string;
}

/**
 * Trova (creandola se serve) la cartella dell'archivio organizzato per un
 * fornitore/anno: <rootFolderId>/<NomeFornitore>/<Anno>.
 */
export async function getOrCreateSupplierYearFolderId({
  supplierName,
  year,
  accessToken,
  rootFolderId = GOOGLE_CONFIG.rootFolderId,
}: {
  supplierName: string;
  year: number;
  accessToken: string;
  rootFolderId?: string;
}): Promise<string> {
  const supplierFolderId = await findOrCreateFolder({
    name: supplierName,
    parentId: rootFolderId,
    accessToken,
  });

  return findOrCreateFolder({
    name: String(year),
    parentId: supplierFolderId,
    accessToken,
  });
}

/**
 * Sposta un file esistente da una cartella all'altra (rimuove il vecchio
 * parent e aggiunge il nuovo).
 */
export async function moveFileToFolder({
  fileId,
  newParentId,
  oldParentId,
  accessToken,
}: {
  fileId: string;
  newParentId: string;
  oldParentId: string;
  accessToken: string;
}) {
  const fields = "id,name,webViewLink,webContentLink";
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}?addParents=${encodeURIComponent(newParentId)}&removeParents=${encodeURIComponent(oldParentId)}&fields=${encodeURIComponent(fields)}`;

  const result = await driveFetch(url, accessToken, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });

  return result as { id: string; name: string; webViewLink?: string; webContentLink?: string };
}

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
 * Trova (creandola se serve) una sottocartella dedicata di un progetto:
 * <rootFolderId>/Progetti/<NomeProgetto>/<sottocartella>.
 */
export async function getOrCreateProjectSubfolderId({
  projectName,
  subfolderName,
  accessToken,
  rootFolderId = GOOGLE_CONFIG.rootFolderId,
}: {
  projectName: string;
  subfolderName: string;
  accessToken: string;
  rootFolderId?: string;
}): Promise<string> {
  const projectsFolderId = await findOrCreateFolder({ name: "Progetti", parentId: rootFolderId, accessToken });
  const projectFolderId = await findOrCreateFolder({ name: projectName, parentId: projectsFolderId, accessToken });
  return findOrCreateFolder({ name: subfolderName, parentId: projectFolderId, accessToken });
}

/** <rootFolderId>/Progetti/<NomeProgetto>/Disegni. */
export async function getOrCreateProjectSketchFolderId(args: {
  projectName: string;
  accessToken: string;
  rootFolderId?: string;
}): Promise<string> {
  return getOrCreateProjectSubfolderId({ ...args, subfolderName: "Disegni" });
}

/** <rootFolderId>/Progetti/<NomeProgetto>/Modelli 3D. */
export async function getOrCreateProjectModelFolderId(args: {
  projectName: string;
  accessToken: string;
  rootFolderId?: string;
}): Promise<string> {
  return getOrCreateProjectSubfolderId({ ...args, subfolderName: "Modelli 3D" });
}

/**
 * Sovrascrive il contenuto di un file Drive gia' esistente (stesso id),
 * cosi' un disegno risalvato aggiorna sempre lo stesso file invece di
 * accumulare copie ad ogni backup.
 */
export async function updateFileContent({
  fileId,
  file,
  accessToken,
}: {
  fileId: string;
  file: File | Blob;
  accessToken: string;
}) {
  const response = await fetch(
    `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media&fields=id,name,webViewLink,webContentLink`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": file.type || "application/octet-stream",
      },
      body: file,
    }
  );

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Errore durante l'aggiornamento del file su Google Drive: ${errText}`);
  }

  const result = await response.json();
  return {
    id: result.id,
    name: result.name,
    webViewLink: result.webViewLink as string | undefined,
    webContentLink: result.webContentLink as string | undefined,
  };
}

/**
 * Utility per aprire la cartella radice su Google Drive
 */
export function getGoogleDriveFolderUrl(folderId?: string) {
  const targetId = folderId || GOOGLE_CONFIG.rootFolderId;
  return `https://drive.google.com/drive/folders/${targetId}`;
}

/**
 * Scambia un refresh token Google con un nuovo access token.
 * Usare solo lato server: richiede il client secret.
 */
export async function refreshGoogleAccessToken(refreshToken: string) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GOOGLE_CONFIG.clientId,
      client_secret: GOOGLE_CONFIG.clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Impossibile rinnovare il token Google: ${errText}`);
  }

  const result = await response.json();
  return {
    accessToken: result.access_token as string,
    expiresIn: (result.expires_in as number) ?? 3600,
  };
}

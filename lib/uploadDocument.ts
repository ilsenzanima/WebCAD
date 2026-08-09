import { uploadSupplierDocumentToDrive } from "@/app/actions/google";
import { createSupplierDocument } from "@/app/actions/documents";
import type { Supplier, SupplierDocument } from "@/lib/types/database";

/**
 * Carica un file su Google Drive (nella cartella Fornitore/Anno se il
 * fornitore e' noto) e crea il record collegato in supplier_documents.
 * Condiviso tra ExpensesClient, SchedulesClient e CalendarClient cosi' il
 * comportamento (naming, cartella, campi salvati) resta identico ovunque
 * si possa allegare un documento a una spesa.
 */
export async function uploadAndLinkDocument({
  file,
  expenseId,
  supplierId,
  suppliersList,
  title,
  docType,
  googleConnected,
}: {
  file: File;
  expenseId: string;
  supplierId: string | null;
  suppliersList: Supplier[];
  title: string;
  docType: "contratto" | "bolletta" | "altro";
  googleConnected: boolean;
}): Promise<SupplierDocument | null> {
  if (!googleConnected) {
    alert("Per allegare documenti devi prima collegare il tuo account Google Drive.");
    return null;
  }

  try {
    const supplierForDoc = supplierId ? suppliersList.find((s) => s.id === supplierId) : null;
    const currentYear = new Date().getFullYear();

    const uploadFormData = new FormData();
    uploadFormData.append("file", file);
    uploadFormData.append("fileName", `${title}_${file.name}`);
    if (supplierForDoc) {
      uploadFormData.append("supplierName", supplierForDoc.name);
      uploadFormData.append("year", String(currentYear));
    }

    const driveRes = await uploadSupplierDocumentToDrive(uploadFormData);
    if (!driveRes.success || !driveRes.data) {
      alert(driveRes.error || "Il caricamento dell'allegato su Google Drive è fallito.");
      return null;
    }

    const fileUrl = driveRes.data.webViewLink || driveRes.data.webContentLink || `https://drive.google.com/file/d/${driveRes.data.id}/view`;

    const res = await createSupplierDocument({
      expense_id: expenseId,
      supplier_id: supplierId,
      title,
      file_url: fileUrl,
      provider: "gdrive",
      file_size: file.size,
      doc_type: docType,
      gdrive_file_id: driveRes.data.id,
      document_year: supplierForDoc ? currentYear : null,
    });

    if (!res.success || !res.data) {
      alert(res.error || "Il salvataggio dell'allegato è fallito.");
      return null;
    }

    return res.data;
  } catch (err: any) {
    alert(err.message || "Errore durante il caricamento dell'allegato");
    return null;
  }
}

/** Vero se il fornitore e' un'utenza a cui manca il consumo del periodo e/o un documento allegato. */
export function utilityMissingTags(
  supplier: Supplier | null | undefined,
  consumptionValue: number | null | undefined,
  attachmentsCount: number
): { missingConsumption: boolean; missingDocument: boolean } {
  const isUtility = !!supplier?.is_utility;
  return {
    missingConsumption: isUtility && (consumptionValue == null),
    missingDocument: isUtility && attachmentsCount === 0,
  };
}

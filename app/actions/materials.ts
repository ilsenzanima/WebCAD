"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type MaterialFormState =
  | {
      errors?: Record<string, string[]>;
      message?: string;
      success?: boolean;
    }
  | undefined;

const MaterialSchema = z.object({
  name: z.string().min(2, "Il nome deve avere almeno 2 caratteri.").trim(),
  description: z.string().optional().nullable(),
  category: z.string().min(1, "La categoria è obbligatoria."),
  length_mm: z.coerce.number().optional().nullable(),
  width_mm: z.coerce.number().optional().nullable(),
  thickness_mm: z.coerce.number().optional().nullable(),
  unit: z.string().min(1, "L'unità di misura è obbligatoria."),
  supplier: z.string().optional().nullable(),
  grain_direction: z.string().optional().nullable(),
});

export async function createMaterial(
  formData: FormData
): Promise<MaterialFormState> {
  console.log("🟡 [createMaterial] START - formData entries:", Object.fromEntries(formData.entries()));

  let success = false;

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    console.log("🟡 [createMaterial] user:", user?.id ?? "NOT AUTHENTICATED");

    if (!user) {
      return { message: "Utente non autenticato." };
    }

    // Normalizza i campi stringa opzionali o mancanti: null o vuoti -> undefined
    const cleanStr = (v: FormDataEntryValue | null) => {
      if (v === null || v === "") return undefined;
      return String(v).trim();
    };

    // Normalizza i campi numerici: stringa vuota → null, supporta la virgola
    const toNum = (v: FormDataEntryValue | null) => {
      if (v === null || v === "") return undefined;
      const cleanStrVal = String(v).replace(",", ".");
      const n = Number(cleanStrVal);
      return isNaN(n) ? undefined : n;
    };

    const rawData = {
      name: cleanStr(formData.get("name")),
      description: cleanStr(formData.get("description")),
      category: cleanStr(formData.get("category")),
      length_mm: toNum(formData.get("length_mm")),
      width_mm: toNum(formData.get("width_mm")),
      thickness_mm: toNum(formData.get("thickness_mm")),
      unit: cleanStr(formData.get("unit")),
      supplier: cleanStr(formData.get("supplier")),
      grain_direction: cleanStr(formData.get("grain_direction")),
    };

    console.log("🟡 [createMaterial] rawData:", rawData);

    const parsed = MaterialSchema.safeParse(rawData);

    if (!parsed.success) {
      console.error("🔴 [createMaterial] Zod validation failed:", parsed.error.flatten().fieldErrors);
      const errors = parsed.error.flatten().fieldErrors;
      const firstError = Object.values(errors).flat()[0] || "Dati inseriti non validi.";
      return {
        errors,
        message: `Verifica i campi inseriti: ${firstError}`
      };
    }

    console.log("🟢 [createMaterial] Zod OK - inserting into Supabase...");

    const { data: insertedData, error } = await supabase.from("materials").insert({
      user_id: user.id,
      name: parsed.data.name,
      description: parsed.data.description || null,
      category: parsed.data.category,
      length_mm: parsed.data.length_mm ?? null,
      width_mm: parsed.data.width_mm ?? null,
      thickness_mm: parsed.data.thickness_mm ?? null,
      unit: parsed.data.unit,
      supplier: parsed.data.supplier || null,
      grain_direction: parsed.data.grain_direction || "libero",
      stock_qty: 0,
      is_active: true,
    } as any).select();

    if (error) {
      console.error("🔴 [createMaterial] Supabase error:", error);
      return { message: `Errore durante il salvataggio: ${error.message}` };
    }

    console.log("🟢 [createMaterial] Insert OK:", insertedData);
    success = true;
  } catch (err: any) {
    console.error("🔴 [createMaterial] Unexpected error:", err);
    return { message: `Errore imprevisto: ${err.message || err}` };
  }

  if (success) {
    revalidatePath("/catalog");
    return { success: true };
  }
}

export async function getMaterials() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("materials")
    .select("id, name, sku, unit_cost, unit")
    .order("name");
  return data || [];
}

export async function deleteMaterial(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("materials").delete().eq("id", id);
  if (error) {
    console.error("Errore cancellazione materiale:", error);
    throw new Error("Impossibile eliminare il materiale.");
  }
  revalidatePath("/catalog");
}

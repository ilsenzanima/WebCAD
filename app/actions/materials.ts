"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type MaterialFormState =
  | {
      errors?: Record<string, string[]>;
      message?: string;
    }
  | undefined;

const MaterialSchema = z.object({
  name: z.string().min(2, "Il nome deve avere almeno 2 caratteri.").trim(),
  description: z.string().optional(),
  category: z.string().min(1, "La categoria è obbligatoria."),
  length_mm: z.coerce.number().optional().nullable(),
  width_mm: z.coerce.number().optional().nullable(),
  thickness_mm: z.coerce.number().optional().nullable(),
  unit_cost: z.coerce.number().optional().nullable(),
  unit: z.string().min(1, "L'unità di misura è obbligatoria."),
  supplier: z.string().optional(),
  sku: z.string().optional(),
});

export async function createMaterial(
  prevState: MaterialFormState,
  formData: FormData
): Promise<MaterialFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { message: "Utente non autenticato." };
  }

  const rawData = {
    name: formData.get("name"),
    description: formData.get("description"),
    category: formData.get("category"),
    length_mm: formData.get("length_mm"),
    width_mm: formData.get("width_mm"),
    thickness_mm: formData.get("thickness_mm"),
    unit_cost: formData.get("unit_cost"),
    unit: formData.get("unit"),
    supplier: formData.get("supplier"),
    sku: formData.get("sku"),
  };

  const parsed = MaterialSchema.safeParse(rawData);

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const { error } = await supabase.from("materials").insert({
    user_id: user.id,
    name: parsed.data.name,
    description: parsed.data.description || null,
    category: parsed.data.category,
    length_mm: parsed.data.length_mm || null,
    width_mm: parsed.data.width_mm || null,
    thickness_mm: parsed.data.thickness_mm || null,
    unit_cost: parsed.data.unit_cost || null,
    unit: parsed.data.unit,
    supplier: parsed.data.supplier || null,
    sku: parsed.data.sku || null,
    stock_qty: 0,
    is_active: true,
  });

  if (error) {
    console.error("Errore inserimento materiale:", error);
    return { message: "Errore durante il salvataggio del materiale." };
  }

  revalidatePath("/dashboard/catalog");
  redirect("/dashboard/catalog");
}

export async function deleteMaterial(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("materials").delete().eq("id", id);
  if (error) {
    console.error("Errore cancellazione materiale:", error);
    throw new Error("Impossibile eliminare il materiale.");
  }
  revalidatePath("/dashboard/catalog");
}

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/types/database";

type MaterialsInsertClient = {
  from: (table: "materials") => {
    insert: (
      values: Database["public"]["Tables"]["materials"]["Insert"]
    ) => {
      select: (
        columns: "id"
      ) => {
        single: () => Promise<{ data: { id: string } | null; error: { message: string } | null }>;
      };
    };
  };
};

export type MaterialFormState =
  | {
      errors?: Record<string, string[]>;
      message?: string;
    }
  | undefined;

const optionalNumberField = z.preprocess(
  (value) => (value === "" || value === null || value === undefined ? null : value),
  z.coerce.number().optional().nullable()
);

const MaterialSchema = z.object({
  name: z.string().min(2, "Il nome deve avere almeno 2 caratteri.").trim(),
  description: z.string().optional(),
  category: z.string().min(1, "La categoria è obbligatoria."),
  length_mm: optionalNumberField,
  width_mm: optionalNumberField,
  thickness_mm: optionalNumberField,
  unit_cost: optionalNumberField,
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

  const materialToInsert: Database["public"]["Tables"]["materials"]["Insert"] = {
    user_id: user.id,
    name: parsed.data.name,
    description: parsed.data.description || null,
    category: parsed.data.category,
    length_mm: parsed.data.length_mm ?? null,
    width_mm: parsed.data.width_mm ?? null,
    thickness_mm: parsed.data.thickness_mm ?? null,
    unit_cost: parsed.data.unit_cost ?? null,
    unit: parsed.data.unit,
    supplier: parsed.data.supplier || null,
    sku: parsed.data.sku || null,
    stock_qty: 0,
    is_active: true,
  };

  const materialsInsertClient = supabase as unknown as MaterialsInsertClient;
  const { data: insertedMaterial, error } = await materialsInsertClient
    .from("materials")
    .insert(materialToInsert)
    .select("id")
    .single();

  if (error || !insertedMaterial) {
    console.error("Errore inserimento materiale:", error);
    return {
      message: `Errore durante il salvataggio: ${error?.message ?? "materiale non creato"}`,
    };
  }

  revalidatePath("/catalog");
  redirect(`/catalog?saved=1&id=${insertedMaterial.id}`);
}

export async function getMaterials() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  const { data } = await supabase
    .from("materials")
    .select("id, name, sku, unit_cost, unit")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .order("name");
  return data || [];
}

export async function deleteMaterial(id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Utente non autenticato.");
  }

  const { error } = await supabase
    .from("materials")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) {
    console.error("Errore cancellazione materiale:", error);
    throw new Error("Impossibile eliminare il materiale.");
  }
  revalidatePath("/catalog");
}

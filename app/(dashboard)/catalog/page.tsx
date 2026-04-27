import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { deleteMaterial } from "@/app/actions/materials";
import type { Database } from "@/lib/types/database";
import SaveToast from "@/app/ui/dashboard/SaveToast";

type CatalogPageProps = {
  searchParams?: Promise<{
    saved?: string;
  }>;
};

export default async function CatalogPage({ searchParams }: CatalogPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const showSavedToast = resolvedSearchParams.saved === "1";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="p-8">
        <p className="text-sm" style={{ color: "hsl(0 84% 75%)" }}>
          Devi essere autenticato per visualizzare il catalogo materiali.
        </p>
      </div>
    );
  }

  const { data, error } = await supabase
    .from("materials")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  // Add cast to help TypeScript since Supabase TS generation isn't strictly mapping here
  const materials = data as Database["public"]["Tables"]["materials"]["Row"][] | null;

  return (
    <div className="p-8 space-y-8 animate-fade-in">
      {showSavedToast && <SaveToast message="Materiale salvato con successo" />}
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Catalogo Materiali</h1>
          <p className="mt-1 text-sm" style={{ color: "hsl(215 20% 55%)" }}>
            Gestisci materiali per il nesting (profili, lastre, ecc.)
          </p>
        </div>
        <Link
          href="/catalog/new"
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all duration-200"
          style={{
            background: "linear-gradient(135deg, hsl(16 100% 58%), hsl(0 84% 50%))",
            boxShadow: "0 4px 16px hsl(16 100% 58% / 0.3)",
          }}
        >
          <span className="text-base">+</span> Nuovo Materiale
        </Link>
      </div>

      {/* List */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          background: "hsl(220 26% 14%)",
          border: "1px solid hsl(220 20% 20%)",
        }}
      >
        {error ? (
          <div className="flex flex-col items-center justify-center py-16">
            <h3 className="text-white font-medium mb-2">Errore caricamento materiali</h3>
            <p className="text-sm text-center max-w-xs" style={{ color: "hsl(215 15% 50%)" }}>
              {error.message}
            </p>
          </div>
        ) : (!materials || materials.length === 0) ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="text-5xl mb-4">📦</div>
            <h3 className="text-white font-medium mb-2">Nessun materiale</h3>
            <p className="text-sm text-center max-w-xs" style={{ color: "hsl(215 15% 50%)" }}>
              Aggiungi il tuo primo materiale per utilizzarlo nei fogli di taglio.
            </p>
          </div>
        ) : (
          <table className="w-full text-sm text-left">
            <thead
              className="text-xs uppercase"
              style={{
                background: "hsl(220 32% 10%)",
                color: "hsl(215 15% 50%)",
                borderBottom: "1px solid hsl(220 20% 20%)",
              }}
            >
              <tr>
                <th className="px-6 py-4 font-medium">Nome & SKU</th>
                <th className="px-6 py-4 font-medium">Categoria</th>
                <th className="px-6 py-4 font-medium">Dimensioni (mm)</th>
                <th className="px-6 py-4 font-medium">Costo / U.M.</th>
                <th className="px-6 py-4 font-medium text-right">Azioni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[hsl(220_20%_20%)]">
              {materials.map((mat) => (
                <tr key={mat.id} className="transition-colors hover:bg-[hsl(220_20%_18%)]">
                  <td className="px-6 py-4">
                    <div className="font-medium text-white">{mat.name}</div>
                    <div className="text-xs" style={{ color: "hsl(215 15% 50%)" }}>{mat.sku || "N/A"}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className="px-2 py-1 text-xs rounded-lg"
                      style={{ background: "hsl(220 20% 22%)", color: "hsl(215 20% 80%)" }}
                    >
                      {mat.category}
                    </span>
                  </td>
                  <td className="px-6 py-4" style={{ color: "hsl(215 20% 80%)" }}>
                    {mat.length_mm ? `${mat.length_mm}L ` : ""}
                    {mat.width_mm ? `x ${mat.width_mm}W ` : ""}
                    {mat.thickness_mm ? `x ${mat.thickness_mm}T` : ""}
                    {!mat.length_mm && !mat.width_mm && !mat.thickness_mm && "-"}
                  </td>
                  <td className="px-6 py-4" style={{ color: "hsl(215 20% 80%)" }}>
                    {mat.unit_cost ? `€ ${mat.unit_cost.toFixed(2)}` : "-"} / {mat.unit}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <form action={async () => {
                      "use server";
                      await deleteMaterial(mat.id);
                    }}>
                      <button
                        type="submit"
                        className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                        style={{ color: "hsl(0 84% 65%)", background: "hsl(0 84% 60% / 0.1)" }}
                      >
                        Elimina
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

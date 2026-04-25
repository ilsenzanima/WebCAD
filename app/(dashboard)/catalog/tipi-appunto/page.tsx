import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getNoteTypes } from "@/app/actions/field-notes";
import NoteTypesManager from "@/app/ui/projects/NoteTypesManager";

export default async function NoteTypesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const types = await getNoteTypes();

  return (
    <div className="flex flex-col h-full overflow-y-auto w-full animate-fade-in pb-4">
      {/* ── Header ───────────────────────────── */}
      <div className="px-4 sm:px-8 py-4 sm:py-6 space-y-3 sm:space-y-4">
        <div
          className="flex items-center gap-2 text-sm font-medium"
          style={{ color: "hsl(215 15% 55%)" }}
        >
          <Link href="/catalog" className="hover:text-white transition-colors">
            Catalogo
          </Link>
          <span>/</span>
          <span className="text-white">Tipi Appunto</span>
        </div>

        <div>
          <h1 className="text-2xl font-bold text-white">🏷️ Tipi Appunto</h1>
          <p className="mt-1 text-sm" style={{ color: "hsl(215 15% 50%)" }}>
            Gestisci il catalogo dei tipi di appunto cantiere. Puoi eliminare le
            voci non più necessarie.
          </p>
        </div>
      </div>

      <div
        style={{
          height: "1px",
          background: "hsl(220 20% 14%)",
          margin: "0 2rem 1.5rem",
        }}
      />

      <div className="px-4 sm:px-8">
        <NoteTypesManager initialTypes={types} />
      </div>
    </div>
  );
}

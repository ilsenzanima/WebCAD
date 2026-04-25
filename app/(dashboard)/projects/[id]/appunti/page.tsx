import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getFieldNotes } from "@/app/actions/field-notes";

export default async function FieldNotesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Verifica che il progetto esista e appartenga all'utente
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: project, error } = await (supabase as any)
    .from("projects")
    .select("id, name")
    .eq("id", id)
    .single() as { data: { id: string; name: string } | null; error: unknown };

  if (error || !project) return notFound();

  const notes = await getFieldNotes(id);

  return (
    <div className="flex flex-col h-full overflow-y-auto w-full animate-fade-in pb-16">
      {/* ── Header ───────────────────────────── */}
      <div className="px-8 py-6 space-y-4">
        {/* Breadcrumb */}
        <div
          className="flex items-center gap-2 text-sm font-medium"
          style={{ color: "hsl(215 15% 55%)" }}
        >
          <Link href="/projects" className="hover:text-white transition-colors">
            Progetti
          </Link>
          <span>/</span>
          <Link
            href={`/projects/${id}`}
            className="hover:text-white transition-colors"
          >
            {project.name}
          </Link>
          <span>/</span>
          <span className="text-white">Appunti Cantiere</span>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              📋 Appunti Cantiere
            </h1>
            <p className="mt-1 text-sm" style={{ color: "hsl(215 15% 50%)" }}>
              {project.name} — {notes.length} appunt{notes.length === 1 ? "o" : "i"}
            </p>
          </div>

          <Link
            href={`/projects/${id}/appunti/nuovo`}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all duration-200"
            style={{
              background:
                "linear-gradient(135deg, hsl(220 90% 56%), hsl(215 85% 48%))",
              boxShadow: "0 4px 16px hsl(220 90% 56% / 0.3)",
            }}
          >
            <span className="text-base leading-none">＋</span>
            Nuovo Appunto
          </Link>
        </div>
      </div>

      {/* ── Divisore ───── */}
      <div
        style={{
          height: "1px",
          background: "hsl(220 20% 14%)",
          margin: "0 2rem",
        }}
      />

      {/* ── Lista Appunti ───────────────────────── */}
      <div className="px-8 py-6">
        {notes.length === 0 ? (
          <div
            className="p-16 text-center rounded-2xl"
            style={{
              border: "1px dashed hsl(220 20% 24%)",
              background: "hsl(220 26% 14%)",
            }}
          >
            <div className="text-4xl mb-4">📋</div>
            <p
              className="text-sm font-medium"
              style={{ color: "hsl(215 15% 55%)" }}
            >
              Nessun appunto ancora.
            </p>
            <p className="text-xs mt-1" style={{ color: "hsl(215 15% 40%)" }}>
              Clicca "Nuovo Appunto" per iniziare.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {notes.map((note) => (
              <li key={note.id}>
                <div
                  className="flex items-center gap-4 px-5 py-4 rounded-2xl transition-all duration-200 group"
                  style={{
                    background: "hsl(220 26% 14%)",
                    border: "1px solid hsl(220 20% 20%)",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLDivElement).style.borderColor =
                      "hsl(220 90% 56%)";
                    (e.currentTarget as HTMLDivElement).style.boxShadow =
                      "0 4px 16px rgba(0,0,0,0.3)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLDivElement).style.borderColor =
                      "hsl(220 20% 20%)";
                    (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
                  }}
                >
                  {/* Badge numero */}
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                    style={{
                      background:
                        "linear-gradient(135deg, hsl(220 90% 56%), hsl(215 85% 48%))",
                    }}
                  >
                    #{note.note_number}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="text-white font-semibold text-sm">
                      {note.type_name ?? (
                        <span
                          className="italic"
                          style={{ color: "hsl(215 15% 45%)" }}
                        >
                          Tipo non specificato
                        </span>
                      )}
                    </div>
                    <div
                      className="text-xs mt-0.5"
                      style={{ color: "hsl(215 15% 45%)" }}
                    >
                      {new Date(note.created_at).toLocaleDateString("it-IT", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </div>

                  {/* Badge tipo */}
                  {note.type_name && (
                    <span
                      className="text-xs px-2.5 py-1 rounded-lg font-medium"
                      style={{
                        background: "hsl(220 32% 20%)",
                        color: "hsl(215 20% 65%)",
                      }}
                    >
                      {note.type_name}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

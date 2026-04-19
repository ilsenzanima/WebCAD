import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import CreateProjectButton from "@/app/ui/dashboard/CreateProjectButton";
import ProjectActionsMenu from "@/app/ui/dashboard/ProjectActionsMenu";

function safeFormatDate(dateStr: any) {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? "—" : d.toLocaleDateString("it-IT");
  } catch {
    return "—";
  }
}

export default async function DashboardPage() {
  const supabase = await createClient();
    
    // Sicurezza aggiuntiva per il recupero dati utente
    const { data: userData, error: authError } = await supabase.auth.getUser();
    if (authError || !userData?.user) {
      // In assenza di utente (caso edge), non throwiamo ma mostriamo uno stato di emergenza
      // Il redirect in teoria doveva pensarlo il layout
      console.warn("Nessun utente trovato nella pagina dashboard, ma layout passato.");
    }
    const user = userData?.user;

    const { data, error: dbError } = await supabase
      .from("projects")
      .select("id, name, client_info, created_at")
      .order("created_at", { ascending: false });

    if (dbError) {
      console.error("Errore recupero progetti:", dbError);
    }

    const projects: any[] = data || [];

    const userName =
      user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Utente";
    const firstName = userName.split(" ")[0] || "Utente";

    return (
      <div className="p-8 space-y-8 animate-fade-in">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">
              Ciao, {firstName} 👋
            </h1>
            <p className="mt-1 text-sm" style={{ color: "hsl(215 20% 55%)" }}>
              Gestisci i tuoi progetti antincendio
            </p>
          </div>
          <CreateProjectButton
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all duration-200"
            style={{
              background: "linear-gradient(135deg, hsl(220 90% 56%), hsl(215 85% 48%))",
              boxShadow: "0 4px 16px hsl(220 90% 56% / 0.3)",
            }}
          >
            <span className="text-base">+</span>
            Nuovo Progetto
          </CreateProjectButton>
        </div>

        {/* Stats rapide */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            {
              label: "Progetti totali",
              value: projects.length || 0,
              icon: "📁",
              color: "hsl(220 90% 56%)",
            },
            {
              label: "Materiali catalogo",
              value: "—",
              icon: "📦",
              color: "hsl(16 100% 58%)",
            },
            {
              label: "Elementi disegnati",
              value: "—",
              icon: "✏️",
              color: "hsl(142 71% 45%)",
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-2xl p-5 space-y-3"
              style={{
                background: "hsl(220 26% 14%)",
                border: "1px solid hsl(220 20% 20%)",
              }}
            >
              <div className="flex items-center justify-between">
                <span className="text-2xl">{stat.icon}</span>
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ background: stat.color }}
                />
              </div>
              <div>
                <div className="text-2xl font-bold text-white">{stat.value}</div>
                <div
                  className="text-xs mt-0.5"
                  style={{ color: "hsl(215 15% 50%)" }}
                >
                  {stat.label}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Lista progetti */}
        <div className="space-y-4">
          <h2
            className="text-sm font-semibold uppercase tracking-wider"
            style={{ color: "hsl(215 15% 45%)" }}
          >
            Progetti recenti
          </h2>

          {projects && projects.length > 0 ? (
            <div className="grid gap-3">
              {projects.map((project) => (
                <div
                  key={project.id || `fallback-proj-${Math.random()}`}
                  className="relative flex items-center justify-between p-5 rounded-2xl transition-all duration-200 group"
                  style={{
                    background: "hsl(220 26% 14%)",
                    border: "1px solid hsl(220 20% 20%)",
                  }}
                >
                  {/* Area cliccabile per aprire il progetto */}
                  <Link
                    href={`/projects/${project.id}/editor`}
                    className="flex items-center gap-4 flex-1 min-w-0 hover:opacity-90 transition-opacity"
                  >
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                      style={{ background: "hsl(220 32% 20%)" }}
                    >
                      🏗️
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-white font-medium text-sm truncate">
                        {project.name || "Senza Nome"}
                      </div>
                      <div
                        className="text-xs mt-0.5"
                        style={{ color: "hsl(215 15% 45%)" }}
                      >
                        Aggiornato il {safeFormatDate(project.created_at)}
                      </div>
                    </div>
                  </Link>

                  {/* Azioni destra: Apri + menu ⋮ */}
                  <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                    <Link
                      href={`/projects/${project.id}/editor`}
                      className="text-xs px-3 py-1 rounded-full transition-colors"
                      style={{
                        background: "hsl(220 32% 20%)",
                        color: "hsl(215 20% 65%)",
                      }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.background = "hsl(220 32% 26%)")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.background = "hsl(220 32% 20%)")
                      }
                    >
                      Apri →
                    </Link>

                    {/* Menu contestuale */}
                    <ProjectActionsMenu
                      projectId={project.id}
                      projectName={project.name || "Senza Nome"}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* Empty state */
            <div
              className="flex flex-col items-center justify-center py-16 rounded-2xl"
              style={{
                background: "hsl(220 26% 14%)",
                border: "1px dashed hsl(220 20% 24%)",
              }}
            >
              <div className="text-5xl mb-4">📐</div>
              <h3 className="text-white font-medium mb-2">
                Nessun progetto ancora
              </h3>
              <p
                className="text-sm text-center max-w-xs"
                style={{ color: "hsl(215 15% 50%)" }}
              >
                Crea il tuo primo progetto antincendio e inizia a disegnare.
              </p>
              <CreateProjectButton
                className="mt-6 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all"
                style={{
                  background: "linear-gradient(135deg, hsl(220 90% 56%), hsl(215 85% 48%))",
                }}
              >
                + Crea il primo progetto
              </CreateProjectButton>
            </div>
          )}
        </div>
      </div>
    );
}

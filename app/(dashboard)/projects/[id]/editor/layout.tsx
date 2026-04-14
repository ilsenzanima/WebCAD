import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function EditorLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Auth/RLS check per progetto
  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", id)
    .single();

  if (!project) redirect("/dashboard");

  return (
    <div
      className="fixed inset-0 overflow-hidden select-none"
      style={{ background: "hsl(228 39% 8%)" }}
    >
      {children}
    </div>
  );
}

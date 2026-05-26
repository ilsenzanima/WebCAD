import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function Editor3DLayout({
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

  // RLS check
  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", id)
    .single();

  if (!project) redirect("/projects");

  return (
    <div
      className="fixed inset-0 overflow-hidden select-none"
      style={{ background: "hsl(228 39% 8%)" }}
    >
      {children}
    </div>
  );
}

import { redirect } from "next/navigation";

/**
 * Gli appunti sono ora associati a un livello specifico.
 * Questa route generica reindirizza al dettaglio progetto.
 */
export default async function NewFieldNotePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/projects/${id}`);
}

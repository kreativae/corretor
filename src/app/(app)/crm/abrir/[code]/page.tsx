import { getPropertyByCode } from "@/lib/queries";
import { crmPropertyPath } from "@/lib/rural";
import { notFound, redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** Atalho da barra de edição do site: código do anúncio → ficha (ou edição) no CRM. */
export default async function AbrirImovel({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ to?: string }>;
}) {
  const [{ code }, { to }] = await Promise.all([params, searchParams]);
  const p = await getPropertyByCode(decodeURIComponent(code));
  if (!p) notFound();
  redirect(crmPropertyPath(p, to === "editar" ? "/editar" : ""));
}

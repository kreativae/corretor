import { getSuperadmin } from "@/lib/auth";
import { deleteTenant, updateTenant } from "@/lib/tenant";
import { NextResponse } from "next/server";

type Params = { params: Promise<{ slug: string }> };

/** Nome e domínios próprios da empresa */
export async function PATCH(req: Request, { params }: Params) {
  if (!(await getSuperadmin())) return NextResponse.json({ error: "Apenas a gerência." }, { status: 403 });
  const { slug } = await params;
  const b = (await req.json().catch(() => ({}))) as { name?: string; domains?: string[] };
  try {
    await updateTenant(slug, { name: b.name, domains: Array.isArray(b.domains) ? b.domains.map(String) : undefined });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Falha ao salvar." }, { status: 400 });
  }
}

/** Exclui a empresa e todos os dados dela — exige digitar o identificador */
export async function DELETE(req: Request, { params }: Params) {
  if (!(await getSuperadmin())) return NextResponse.json({ error: "Apenas a gerência." }, { status: 403 });
  const { slug } = await params;
  const b = (await req.json().catch(() => ({}))) as { confirm?: string };
  if (b.confirm !== slug) return NextResponse.json({ error: "Digite o identificador da empresa para confirmar." }, { status: 400 });
  try {
    await deleteTenant(slug);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Falha ao excluir." }, { status: 400 });
  }
}

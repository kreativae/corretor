import { unlockKmz } from "@/lib/kmz-lock";
import { getPropertyByCode } from "@/lib/queries";
import { NextResponse } from "next/server";

/** Formulário da senha do KMZ: certa, libera o mapa e o download; errada, volta com aviso. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = await getPropertyByCode(id);
  if (!p) return new NextResponse("Não encontrado", { status: 404 });
  const form = await req.formData().catch(() => null);
  const ok = await unlockKmz(p.id, String(form?.get("senha") ?? ""));
  // Senha errada: pequena espera contra tentativas em sequência
  if (!ok) await new Promise((r) => setTimeout(r, 800));
  return NextResponse.redirect(new URL(`/imoveis/${p.code}/mapa${ok ? "" : "?erro=1"}`, req.url), 303);
}

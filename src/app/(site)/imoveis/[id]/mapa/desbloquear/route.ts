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
  // Caminho relativo: atrás do proxy (Coolify) o req.url é o endereço interno do container
  return new NextResponse(null, { status: 303, headers: { Location: `/imoveis/${p.code}/mapa${ok ? "" : "?erro=1"}` } });
}

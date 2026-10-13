import { apiUser, unauthorized } from "@/lib/api-auth";
import { getCustomFeatures, saveCustomFeatures } from "@/lib/features";
import { FEATURES } from "@/lib/labels";
import { NextResponse } from "next/server";

const key = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/** "  energia   SOLAR " → "Energia SOLAR" (só a 1ª letra é forçada) */
function clean(v: unknown) {
  const s = String(v ?? "").replace(/\s+/g, " ").trim().slice(0, 40);
  return s ? s[0].toLocaleUpperCase("pt-BR") + s.slice(1) : "";
}

export async function GET() {
  if (!(await apiUser())) return unauthorized();
  return NextResponse.json(await getCustomFeatures());
}

/** Cadastra uma comodidade nova (ignora repetidas, com ou sem acento). */
export async function POST(req: Request) {
  if (!(await apiUser())) return unauthorized();
  try {
    const name = clean((await req.json())?.name);
    if (!name) return NextResponse.json({ error: "Informe o nome" }, { status: 400 });
    const list = await getCustomFeatures();
    const existing = [...FEATURES, ...list].find((f) => key(f) === key(name));
    if (existing) return NextResponse.json({ name: existing, list });
    const next = [...list, name];
    await saveCustomFeatures(next);
    return NextResponse.json({ name, list: next });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Falha ao salvar comodidade" }, { status: 500 });
  }
}

/** Remove da lista de sugestões (imóveis que já a usam continuam com ela). */
export async function DELETE(req: Request) {
  if (!(await apiUser())) return unauthorized();
  try {
    const name = String((await req.json())?.name ?? "");
    const list = (await getCustomFeatures()).filter((f) => f !== name);
    await saveCustomFeatures(list);
    return NextResponse.json({ list });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Falha ao remover comodidade" }, { status: 500 });
  }
}

import { getCurrentUser } from "@/lib/auth";
import { cartoGeocode, getMapProvider } from "@/lib/map-provider";
import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/roles";

/** Testa o token da CARTO localizando um endereço */
export async function POST(req: Request) {
  const u = await getCurrentUser();
  if (!isAdmin(u)) return NextResponse.json({ error: "Apenas administradores." }, { status: 403 });
  const { q } = (await req.json().catch(() => ({}))) as { q?: string };
  try {
    const hit = await cartoGeocode(await getMapProvider(), (q || "Goiânia, GO, Brasil").slice(0, 200));
    if (!hit) return NextResponse.json({ error: "A CARTO respondeu, mas não encontrou o endereço." }, { status: 404 });
    return NextResponse.json({ lat: hit[0], lng: hit[1] });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Falha no teste." }, { status: 502 });
  }
}

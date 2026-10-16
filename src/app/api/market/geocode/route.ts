import { getDb } from "@/db";
import { regionGeo } from "@/db/schema";
import { apiUser, unauthorized } from "@/lib/api-auth";
import { cartoGeocode, getMapProvider, osmGeocode } from "@/lib/map-provider";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

/**
 * Localiza o centro de um bairro/cidade (CARTO ou OpenStreetMap) e guarda no cache.
 * O cliente chama uma região por vez, com intervalo de ~1 s (regra de uso do serviço).
 */
export async function POST(req: Request) {
  if (!(await apiUser())) return unauthorized();
  const b = (await req.json().catch(() => ({}))) as { key?: unknown; q?: unknown };
  const key = typeof b.key === "string" ? b.key.slice(0, 200) : "";
  const q = typeof b.q === "string" ? b.q.slice(0, 200) : "";
  if (!key || !q) return NextResponse.json({ error: "Região inválida." }, { status: 400 });

  const [cached] = await (await getDb()).select().from(regionGeo).where(eq(regionGeo.key, key));
  if (cached) return NextResponse.json({ lat: cached.lat, lng: cached.lng });

  // CARTO quando há token; OpenStreetMap como alternativa gratuita
  const cfg = await getMapProvider();
  let hit: [number, number] | null = null;
  let error = "";
  if (cfg.cartoToken) {
    try {
      hit = await cartoGeocode(cfg, q);
    } catch (e) {
      error = e instanceof Error ? e.message : "Falha na CARTO.";
    }
  }
  if (!hit) {
    try {
      hit = await osmGeocode(q);
    } catch (e) {
      // Nenhum serviço respondeu: não grava no cache para tentar de novo depois
      return NextResponse.json({ error: error || (e instanceof Error ? e.message : "Serviço de mapas indisponível.") }, { status: 502 });
    }
  }
  const [lat, lng] = hit ?? [null, null];
  await (await getDb()).insert(regionGeo).values({ key, lat, lng }).onConflictDoNothing();
  return NextResponse.json({ lat, lng });
}

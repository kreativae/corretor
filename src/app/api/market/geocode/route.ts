import { getDb } from "@/db";
import { regionGeo } from "@/db/schema";
import { apiUser, unauthorized } from "@/lib/api-auth";
import { cityCenter, geocodeInCity, insideCity } from "@/lib/geo-check";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

/**
 * Localiza o centro de um bairro/cidade (CARTO ou OpenStreetMap) e guarda no cache.
 * O ponto só vale se ficar na cidade informada (bairros homônimos de outras cidades são
 * descartados; ver lib/geo-check.ts). O cliente chama uma região por vez, com intervalo de ~1 s.
 */
export async function POST(req: Request) {
  if (!(await apiUser())) return unauthorized();
  const b = (await req.json().catch(() => ({}))) as { key?: unknown; q?: unknown; city?: unknown; state?: unknown };
  const key = typeof b.key === "string" ? b.key.slice(0, 200) : "";
  const q = typeof b.q === "string" ? b.q.slice(0, 200) : "";
  const city = typeof b.city === "string" ? b.city.slice(0, 100) : "";
  const state = typeof b.state === "string" ? b.state.slice(0, 40) : "";
  if (!key || !q) return NextResponse.json({ error: "Região inválida." }, { status: 400 });

  const db = await getDb();
  const [cached] = await db.select().from(regionGeo).where(eq(regionGeo.key, key));
  if (cached) {
    const pos: [number, number] | null = cached.lat != null && cached.lng != null ? [cached.lat, cached.lng] : null;
    if (!pos || insideCity(pos, await cityCenter(city, state).catch(() => null))) {
      return NextResponse.json({ lat: cached.lat, lng: cached.lng });
    }
  }

  let hit: [number, number] | null;
  try {
    hit = await geocodeInCity(q, city, state);
  } catch (e) {
    // Nenhum serviço respondeu: não grava no cache para tentar de novo depois
    return NextResponse.json({ error: e instanceof Error ? e.message : "Serviço de mapas indisponível." }, { status: 502 });
  }
  const [lat, lng] = hit ?? [null, null];
  await db
    .insert(regionGeo)
    .values({ key, lat, lng })
    .onConflictDoUpdate({ target: regionGeo.key, set: { lat, lng, updatedAt: new Date() } });
  return NextResponse.json({ lat, lng });
}

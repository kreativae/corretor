import { db } from "@/db";
import { regionGeo } from "@/db/schema";
import { apiUser, unauthorized } from "@/lib/api-auth";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

/**
 * Localiza o centro de um bairro/cidade (OpenStreetMap) e guarda no cache.
 * O cliente chama uma região por vez, com intervalo de ~1 s (regra de uso do serviço).
 */
export async function POST(req: Request) {
  if (!(await apiUser())) return unauthorized();
  const b = (await req.json().catch(() => ({}))) as { key?: unknown; q?: unknown };
  const key = typeof b.key === "string" ? b.key.slice(0, 200) : "";
  const q = typeof b.q === "string" ? b.q.slice(0, 200) : "";
  if (!key || !q) return NextResponse.json({ error: "Região inválida." }, { status: 400 });

  const [cached] = await db.select().from(regionGeo).where(eq(regionGeo.key, key));
  if (cached) return NextResponse.json({ lat: cached.lat, lng: cached.lng });

  let lat: number | null = null;
  let lng: number | null = null;
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&q=${encodeURIComponent(q)}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "corretor-crm/1.0 (mapa do m2)", "Accept-Language": "pt-BR" },
      cache: "no-store",
    });
    if (!res.ok) return NextResponse.json({ error: "Serviço de mapas indisponível." }, { status: 502 });
    const [hit] = (await res.json()) as { lat?: string; lon?: string }[];
    if (hit?.lat && hit?.lon) {
      lat = Number(hit.lat);
      lng = Number(hit.lon);
    }
  } catch {
    return NextResponse.json({ error: "Serviço de mapas indisponível." }, { status: 502 });
  }
  await db.insert(regionGeo).values({ key, lat, lng }).onConflictDoNothing();
  return NextResponse.json({ lat, lng });
}

import "server-only";
import { getDb } from "@/db";
import { properties } from "@/db/schema";
import { geocodeInCity } from "@/lib/geo-check";
import { isRuralType } from "@/lib/rural";
import { and, eq, isNull, ne } from "drizzle-orm";

/**
 * Ponto do imóvel no mapa a partir do endereço cadastrado (rua e número, bairro, cidade),
 * conferido para cair na cidade certa. Usado no Valor do m² e no mapa da região do anúncio.
 * Rurais ficam de fora (estrada não localiza bem; o mapa usa o município ou o KMZ).
 */
export async function geocodeProperty(id: string) {
  const db = await getDb();
  const [p] = await db
    .select({ type: properties.type, street: properties.street, neighborhood: properties.neighborhood, city: properties.city, state: properties.state })
    .from(properties)
    .where(eq(properties.id, id));
  if (!p || isRuralType(p.type) || !p.street.trim() || !p.city.trim()) return;
  const hit = await geocodeInCity([p.street, p.neighborhood, p.city, p.state, "Brasil"].filter(Boolean).join(", "), p.city, p.state, false).catch(
    () => null,
  );
  if (hit) await db.update(properties).set({ lat: hit[0], lng: hit[1] }).where(eq(properties.id, id));
}

/** Imóveis com rua e sem ponto: localiza alguns por vez (regra de uso do OpenStreetMap: ~1 por segundo) */
export async function backfillPropertyGeo(limit = 15) {
  const db = await getDb();
  const rows = await db
    .select({ id: properties.id, type: properties.type })
    .from(properties)
    .where(and(isNull(properties.lat), ne(properties.street, "")))
    .limit(limit * 2);
  let n = 0;
  for (const r of rows) {
    if (isRuralType(r.type)) continue;
    if (n++ >= limit) break;
    await geocodeProperty(r.id);
    await new Promise((ok) => setTimeout(ok, 1100));
  }
}

import "server-only";
import { getDb } from "@/db";
import { properties } from "@/db/schema";
import { getWhiteLabel } from "@/lib/queries";
import type { PropertyKind } from "@/lib/rural";

/** Prefixos configurados no White Label (padrão NRD e RUR; terrenos = imóveis se vazio). */
export async function codePrefixes() {
  const wl = await getWhiteLabel();
  const urban = wl.codePrefix || "NRD";
  return { urban, rural: wl.codePrefixRural || "RUR", land: wl.codePrefixLand || urban };
}

/** Próximo código livre, com o prefixo do White Label da categoria. */
export async function nextPropertyCode(kind: PropertyKind) {
  const p = await codePrefixes();
  const prefix = kind === "rural" ? p.rural : kind === "terreno" ? p.land : p.urban;
  const taken = new Set(
    (await (await getDb()).select({ code: properties.code }).from(properties)).map((r) => r.code),
  );
  let seq = 2401 + taken.size;
  while (taken.has(`${prefix}-${seq}`)) seq += 1;
  return `${prefix}-${seq}`;
}

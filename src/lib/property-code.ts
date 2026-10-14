import "server-only";
import { db } from "@/db";
import { properties } from "@/db/schema";
import { getWhiteLabel } from "@/lib/queries";

/** Prefixos configurados no White Label (padrão NRD e RUR). */
export async function codePrefixes() {
  const wl = await getWhiteLabel();
  return { urban: wl.codePrefix || "NRD", rural: wl.codePrefixRural || "RUR" };
}

/** Próximo código livre, com o prefixo do White Label (rural ou urbano). */
export async function nextPropertyCode(rural: boolean) {
  const p = await codePrefixes();
  const prefix = rural ? p.rural : p.urban;
  const taken = new Set(
    (await db.select({ code: properties.code }).from(properties)).map((r) => r.code),
  );
  let seq = 2401 + taken.size;
  while (taken.has(`${prefix}-${seq}`)) seq += 1;
  return `${prefix}-${seq}`;
}

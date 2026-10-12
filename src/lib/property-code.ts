import "server-only";
import { db } from "@/db";
import { properties } from "@/db/schema";

/** Próximo código livre (RUR- para rurais, NRD- para urbanos). */
export async function nextPropertyCode(rural: boolean) {
  const prefix = rural ? "RUR" : "NRD";
  const taken = new Set(
    (await db.select({ code: properties.code }).from(properties)).map((r) => r.code),
  );
  let seq = 2401 + taken.size;
  while (taken.has(`${prefix}-${seq}`)) seq += 1;
  return `${prefix}-${seq}`;
}

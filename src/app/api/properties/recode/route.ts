import { getDb } from "@/db";
import { activities, properties } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { codePrefixes } from "@/lib/property-code";
import { isRuralType } from "@/lib/rural";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/roles";

/**
 * Troca o prefixo dos códigos já cadastrados pelos do White Label
 * (NRD-2401 → CA-2401), mantendo o número. Links antigos continuam
 * abrindo: a busca por código cai no mesmo número se o prefixo mudou.
 */
export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Faça login." }, { status: 401 });
  if (!isAdmin(user)) return NextResponse.json({ error: "Apenas administradores." }, { status: 403 });
  try {
    const prefixes = await codePrefixes();
    const rows = await (await getDb()).select({ id: properties.id, code: properties.code, type: properties.type }).from(properties);
    const taken = new Set(rows.map((r) => r.code));
    let changed = 0;
    for (const r of rows) {
      const m = r.code.match(/^([A-Z0-9]+)-(\d+)$/i);
      if (!m) continue;
      const want = isRuralType(r.type) ? prefixes.rural : prefixes.urban;
      if (m[1].toUpperCase() === want) continue;
      let n = Number(m[2]);
      let code = `${want}-${n}`;
      while (taken.has(code)) code = `${want}-${++n}`;
      await (await getDb()).update(properties).set({ code }).where(eq(properties.id, r.id));
      taken.delete(r.code);
      taken.add(code);
      changed += 1;
    }
    if (changed) {
      await (await getDb()).insert(activities).values({
        entity: "sistema",
        entityId: null,
        kind: "updated",
        text: `${user.name} atualizou o código de ${changed} ${changed === 1 ? "anúncio" : "anúncios"} para os prefixos ${prefixes.urban}- e ${prefixes.rural}-.`,
      });
    }
    return NextResponse.json({ changed });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Falha ao atualizar os códigos." }, { status: 500 });
  }
}

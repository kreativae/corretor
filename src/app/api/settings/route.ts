import { db } from "@/db";
import { activities, settings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";
import { getWhiteLabel, WL_DEFAULTS, type WhiteLabel } from "@/lib/queries";
import { NextResponse } from "next/server";

export async function GET() {
  const wl = await getWhiteLabel();
  return NextResponse.json({ whiteLabel: wl });
}

/** Mantém só campos conhecidos do white label, como texto. */
function sanitizeWhiteLabel(input: Record<string, unknown>): WhiteLabel {
  const out = { ...WL_DEFAULTS };
  for (const k of Object.keys(WL_DEFAULTS) as (keyof WhiteLabel)[]) {
    if (typeof input[k] === "string") out[k] = (input[k] as string).trim().slice(0, 500);
  }
  if (!/^#[0-9a-f]{6}$/i.test(out.accent)) out.accent = WL_DEFAULTS.accent;
  out.phone = out.phone.replace(/\D/g, "");
  for (const k of ["logoUrl", "logoDarkUrl", "iconUrl"] as const) {
    if (out[k] && !/^https?:\/\//.test(out[k])) out[k] = "";
  }
  if (!out.orgName) out.orgName = WL_DEFAULTS.orgName;
  return out;
}

export async function POST(req: Request) {
  await requireAdmin();
  try {
    const body = await req.json();
    const key = body.key;
    let value = body.value;
    if (!key || value === undefined) {
      return NextResponse.json({ error: "Dados incompletos" }, { status: 400 });
    }
    if (key === "whiteLabel") value = sanitizeWhiteLabel(value ?? {});

    const existing = await db
      .select()
      .from(settings)
      .where(eq(settings.key, key));

    if (existing.length) {
      await db
        .update(settings)
        .set({ value })
        .where(eq(settings.key, key));
    } else {
      await db.insert(settings).values({ key, value });
    }

    if (key === "whiteLabel") {
      await db.insert(activities).values({
        entity: "sistema",
        entityId: null,
        kind: "updated",
        text: "Identidade visual (white label) atualizada pelo administrador.",
      });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Falha ao salvar configuração" }, { status: 500 });
  }
}

import { getDb } from "@/db";
import { activities, settings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";
import { sanitizeFeatures } from "@/lib/features";
import { sanitizeMapOptions } from "@/lib/map-options";
import { sanitizeWatermark } from "@/lib/watermark-settings";
import { sanitizeStatCards } from "@/lib/stat-cards";
import { sanitizeSecurity } from "@/lib/security-settings";
import { getWhiteLabel, WL_DEFAULTS, type WhiteLabel, cleanCodePrefix } from "@/lib/queries";
import { mergeMessages } from "@/lib/messages";
import { NextResponse } from "next/server";

export async function GET() {
  const wl = await getWhiteLabel();
  return NextResponse.json({ whiteLabel: wl });
}

/** Mantém só campos conhecidos do white label, como texto. */
function sanitizeWhiteLabel(input: Record<string, unknown>): WhiteLabel {
  const out = { ...WL_DEFAULTS };
  const fields = out as Record<string, string | boolean>;
  for (const k of Object.keys(WL_DEFAULTS) as (keyof WhiteLabel)[]) {
    const def = WL_DEFAULTS[k];
    if (typeof def === "string" && typeof input[k] === "string") {
      fields[k] = (input[k] as string).trim().slice(0, 500);
    } else if (typeof def === "boolean" && typeof input[k] === "boolean") {
      fields[k] = input[k] as boolean;
    }
  }
  if (!/^#[0-9a-f]{6}$/i.test(out.accent)) out.accent = WL_DEFAULTS.accent;
  if (out.onAccent && !/^#[0-9a-f]{6}$/i.test(out.onAccent)) out.onAccent = "";
  out.phone = out.phone.replace(/\D/g, "");
  for (const k of ["logoUrl", "logoDarkUrl", "iconUrl"] as const) {
    if (out[k] && !/^https?:\/\//.test(out[k])) out[k] = "";
  }
  if (!out.orgName) out.orgName = WL_DEFAULTS.orgName;
  out.codePrefix = cleanCodePrefix(out.codePrefix, WL_DEFAULTS.codePrefix);
  out.codePrefixRural = cleanCodePrefix(out.codePrefixRural, WL_DEFAULTS.codePrefixRural);
  out.codePrefixLand = out.codePrefixLand ? cleanCodePrefix(out.codePrefixLand, "") : "";
  return out;
}

export async function POST(req: Request) {
  await requireAdmin();
  try {
    const body = await req.json();
    const key = body.key;
    let value = body.value;
    // Chaves com segredos têm rota própria (não passam por aqui)
    if (["email", "whatsapp", "mapProvider", "account"].includes(key)) {
      return NextResponse.json({ error: "Use a tela de configuração específica." }, { status: 400 });
    }
    if (!key || value === undefined) {
      return NextResponse.json({ error: "Dados incompletos" }, { status: 400 });
    }
    if (key === "whiteLabel") value = sanitizeWhiteLabel(value ?? {});
    if (key === "features") value = sanitizeFeatures(value ?? {});
    if (key === "statCards") value = sanitizeStatCards(value ?? {});
    if (key === "mapOptions") value = sanitizeMapOptions(value ?? {});
    if (key === "watermark") value = sanitizeWatermark(value ?? {});
    if (key === "security") value = sanitizeSecurity(value ?? {});
    if (key === "messages") value = mergeMessages(value ?? {});
    if (key === "notifications") {
      value = {
        leadEmails: String(value?.leadEmails ?? "").slice(0, 500),
        enabled: value?.enabled !== false,
        notifyResponsible: value?.notifyResponsible === true,
      };
    }

    const existing = await (await getDb())
      .select()
      .from(settings)
      .where(eq(settings.key, key));

    if (existing.length) {
      await (await getDb())
        .update(settings)
        .set({ value })
        .where(eq(settings.key, key));
    } else {
      await (await getDb()).insert(settings).values({ key, value });
    }

    if (key === "whiteLabel") {
      await (await getDb()).insert(activities).values({
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

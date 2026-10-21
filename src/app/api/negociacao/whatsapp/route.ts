import { getDb } from "@/db";
import { activities, contacts, propertySends, type SentAttachment } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { getFile } from "@/lib/blob";
import { requestPublicOrigin } from "@/lib/google";
import { emailBaseUrl } from "@/lib/notify";
import { getWhiteLabel, listProperties } from "@/lib/queries";
import { getMessages } from "@/lib/features";
import { selectionWaCard, selectionWaIntro } from "@/lib/selection-whatsapp";
import { siteImage } from "@/lib/utils";
import { lineFor, sendMediaUrl, sendText, waPhone, whatsappReady } from "@/lib/whatsapp";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import sharp from "sharp";

export const maxDuration = 120;

const MAX_PROPS = 12;
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Foto de capa pública (com marca d'água) em JPEG, que todo WhatsApp mostra */
async function coverJpeg(url: string, origin: string) {
  const abs = url.startsWith("http") ? url : `${origin}${url}`;
  const res = await fetch(abs, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok || !(res.headers.get("content-type") ?? "").startsWith("image/")) return null;
  const buf = Buffer.from(await res.arrayBuffer());
  const out = await sharp(buf).rotate().resize(1280, 1280, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 82 }).toBuffer();
  return out.toString("base64");
}

/** Envia ao cliente a seleção de imóveis pelo WhatsApp (foto + texto de cada um) e grava no histórico. */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Faça login." }, { status: 401 });
  const cfg = await lineFor(user.id);
  if (!whatsappReady(cfg)) {
    return NextResponse.json({ error: "WhatsApp não configurado (Configurações › WhatsApp)." }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const toPhone = waPhone(String(body.toPhone ?? ""));
  const toName = String(body.toName ?? "").trim().slice(0, 120);
  const subject = String(body.subject ?? "").trim().slice(0, 200) || "Seleção de imóveis";
  const message = String(body.message ?? "").trim().slice(0, 3000);
  // Modelo da mensagem de cada imóvel, ajustado neste envio (vazio = o de Configurações › Mensagens)
  const cardTemplate = String(body.cardTemplate ?? "").slice(0, 2000);
  const photos = body.photos !== false && cfg.provider === "evolution";
  const ids: string[] = Array.isArray(body.propertyIds) ? body.propertyIds.map(String).slice(0, MAX_PROPS) : [];
  const attachments: SentAttachment[] =
    Array.isArray(body.attachments) && cfg.provider === "evolution"
      ? body.attachments
          .filter((a: SentAttachment) => typeof a?.pathname === "string" && a.pathname.startsWith("envios/") && !a.pathname.includes(".."))
          .map((a: SentAttachment) => ({
            pathname: a.pathname,
            name: String(a.name || "ficha.pdf").slice(0, 80),
            size: Number(a.size) || 0,
            access: a.access === "public" ? "public" : "private",
          }))
          .slice(0, MAX_PROPS)
      : [];
  let contactId: string | null = /^[0-9a-f-]{36}$/i.test(String(body.contactId ?? "")) ? String(body.contactId) : null;

  if (toPhone.length < 12) return NextResponse.json({ error: "WhatsApp do cliente inválido." }, { status: 400 });
  if (!ids.length) return NextResponse.json({ error: "Selecione ao menos um imóvel." }, { status: 400 });

  const all = await listProperties();
  const byId = new Map(all.map((p) => [p.id, p]));
  const props = ids.map((id) => byId.get(id)).filter((p) => !!p);
  if (!props.length) return NextResponse.json({ error: "Imóveis não encontrados." }, { status: 404 });

  if (contactId) {
    const [c] = await (await getDb()).select({ id: contacts.id }).from(contacts).where(eq(contacts.id, contactId));
    if (!c) contactId = null;
  }

  const [wl, msgs] = await Promise.all([getWhiteLabel(), getMessages()]);
  const origin = requestPublicOrigin(req);
  const baseUrl = await emailBaseUrl(wl.domain, origin);
  const snapshot = props.map((p) => ({ id: p.id, code: p.code, title: p.title, price: p.price, city: p.city }));
  const base = {
    channel: "whatsapp" as const,
    contactId,
    toName: toName || null,
    toPhone,
    subject,
    message: message || null,
    properties: snapshot,
    attachments,
    sentBy: user.name,
  };

  // Uma mensagem por vez, com pausa curta: a ordem chega certa e não parece disparo em massa
  let sent = 0;
  try {
    // Do smart match (conversa já aberta) vai só o imóvel, sem nova saudação
    const intro = body.intro === false ? "" : selectionWaIntro(toName, message, msgs);
    if (intro) {
      await sendText(cfg, toPhone, intro, user.name);
      await pause(900);
    }
    for (const p of props) {
      const text = selectionWaCard(p, baseUrl, msgs, cardTemplate);
      const img = photos && p.cover ? await coverJpeg(siteImage(p.cover, p.wm)!, origin).catch(() => null) : null;
      if (img) await sendMediaUrl(cfg, toPhone, img, { caption: text, fileName: `${p.code}.jpg`, mime: "image/jpeg", sentBy: user.name });
      else await sendText(cfg, toPhone, text, user.name);
      sent++;
      await pause(1200);
    }
    let files = 0;
    for (const a of attachments) {
      const r = await getFile(a.pathname, a.access ?? "private");
      if (!r) continue;
      const b64 = Buffer.from(await new Response(r.stream).arrayBuffer()).toString("base64");
      await sendMediaUrl(cfg, toPhone, b64, { fileName: a.name, mime: "application/pdf", sentBy: user.name });
      files++;
      await pause(900);
    }

    const [row] = await (await getDb())
      .insert(propertySends)
      .values({ ...base, status: "enviado" })
      .returning();

    const codes = snapshot.map((p) => p.code).join(", ");
    const who = toName || toPhone;
    await (await getDb()).insert(activities).values([
      ...(contactId
        ? [{
            entity: "contato" as const,
            entityId: contactId,
            kind: "whatsapp",
            text: `${user.name} enviou pelo WhatsApp ${snapshot.length === 1 ? "o imóvel" : `${snapshot.length} imóveis`}: ${codes}${files ? " (fichas em PDF)" : ""}.`,
          }]
        : []),
      ...snapshot.map((p) => ({
        entity: "imovel" as const,
        entityId: p.id,
        kind: "whatsapp",
        text: `Enviado pelo WhatsApp para ${who} por ${user.name}.`,
      })),
    ]);

    return NextResponse.json(row);
  } catch (e) {
    const reason = e instanceof Error ? e.message : "Falha no envio";
    const error = sent ? `${reason} (${sent} de ${props.length} imóveis chegaram a ser enviados)` : reason;
    console.error("[negociação whatsapp]", e);
    await (await getDb())
      .insert(propertySends)
      .values({ ...base, status: "falhou", error })
      .catch(() => undefined);
    return NextResponse.json({ error }, { status: 502 });
  }
}

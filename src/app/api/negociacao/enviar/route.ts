import { getDb } from "@/db";
import { activities, contacts, propertySends, type SentAttachment } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { blobToken } from "@/lib/blob";
import { requestPublicOrigin } from "@/lib/google";
import { emailConfigured, sendEmail, type EmailAttachment } from "@/lib/notify";
import { getWhiteLabel, listProperties } from "@/lib/queries";
import { getMessages } from "@/lib/features";
import { selectionEmailHtml } from "@/lib/selection-email";
import { get } from "@vercel/blob";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export const maxDuration = 60;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_PROPS = 12;

async function readAttachment(a: SentAttachment, token: string): Promise<EmailAttachment | null> {
  const r = await get(a.pathname, { access: a.access ?? "private", token }).catch(() => null);
  if (!r || r.statusCode !== 200) return null;
  const buf = Buffer.from(await new Response(r.stream).arrayBuffer());
  return { filename: a.name, content: buf.toString("base64") };
}

/** Envia ao cliente a seleção de imóveis (com fichas em PDF anexas) e grava no histórico. */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Faça login." }, { status: 401 });
  if (!(await emailConfigured())) {
    return NextResponse.json(
      { error: "Envio de e-mail não configurado (Configurações › Avisos de novos leads)." },
      { status: 400 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const toEmail = String(body.toEmail ?? "").trim().toLowerCase();
  const toName = String(body.toName ?? "").trim().slice(0, 120);
  const subject = String(body.subject ?? "").trim().slice(0, 200);
  const message = String(body.message ?? "").trim().slice(0, 5000);
  const ids: string[] = Array.isArray(body.propertyIds) ? body.propertyIds.map(String).slice(0, MAX_PROPS) : [];
  const attachments: SentAttachment[] = Array.isArray(body.attachments)
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

  if (!EMAIL_RE.test(toEmail)) return NextResponse.json({ error: "E-mail do cliente inválido." }, { status: 400 });
  if (!subject) return NextResponse.json({ error: "Informe o assunto." }, { status: 400 });
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
  const token = blobToken();
  const files = token ? (await Promise.all(attachments.map((a) => readAttachment(a, token)))).filter((f) => !!f) : [];

  const snapshot = props.map((p) => ({ id: p.id, code: p.code, title: p.title, price: p.price, city: p.city }));
  const base = {
    contactId,
    toName: toName || null,
    toEmail,
    subject,
    message: message || null,
    properties: snapshot,
    attachments,
    sentBy: user.name,
  };

  try {
    const providerId = await sendEmail(
      [toEmail],
      subject,
      selectionEmailHtml({
        wl,
        baseUrl: requestPublicOrigin(req),
        toName,
        message,
        properties: props,
        broker: { name: user.name, phone: user.phone, email: user.email || wl.email },
        attached: files.length > 0,
        msgs,
      }),
      {
        replyTo: user.email || wl.email || undefined,
        fromName: `${user.name} · ${wl.orgName}`,
        attachments: files,
      },
    );

    const [row] = await (await getDb())
      .insert(propertySends)
      .values({ ...base, status: "enviado", providerId })
      .returning();

    const codes = snapshot.map((p) => p.code).join(", ");
    const who = toName || toEmail;
    await (await getDb()).insert(activities).values([
      ...(contactId
        ? [{
            entity: "contato" as const,
            entityId: contactId,
            kind: "email",
            text: `${user.name} enviou por e-mail ${snapshot.length === 1 ? "o imóvel" : `${snapshot.length} imóveis`}: ${codes}${files.length ? " (fichas em PDF anexas)" : ""}.`,
          }]
        : []),
      ...snapshot.map((p) => ({
        entity: "imovel" as const,
        entityId: p.id,
        kind: "email",
        text: `Enviado por e-mail para ${who} por ${user.name}.`,
      })),
    ]);

    return NextResponse.json(row);
  } catch (e) {
    const error = e instanceof Error ? e.message : "Falha no envio";
    console.error("[negociação]", e);
    await (await getDb())
      .insert(propertySends)
      .values({ ...base, status: "falhou", error })
      .catch(() => undefined);
    return NextResponse.json({ error }, { status: 502 });
  }
}

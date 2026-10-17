import { getDb } from "@/db";
import { mailMessages } from "@/db/schema";
import { emailConfigured } from "@/lib/notify";
import { mailAddress, mailDomain, ownAttachments, parseAddress, sendFromMailbox } from "@/lib/mail";
import { findVisibleMessage, mailUser } from "@/lib/mail-access";
import { and, count, desc, eq, ilike, isNull, or, type SQL } from "drizzle-orm";
import { NextResponse } from "next/server";

const EMAIL_RE = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;

/** Lista: ?pasta=entrada|enviados|geral&q=busca */
export async function GET(req: Request) {
  const u = await mailUser();
  if (!u) return NextResponse.json({ error: "Faça login." }, { status: 401 });
  const sp = new URL(req.url).searchParams;
  const folder = sp.get("pasta") ?? "entrada";
  const q = (sp.get("q") ?? "").trim().slice(0, 100);

  if (folder === "geral" && !u.admin) {
    return NextResponse.json({ error: "Apenas administradores." }, { status: 403 });
  }
  const where: SQL[] = [
    folder === "geral" ? isNull(mailMessages.userId) : eq(mailMessages.userId, u.id),
    eq(mailMessages.direction, folder === "enviados" ? "out" : "in"),
  ];
  if (q) {
    const like = `%${q.replace(/[%_]/g, "\\$&")}%`;
    where.push(
      or(
        ilike(mailMessages.subject, like),
        ilike(mailMessages.fromAddr, like),
        ilike(mailMessages.fromName, like),
        ilike(mailMessages.text, like),
      ) as SQL,
    );
  }

  const db = await getDb();
  const rows = await db
    .select({
      id: mailMessages.id,
      direction: mailMessages.direction,
      fromAddr: mailMessages.fromAddr,
      fromName: mailMessages.fromName,
      toAddrs: mailMessages.toAddrs,
      subject: mailMessages.subject,
      text: mailMessages.text,
      attachments: mailMessages.attachments,
      read: mailMessages.read,
      createdAt: mailMessages.createdAt,
    })
    .from(mailMessages)
    .where(and(...where))
    .orderBy(desc(mailMessages.createdAt))
    .limit(100);

  const unreadOf = async (owner: SQL) =>
    (
      await db
        .select({ n: count() })
        .from(mailMessages)
        .where(and(owner, eq(mailMessages.direction, "in"), eq(mailMessages.read, false)))
    )[0]?.n ?? 0;

  const domain = await mailDomain();
  return NextResponse.json({
    address: mailAddress(u.mailbox, domain),
    admin: u.admin,
    unread: {
      entrada: await unreadOf(eq(mailMessages.userId, u.id)),
      geral: u.admin ? await unreadOf(isNull(mailMessages.userId)) : 0,
    },
    messages: rows.map((r) => ({
      ...r,
      preview: (r.text ?? "").replace(/\s+/g, " ").trim().slice(0, 140),
      text: undefined,
      hasAttachments: r.attachments.length > 0,
      attachments: undefined,
    })),
  });
}

/** Envia do endereço do usuário: { to, cc?, subject, text, replyToId? } */
export async function POST(req: Request) {
  const u = await mailUser();
  if (!u) return NextResponse.json({ error: "Faça login." }, { status: 401 });
  if (!(await emailConfigured())) {
    return NextResponse.json({ error: "Envio de e-mail não configurado (Configurações › Avisos de novos leads)." }, { status: 400 });
  }
  const body = await req.json().catch(() => ({}));
  const list = (v: unknown) =>
    String(v ?? "")
      .split(/[,;]+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 20);
  const to = list(body.to);
  const cc = list(body.cc);
  const subject = String(body.subject ?? "").trim().slice(0, 200);
  const text = String(body.text ?? "").slice(0, 20000);
  const bad = [...to, ...cc].find((a) => !EMAIL_RE.test(parseAddress(a).addr));

  if (!to.length) return NextResponse.json({ error: "Informe o destinatário." }, { status: 400 });
  if (bad) return NextResponse.json({ error: `E-mail inválido: ${bad}` }, { status: 400 });
  if (!subject) return NextResponse.json({ error: "Informe o assunto." }, { status: 400 });
  if (!text.trim()) return NextResponse.json({ error: "Escreva a mensagem." }, { status: 400 });

  const replyTo = body.replyToId ? await findVisibleMessage(u, String(body.replyToId)) : null;
  try {
    const attachments = ownAttachments(u.id, body.attachments);
    const row = await sendFromMailbox(u, { to, cc, subject, text, replyTo, attachments });
    return NextResponse.json({ id: row.id });
  } catch (e) {
    console.error("[e-mail enviado]", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Falha no envio" }, { status: 502 });
  }
}

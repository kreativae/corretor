import { getDb } from "@/db";
import { mailMessages } from "@/db/schema";
import { emailConfigured } from "@/lib/notify";
import { mailAddress, mailDomain, ownAttachments, parseAddress, sendFromMailbox } from "@/lib/mail";
import { findVisibleMessage, mailboxOff, mailUser } from "@/lib/mail-access";
import { and, countDistinct, desc, eq, isNull, type SQL } from "drizzle-orm";
import { NextResponse } from "next/server";

const EMAIL_RE = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;

/**
 * Conversas da pasta: ?pasta=entrada|enviados|geral&q=busca. Entrada lista as conversas
 * com algo recebido; Enviados, as com algo enviado; Geral, a caixa sem dono (admins).
 */
export async function GET(req: Request) {
  const off = await mailboxOff();
  if (off) return off;
  const u = await mailUser();
  if (!u) return NextResponse.json({ error: "Faça login." }, { status: 401 });
  const sp = new URL(req.url).searchParams;
  const folder = sp.get("pasta") ?? "entrada";
  const q = (sp.get("q") ?? "").trim().toLowerCase().slice(0, 100);

  if (folder === "geral" && !u.admin) {
    return NextResponse.json({ error: "Apenas administradores." }, { status: 403 });
  }
  const db = await getDb();
  const ownerOf = (f: string) => (f === "geral" ? isNull(mailMessages.userId) : eq(mailMessages.userId, u.id));
  const rows = await db
    .select({
      id: mailMessages.id,
      threadId: mailMessages.threadId,
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
    .where(ownerOf(folder))
    .orderBy(desc(mailMessages.createdAt))
    .limit(1500);

  // Agrupa por conversa (as linhas já vêm da mais nova para a mais antiga)
  const threads = new Map<string, typeof rows>();
  for (const r of rows) {
    const list = threads.get(r.threadId);
    if (list) list.push(r);
    else threads.set(r.threadId, [r]);
  }
  const want = folder === "enviados" ? "out" : "in";
  const matches = (r: (typeof rows)[number]) =>
    [r.subject, r.fromAddr, r.fromName ?? "", r.text ?? "", ...r.toAddrs].some((v) => v.toLowerCase().includes(q));

  const list = [...threads.values()]
    .filter((msgs) => msgs.some((m) => m.direction === want))
    .filter((msgs) => !q || msgs.some(matches))
    .slice(0, 100)
    .map((msgs) => {
      const last = msgs[0];
      const first = msgs[msgs.length - 1];
      // Quem está do outro lado: último remetente recebido ou destinatário do enviado
      const lastIn = msgs.find((m) => m.direction === "in");
      const lastOut = msgs.find((m) => m.direction === "out");
      const people = want === "in" && lastIn
        ? lastIn.fromName || lastIn.fromAddr
        : lastOut
          ? `Para: ${lastOut.toAddrs.join(", ")}`
          : last.fromName || last.fromAddr;
      return {
        threadId: last.threadId,
        subject: first.subject,
        people,
        initialsOf: lastIn ? lastIn.fromName || lastIn.fromAddr : (lastOut?.toAddrs[0] ?? "?"),
        preview: (last.text ?? "").replace(/\s+/g, " ").trim().slice(0, 140),
        count: msgs.length,
        unread: msgs.some((m) => m.direction === "in" && !m.read),
        hasAttachments: msgs.some((m) => m.attachments.length > 0),
        lastAt: last.createdAt,
      };
    });

  const unreadOf = async (owner: SQL) =>
    (
      await db
        .select({ n: countDistinct(mailMessages.threadId) })
        .from(mailMessages)
        .where(and(owner, eq(mailMessages.direction, "in"), eq(mailMessages.read, false)))
    )[0]?.n ?? 0;

  const domain = await mailDomain();
  return NextResponse.json({
    address: mailAddress(u.mailbox, domain),
    admin: u.admin,
    unread: {
      entrada: await unreadOf(ownerOf("entrada")),
      geral: u.admin ? await unreadOf(ownerOf("geral")) : 0,
    },
    threads: list,
  });
}

/** Envia do endereço do usuário: { to, cc?, subject, text, replyToId? } */
export async function POST(req: Request) {
  const off = await mailboxOff();
  if (off) return off;
  const u = await mailUser();
  if (!u) return NextResponse.json({ error: "Faça login." }, { status: 401 });
  if (!(await emailConfigured())) {
    return NextResponse.json({ error: "Envio de e-mail não configurado (Administração › E-mail)." }, { status: 400 });
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

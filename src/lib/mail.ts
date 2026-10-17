import "server-only";
import { getDb } from "@/db";
import {
  contacts,
  mailMessages,
  mailUploads,
  users,
  type MailAttachment,
  type MailMessage,
} from "@/db/schema";
import { deleteFiles, getFile } from "@/lib/blob";
import { getEmailConfig, esc, sendEmail, type EmailAttachment } from "@/lib/notify";
import { and, desc, eq, gt, inArray, isNotNull, isNull, lt, sql } from "drizzle-orm";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

/**
 * Caixa de e-mail de cada usuário, pelo Resend: o envio sai do endereço do usuário no
 * domínio verificado (ex.: fabio@imobiliaria.com.br) e o recebimento chega pelo webhook
 * "email.received" (MX do domínio apontado para o Resend).
 */

/** "fabio.silva" — só o que pode ir antes do @ */
export function cleanMailbox(raw: unknown) {
  return String(raw ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9._-]/g, "")
    .replace(/^[._-]+|[._-]+$/g, "")
    .slice(0, 40);
}

/** Domínio das caixas: o do remetente configurado (verificado no Resend) */
export async function mailDomain() {
  const cfg = await getEmailConfig();
  return cfg.fromEmail.split("@")[1]?.toLowerCase() ?? "";
}

export const mailAddress = (mailbox: string | null | undefined, domain: string) =>
  mailbox && domain ? `${mailbox}@${domain}` : "";

/** "Fulano <a@b.com>" → { name, addr } */
export function parseAddress(raw: string) {
  const m = raw.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  const addr = (m ? m[2] : raw).trim().toLowerCase();
  const name = m?.[1]?.trim() || null;
  return { name, addr };
}

/* ───────────────────────── Conversas ───────────────────────── */

/** Assunto sem "Re:", "RES:", "Fwd:", "ENC:"… para comparar conversas */
export function threadSubject(subject: string) {
  return subject
    .replace(/^\s*((re|res|fw|fwd|enc|tr|aw|wg|rv)\s*(\[\d+\])?\s*:\s*)+/i, "")
    .trim()
    .toLowerCase();
}

/**
 * Conversa de uma mensagem na caixa do dono: primeiro pelos cabeçalhos de resposta
 * (In-Reply-To/References); sem eles, pelo mesmo assunto com a mesma pessoa nos últimos
 * 90 dias. Sem nada, conversa nova.
 */
async function findThread(
  ownerId: string | null,
  refs: string[],
  subject: string,
  counterpart: string,
) {
  const db = await getDb();
  const owner = ownerId ? eq(mailMessages.userId, ownerId) : isNull(mailMessages.userId);
  if (refs.length) {
    const [byRef] = await db
      .select({ threadId: mailMessages.threadId })
      .from(mailMessages)
      .where(and(owner, inArray(mailMessages.messageId, refs)))
      .limit(1);
    if (byRef) return byRef.threadId;
  }
  const norm = threadSubject(subject);
  if (norm && counterpart) {
    const recent = await db
      .select({
        threadId: mailMessages.threadId,
        subject: mailMessages.subject,
        fromAddr: mailMessages.fromAddr,
        toAddrs: mailMessages.toAddrs,
        ccAddrs: mailMessages.ccAddrs,
      })
      .from(mailMessages)
      .where(and(owner, gt(mailMessages.createdAt, new Date(Date.now() - 90 * 86400_000))))
      .orderBy(desc(mailMessages.createdAt))
      .limit(300);
    const hit = recent.find(
      (m) =>
        threadSubject(m.subject) === norm &&
        [m.fromAddr, ...m.toAddrs, ...m.ccAddrs].some((a) => parseAddress(a).addr === counterpart),
    );
    if (hit) return hit.threadId;
  }
  return randomUUID();
}

/* ───────────────────────── Webhook (Standard Webhooks) ───────────────────────── */

/**
 * Confere a assinatura do Resend: HMAC-SHA256 de "id.timestamp.corpo" com o segredo
 * (whsec_<base64>). Aceita os cabeçalhos webhook-* e os antigos svix-*.
 */
export function verifyResendSignature(rawBody: string, headers: Headers, secret: string) {
  const id = headers.get("webhook-id") ?? headers.get("svix-id");
  const ts = headers.get("webhook-timestamp") ?? headers.get("svix-timestamp");
  const sigs = headers.get("webhook-signature") ?? headers.get("svix-signature");
  if (!secret || !id || !ts || !sigs) return false;
  // Rejeita reenvios antigos (mais de 5 min de diferença)
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false;
  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const expected = createHmac("sha256", key).update(`${id}.${ts}.${rawBody}`).digest();
  return sigs.split(" ").some((part) => {
    const [, sig] = part.split(",");
    if (!sig) return false;
    const got = Buffer.from(sig, "base64");
    return got.length === expected.length && timingSafeEqual(got, expected);
  });
}

/* ───────────────────────── API do Resend ───────────────────────── */

async function resendGet<T>(path: string): Promise<T> {
  const { resendApiKey } = await getEmailConfig();
  if (!resendApiKey) throw new Error("Chave do Resend não configurada.");
  const res = await fetch(`https://api.resend.com${path}`, {
    headers: { Authorization: `Bearer ${resendApiKey}` },
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || `Resend: HTTP ${res.status}`);
  return data as T;
}

type ReceivedEmail = {
  id: string;
  from: string;
  to: string[];
  cc: string[] | null;
  received_for?: string[];
  subject: string;
  html: string | null;
  text: string | null;
  headers: Record<string, string> | null;
  message_id: string;
  created_at: string;
  attachments: {
    id: string;
    filename: string | null;
    size: number;
    content_type: string;
    content_disposition: string | null;
  }[];
};

/** Link temporário para baixar um anexo recebido */
export async function receivedAttachmentUrl(emailId: string, attachmentId: string) {
  const a = await resendGet<{ download_url: string }>(
    `/emails/receiving/${encodeURIComponent(emailId)}/attachments/${encodeURIComponent(attachmentId)}`,
  );
  return a.download_url;
}

const header = (h: Record<string, string> | null, name: string) => {
  if (!h) return null;
  const k = Object.keys(h).find((x) => x.toLowerCase() === name);
  return k ? h[k] : null;
};

/**
 * Busca no Resend o e-mail recebido e grava uma cópia na caixa de cada usuário
 * destinatário (sem nenhum, vai para a caixa geral). Idempotente.
 */
export async function ingestReceivedEmail(emailId: string) {
  const email = await resendGet<ReceivedEmail>(`/emails/receiving/${encodeURIComponent(emailId)}`);
  const domain = await mailDomain();
  const db = await getDb();

  const recipients = [...(email.received_for ?? []), ...email.to, ...(email.cc ?? [])].map(
    (r) => parseAddress(r).addr,
  );
  const locals = [
    ...new Set(
      recipients.filter((a) => domain && a.endsWith(`@${domain}`)).map((a) => a.split("@")[0]),
    ),
  ];
  const owners = locals.length
    ? await db
        .select({ id: users.id, mailbox: users.mailbox })
        .from(users)
        .where(and(isNotNull(users.mailbox), eq(users.active, true)))
        .then((rows) => rows.filter((u) => locals.includes(u.mailbox!)).map((u) => u.id))
    : [];

  const from = parseAddress(email.from);
  const [contact] = await db
    .select({ id: contacts.id })
    .from(contacts)
    .where(sql`lower(${contacts.email}) = ${from.addr}`)
    .limit(1);

  const attachments: MailAttachment[] = email.attachments
    .filter((a) => a.content_disposition !== "inline")
    .map((a) => ({
      id: a.id,
      filename: a.filename || "anexo",
      size: a.size,
      contentType: a.content_type,
    }));

  const replyRefs = [
    ...(header(email.headers, "references") ?? "").split(/\s+/),
    header(email.headers, "in-reply-to") ?? "",
  ].filter(Boolean);

  const base = {
    direction: "in" as const,
    fromAddr: from.addr,
    fromName: from.name,
    toAddrs: email.to,
    ccAddrs: email.cc ?? [],
    subject: email.subject ?? "",
    text: email.text,
    html: email.html,
    attachments,
    messageId: email.message_id || header(email.headers, "message-id"),
    inReplyTo: header(email.headers, "in-reply-to"),
    providerId: email.id,
    contactId: contact?.id ?? null,
    createdAt: email.created_at ? new Date(email.created_at) : new Date(),
  };
  const rows = await Promise.all(
    (owners.length ? owners : [null]).map(async (userId) => ({
      ...base,
      userId,
      threadId: await findThread(userId, replyRefs, base.subject, from.addr),
    })),
  );
  await db.insert(mailMessages).values(rows).onConflictDoNothing();
  return rows.length;
}

/* ───────────────────────── Envio ───────────────────────── */

/** Por arquivo e no total do e-mail (o Resend aceita até 40 MB já em base64) */
export const MAIL_ATTACHMENT_MAX = 10 * 1024 * 1024;
export const MAIL_ATTACHMENTS_TOTAL_MAX = 25 * 1024 * 1024;

/** Só anexos que o próprio usuário subiu (email/<id do usuário>/…) */
export function ownAttachments(userId: string, raw: unknown): MailAttachment[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (a) =>
        typeof a?.id === "string" && a.id.startsWith(`email/${userId}/`) && !a.id.includes(".."),
    )
    .slice(0, 10)
    .map((a) => ({
      id: a.id,
      filename: String(a.filename || "anexo").slice(0, 150),
      size: Number(a.size) || 0,
      contentType: String(a.contentType || "application/octet-stream").slice(0, 100),
      access: a.access === "public" ? "public" : "private",
    }));
}

/** Anexos não enviados: registra ao subir, para poder apagar depois */
export async function trackUpload(userId: string, pathname: string, access: string) {
  await (await getDb()).insert(mailUploads).values({ pathname, access, userId }).onConflictDoNothing();
}

/** Apaga anexos ainda não enviados (do próprio usuário) */
export async function discardUploads(userId: string, pathnames: string[]) {
  if (!pathnames.length) return 0;
  const db = await getDb();
  const rows = await db
    .delete(mailUploads)
    .where(and(eq(mailUploads.userId, userId), inArray(mailUploads.pathname, pathnames)))
    .returning();
  await deleteFiles(rows.map((r) => r.pathname));
  return rows.length;
}

/** Anexos esquecidos há mais de 24 h (aba fechada antes de enviar) */
export async function cleanupStaleUploads() {
  const db = await getDb();
  const rows = await db
    .delete(mailUploads)
    .where(
      inArray(
        mailUploads.pathname,
        db
          .select({ p: mailUploads.pathname })
          .from(mailUploads)
          .where(lt(mailUploads.createdAt, new Date(Date.now() - 24 * 3600_000)))
          .limit(100),
      ),
    )
    .returning();
  await deleteFiles(rows.map((r) => r.pathname));
  return rows.length;
}

async function readAttachment(a: MailAttachment): Promise<EmailAttachment> {
  const r = await getFile(a.id, a.access ?? "private");
  if (!r) throw new Error(`Anexo "${a.filename}" não encontrado. Anexe de novo.`);
  const buf = Buffer.from(await new Response(r.stream).arrayBuffer());
  return { filename: a.filename, content: buf.toString("base64") };
}

/** Texto simples → HTML do e-mail (parágrafos e quebras de linha) */
function textToHtml(text: string) {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title></title></head><body style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:14px;line-height:1.55;color:#18181b">${esc(
    text,
  ).replace(/\r?\n/g, "<br>")}</body></html>`;
}

export type OutgoingMail = {
  to: string[];
  cc: string[];
  subject: string;
  text: string;
  /** Mensagem respondida (mesma conversa no cliente de e-mail de quem recebe) */
  replyTo?: MailMessage | null;
  attachments?: MailAttachment[];
};

/** Envia do endereço do usuário e grava em "Enviados" */
export async function sendFromMailbox(
  user: { id: string; name: string; mailbox: string | null },
  mail: OutgoingMail,
) {
  const domain = await mailDomain();
  const from = mailAddress(user.mailbox, domain);
  if (!from) throw new Error("Seu usuário ainda não tem um endereço de e-mail. Peça a um administrador (Equipe & acessos).");

  let quoted = "";
  const headers: Record<string, string> = {};
  if (mail.replyTo) {
    const r = mail.replyTo;
    if (r.messageId) {
      headers["In-Reply-To"] = r.messageId;
      headers["References"] = r.messageId;
    }
    const when = r.createdAt.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
    const original = (r.text ?? "").trim();
    if (original) {
      quoted = `\n\nEm ${when}, ${r.fromName || r.fromAddr} escreveu:\n${original
        .split("\n")
        .map((l) => `> ${l}`)
        .join("\n")}`;
    }
  }
  const body = mail.text + quoted;
  const attachments = mail.attachments ?? [];
  if (attachments.reduce((n, a) => n + a.size, 0) > MAIL_ATTACHMENTS_TOTAL_MAX) {
    throw new Error("Os anexos passam de 25 MB no total.");
  }
  const files = await Promise.all(attachments.map(readAttachment));

  const providerId = await sendEmail(mail.to, mail.subject, textToHtml(body), {
    fromName: user.name,
    fromAddress: from,
    cc: mail.cc,
    text: body,
    headers: Object.keys(headers).length ? headers : undefined,
    attachments: files,
  });

  const db = await getDb();
  const first = parseAddress(mail.to[0] ?? "").addr;
  const threadId = mail.replyTo?.threadId ?? (await findThread(user.id, [], mail.subject, first));
  const [contact] = first
    ? await db.select({ id: contacts.id }).from(contacts).where(sql`lower(${contacts.email}) = ${first}`).limit(1)
    : [];
  const [row] = await db
    .insert(mailMessages)
    .values({
      userId: user.id,
      direction: "out",
      fromAddr: from,
      fromName: user.name,
      toAddrs: mail.to,
      ccAddrs: mail.cc,
      subject: mail.subject,
      text: body,
      attachments,
      inReplyTo: mail.replyTo?.messageId ?? null,
      threadId,
      providerId,
      contactId: contact?.id ?? null,
      read: true,
      sentBy: user.name,
    })
    .returning();
  // Enviados: os anexos agora são do histórico, não são mais rascunho
  if (attachments.length) {
    await db.delete(mailUploads).where(
      and(
        eq(mailUploads.userId, user.id),
        inArray(
          mailUploads.pathname,
          attachments.map((a) => a.id),
        ),
      ),
    );
  }
  return row;
}

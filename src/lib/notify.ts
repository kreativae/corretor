import "server-only";
import { getDb } from "@/db";
import { settings } from "@/db/schema";
import { TYPE_LABELS } from "@/lib/labels";
import { getWhiteLabel } from "@/lib/queries";
import { onAccentColor } from "@/lib/utils";
import { eq } from "drizzle-orm";
import { getMessages } from "@/lib/features";
import { fillMessage, MESSAGE_DEFAULTS } from "@/lib/messages";
import { siteBaseUrl } from "@/lib/tenant";

/**
 * E-mails via Resend (https://resend.com): avisos de novos leads e envios da Negociação.
 * Chave e remetente ficam em Configurações › Avisos de novos leads; as variáveis
 * RESEND_API_KEY / LEADS_FROM_EMAIL da Vercel valem como reserva.
 */

export type NotifySettings = { leadEmails: string; enabled: boolean };
const DEFAULTS: NotifySettings = { leadEmails: "", enabled: true };

/** Conta do Resend */
export type EmailConfig = { resendApiKey: string; fromEmail: string; fromName: string };

export async function getEmailConfig(): Promise<EmailConfig> {
  let saved: Partial<EmailConfig> = {};
  try {
    const [row] = await (await getDb()).select().from(settings).where(eq(settings.key, "email"));
    saved = (row?.value ?? {}) as Partial<EmailConfig>;
  } catch {
    /* sem banco: só variáveis */
  }
  const envFrom = process.env.LEADS_FROM_EMAIL ?? "";
  return {
    resendApiKey: saved.resendApiKey || process.env.RESEND_API_KEY || "",
    fromEmail: saved.fromEmail || envFrom.match(/<([^>]+)>/)?.[1] || envFrom,
    fromName: saved.fromName || envFrom.match(/^([^<]+)</)?.[1]?.trim() || "",
  };
}

export async function saveEmailConfig(input: Partial<EmailConfig>) {
  const cur = await getEmailConfig();
  const str = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);
  const key = str(input.resendApiKey, 200);
  const fromEmail = str(input.fromEmail, 200).toLowerCase();
  const next: EmailConfig = {
    // Vazio ou mascarado mantém a atual; "-" apaga
    resendApiKey: key === "-" ? "" : !key || key.includes("•") ? cur.resendApiKey : key,
    fromEmail: /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(fromEmail) ? fromEmail : "",
    fromName: str(input.fromName, 80).replace(/[<>"]/g, ""),
  };
  const [row] = await (await getDb()).select().from(settings).where(eq(settings.key, "email"));
  if (row) await (await getDb()).update(settings).set({ value: next }).where(eq(settings.key, "email"));
  else await (await getDb()).insert(settings).values({ key: "email", value: next });
  return next;
}

export const maskKey = (s: string) => (s ? `${s.slice(0, 3)}${"•".repeat(8)}${s.slice(-4)}` : "");

export async function getNotifySettings(): Promise<NotifySettings> {
  try {
    const [row] = await (await getDb()).select().from(settings).where(eq(settings.key, "notifications"));
    return { ...DEFAULTS, ...((row?.value ?? {}) as Partial<NotifySettings>) };
  } catch {
    return DEFAULTS;
  }
}

/** "a@x.com, b@y.com" → lista válida e sem repetição */
export function parseEmails(raw: string) {
  return [
    ...new Set(
      raw
        .split(/[,;\s]+/)
        .map((e) => e.trim().toLowerCase())
        .filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)),
    ),
  ].slice(0, 10);
}

export async function emailConfigured() {
  return !!(await getEmailConfig()).resendApiKey;
}

export type EmailAttachment = { filename: string; content: string /* base64 */ };

/** Envia pelo Resend; devolve o id da mensagem. */
export async function sendEmail(
  to: string[],
  subject: string,
  html: string,
  extra: { replyTo?: string; attachments?: EmailAttachment[]; fromName?: string } = {},
) {
  const [cfg, wl] = await Promise.all([getEmailConfig(), getWhiteLabel()]);
  const key = cfg.resendApiKey;
  if (!key) throw new Error("Chave do Resend não configurada (Configurações › Avisos de novos leads).");
  let from = `${(cfg.fromName || wl.orgName).replace(/[<>"]/g, "")} <${cfg.fromEmail || "onboarding@resend.dev"}>`;
  // Nome de exibição do remetente (ex.: corretor), mantendo o endereço verificado
  if (extra.fromName) {
    const addr = from.match(/<([^>]+)>/)?.[1] ?? from;
    from = `${extra.fromName.replace(/[<>"]/g, "")} <${addr}>`;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to,
      subject,
      html,
      ...(extra.replyTo ? { reply_to: extra.replyTo } : {}),
      ...(extra.attachments?.length ? { attachments: extra.attachments } : {}),
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || `Resend: HTTP ${res.status}`);
  return (data?.id as string | undefined) ?? null;
}

/** Links dos e-mails no domínio oficial do site, o mesmo do remetente, e não no domínio por
 * onde o sistema foi acessado: domínios diferentes no mesmo e-mail pesam no filtro de spam. */
export async function emailBaseUrl(wlDomain: string, fallback: string) {
  try {
    return await siteBaseUrl(wlDomain, fallback);
  } catch {
    return fallback;
  }
}

export const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export type LeadNotice = {
  contactId: string;
  name: string;
  phone: string;
  email?: string | null;
  interest?: string | null;
  message?: string | null;
  /** Ex.: "Formulário do site", "Visita agendada pelo site" */
  origin: string;
  /** Detalhe extra, ex.: imóvel e horário da visita */
  detail?: string | null;
  /** https://dominio-do-sistema */
  baseUrl: string;
  returning?: boolean;
};

function leadHtml(n: LeadNotice, orgName: string, accent: string, onAccent: string, footer = MESSAGE_DEFAULTS.leadFooter) {
  const digits = n.phone.replace(/\D/g, "");
  const wa = `https://wa.me/${digits.startsWith("55") ? digits : `55${digits}`}`;
  const rows: [string, string][] = [
    ["WhatsApp", n.phone],
    ...(n.email ? [["E-mail", n.email] as [string, string]] : []),
    ...(n.interest ? [["Interesse", TYPE_LABELS[n.interest] ?? n.interest] as [string, string]] : []),
    ...(n.detail ? [["Detalhe", n.detail] as [string, string]] : []),
    ["Origem", n.origin],
  ];
  return `<!doctype html><html><body style="margin:0;background:#f4f4f5;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#18181b">
<div style="max-width:520px;margin:24px auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e4e4e7">
  <div style="padding:20px 24px;border-bottom:1px solid #e4e4e7">
    <p style="margin:0;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#71717a">${esc(orgName)} · ${n.returning ? "Lead retornou" : "Novo lead"}</p>
    <h1 style="margin:8px 0 0;font-size:22px">${esc(n.name)}</h1>
  </div>
  <table style="width:100%;border-collapse:collapse;font-size:14px">
    ${rows
      .map(
        ([k, v]) =>
          `<tr><td style="padding:10px 24px;color:#71717a;width:110px;border-bottom:1px solid #f4f4f5">${esc(k)}</td><td style="padding:10px 24px;border-bottom:1px solid #f4f4f5">${esc(v)}</td></tr>`,
      )
      .join("")}
  </table>
  ${n.message ? `<div style="margin:16px 24px;padding:14px;background:#f4f4f5;border-radius:12px;font-size:14px;line-height:1.5;white-space:pre-wrap">${esc(n.message)}</div>` : ""}
  <div style="padding:16px 24px 24px">
    <a href="${n.baseUrl}/crm/contatos/${n.contactId}" style="display:inline-block;background:${accent};color:${onAccent};text-decoration:none;font-weight:600;font-size:14px;padding:12px 20px;border-radius:999px;margin:0 8px 8px 0">Abrir no CRM</a>
    <a href="${wa}" style="display:inline-block;background:#18181b;color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 20px;border-radius:999px">Responder no WhatsApp</a>
  </div>
</div>
${footer ? `<p style="text-align:center;font-size:11px;color:#a1a1aa">${esc(footer)}</p>` : ""}
</body></html>`;
}

/** Envia o aviso; nunca lança erro (não pode derrubar a captura do lead). */
export async function notifyNewLead(n: LeadNotice) {
  try {
    const [cfg, wl, msgs] = await Promise.all([getNotifySettings(), getWhiteLabel(), getMessages()]);
    if (!cfg.enabled || !(await emailConfigured())) return;
    const to = parseEmails(cfg.leadEmails || wl.email);
    if (!to.length) return;
    const subject = fillMessage(n.returning ? msgs.leadReturnSubject : msgs.leadSubject, {
      nome: n.name,
      interesse: n.interest ? (TYPE_LABELS[n.interest] ?? n.interest) : "",
      origem: n.origin,
    });
    const baseUrl = await emailBaseUrl(wl.domain, n.baseUrl);
    await sendEmail(to, subject, leadHtml({ ...n, baseUrl }, wl.orgName, wl.accent, onAccentColor(wl.accent, wl.onAccent), msgs.leadFooter));
  } catch (e) {
    console.error("[aviso de lead]", e);
  }
}

/** E-mail de teste (Configurações) — aqui o erro sobe para a tela. */
export async function sendTestEmail(baseUrl: string) {
  const [cfg, wl] = await Promise.all([getNotifySettings(), getWhiteLabel()]);
  const to = parseEmails(cfg.leadEmails || wl.email);
  if (!to.length) throw new Error("Informe ao menos um e-mail de destino e salve.");
  await sendEmail(
    to,
    "Teste: avisos de novos leads",
    leadHtml(
      {
        contactId: "",
        name: "Lead de teste",
        phone: "5543999999999",
        email: "cliente@exemplo.com",
        interest: "fazenda",
        message: "Este é um e-mail de teste. Os avisos de novos leads estão funcionando.",
        origin: "Teste em Configurações",
        baseUrl: await emailBaseUrl(wl.domain, baseUrl),
      },
      wl.orgName,
      wl.accent,
      onAccentColor(wl.accent, wl.onAccent),
    ),
  );
  return to;
}

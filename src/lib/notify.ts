import "server-only";
import { db } from "@/db";
import { settings } from "@/db/schema";
import { TYPE_LABELS } from "@/lib/labels";
import { getWhiteLabel } from "@/lib/queries";
import { eq } from "drizzle-orm";

/**
 * Avisos por e-mail de novos leads, via Resend (https://resend.com).
 * Requer RESEND_API_KEY na Vercel. Remetente: LEADS_FROM_EMAIL
 * (domínio verificado no Resend) ou o remetente de testes do Resend.
 */

export type NotifySettings = { leadEmails: string };
const DEFAULTS: NotifySettings = { leadEmails: "" };

export async function getNotifySettings(): Promise<NotifySettings> {
  try {
    const [row] = await db.select().from(settings).where(eq(settings.key, "notifications"));
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

export function emailConfigured() {
  return !!process.env.RESEND_API_KEY;
}

async function sendEmail(to: string[], subject: string, html: string) {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY não configurada na Vercel.");
  const wl = await getWhiteLabel();
  const from = process.env.LEADS_FROM_EMAIL || `${wl.orgName} <onboarding@resend.dev>`;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to, subject, html }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.message || `Resend: HTTP ${res.status}`);
  }
}

const esc = (s: string) =>
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

function leadHtml(n: LeadNotice, orgName: string, accent: string) {
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
    <a href="${n.baseUrl}/crm/contatos/${n.contactId}" style="display:inline-block;background:${accent};color:#1c1c45;text-decoration:none;font-weight:600;font-size:14px;padding:12px 20px;border-radius:999px;margin:0 8px 8px 0">Abrir no CRM</a>
    <a href="${wa}" style="display:inline-block;background:#18181b;color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 20px;border-radius:999px">Responder no WhatsApp</a>
  </div>
</div>
<p style="text-align:center;font-size:11px;color:#a1a1aa">Aviso automático do CRM — altere os destinatários em Admin → Configurações.</p>
</body></html>`;
}

/** Envia o aviso; nunca lança erro (não pode derrubar a captura do lead). */
export async function notifyNewLead(n: LeadNotice) {
  try {
    if (!emailConfigured()) return;
    const [cfg, wl] = await Promise.all([getNotifySettings(), getWhiteLabel()]);
    const to = parseEmails(cfg.leadEmails || wl.email);
    if (!to.length) return;
    const subject = `${n.returning ? "Lead retornou" : "Novo lead"}: ${n.name}${n.interest && TYPE_LABELS[n.interest] ? ` · ${TYPE_LABELS[n.interest]}` : ""}`;
    await sendEmail(to, subject, leadHtml(n, wl.orgName, wl.accent));
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
        baseUrl,
      },
      wl.orgName,
      wl.accent,
    ),
  );
  return to;
}

import "server-only";
import { esc } from "@/lib/notify";
import { fillMessage, MESSAGE_DEFAULTS, type Messages } from "@/lib/messages";
import { TYPE_LABELS } from "@/lib/labels";
import type { PropertyWithImages, WhiteLabel } from "@/lib/queries";
import { formatAlq, isRuralType, normalizeRural } from "@/lib/rural";
import { formatBRL, formatNumber, formatPhone, onAccentColor, siteImage } from "@/lib/utils";

/** Linha de características: "3 quartos · 2 vagas · 120 m²" ou "45 alq" */
function specs(p: PropertyWithImages) {
  if (isRuralType(p.type)) {
    const r = normalizeRural(p.rural);
    return [r.totalAlq ? `${formatAlq(r.totalAlq)} alqueires` : null].filter(Boolean).join(" · ");
  }
  return [
    p.bedrooms ? `${p.bedrooms} ${p.bedrooms === 1 ? "quarto" : "quartos"}` : null,
    p.suites ? `${p.suites} ${p.suites === 1 ? "suíte" : "suítes"}` : null,
    p.garage ? `${p.garage} ${p.garage === 1 ? "vaga" : "vagas"}` : null,
    p.area ? `${formatNumber(p.area)} m²` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

/** E-mail com a seleção de imóveis para o cliente (HTML com estilos inline). */
export function selectionEmailHtml(opts: {
  wl: WhiteLabel;
  baseUrl: string;
  toName: string;
  message: string;
  properties: PropertyWithImages[];
  /** Assinatura com os dados da página Equipe: nome, cargo e WhatsApp */
  broker: { name: string; title?: string | null; phone?: string | null };
  attached: boolean;
  msgs?: Messages;
}) {
  const m = opts.msgs ?? MESSAGE_DEFAULTS;
  const { wl, baseUrl, properties, broker } = opts;
  const accent = wl.accent || "#F47525";
  const onAccent = onAccentColor(accent, wl.onAccent);
  // Arquivos do próprio sistema (/api/...) sempre no domínio do e-mail: foto salva com o
  // endereço antigo (ex.: corretor.kreativ.ae) é domínio misturado, que pesa no filtro de spam
  const abs = (u: string) => {
    if (!u.startsWith("http")) return `${baseUrl}${u}`;
    try {
      const url = new URL(u);
      if (url.pathname.startsWith("/api/")) return `${baseUrl}${url.pathname}${url.search}`;
    } catch {
      /* endereço inválido: usa como veio */
    }
    return u;
  };
  const digits = (broker.phone || wl.phone || "").replace(/\D/g, "");
  const wa = digits ? `https://wa.me/${digits.startsWith("55") ? digits : `55${digits}`}` : "";
  const first = opts.toName.trim().split(/\s+/)[0] || "";
  const greeting = first ? fillMessage(m.selGreeting, { nome: opts.toName.trim(), primeiro_nome: first }) : "";

  const cards = properties
    .map((p) => {
      const img = p.cover ? abs(siteImage(p.cover, p.wm)!) : "";
      const place = [p.neighborhood, p.city].filter(Boolean).join(", ");
      const page = `${baseUrl}/imoveis/${p.code}`;
      const ficha = `${page}/ficha`;
      return `<tr><td style="padding:0 0 16px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e4e4ec;border-radius:14px;overflow:hidden;background:#fff">
    ${img ? `<tr><td><a href="${p.published ? page : ficha}"><img src="${esc(img)}" alt="${esc(p.title)}" width="560" style="display:block;width:100%;height:auto;max-height:300px;object-fit:cover;border:0"></a></td></tr>` : ""}
    <tr><td style="padding:16px 18px 18px">
      <p style="margin:0;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#7a7a90">${esc(TYPE_LABELS[p.type] ?? p.type)} · ${esc(p.code)}</p>
      <p style="margin:6px 0 2px;font-size:17px;font-weight:700;color:#2B2B5D">${esc(p.title)}</p>
      ${place ? `<p style="margin:0;font-size:13px;color:#5b5b70">${esc(place)}</p>` : ""}
      ${specs(p) ? `<p style="margin:8px 0 0;font-size:13px;color:#5b5b70">${esc(specs(p))}</p>` : ""}
      <p style="margin:12px 0 14px;font-size:20px;font-weight:700;color:#2B2B5D">${esc(formatBRL(p.price))}${p.purpose === "aluguel" ? '<span style="font-size:13px;font-weight:400;color:#7a7a90"> /mês</span>' : ""}</p>
      ${p.published ? `<a href="${page}" style="display:inline-block;background:${accent};color:${onAccent};text-decoration:none;font-weight:600;font-size:13px;padding:10px 16px;border-radius:999px;margin:0 6px 6px 0">${esc(m.selBtnDetails)}</a>` : ""}
      <a href="${ficha}" style="display:inline-block;background:#2B2B5D;color:#fff;text-decoration:none;font-weight:600;font-size:13px;padding:10px 16px;border-radius:999px;margin:0 6px 6px 0">${esc(m.selBtnFicha)}</a>
    </td></tr>
  </table>
</td></tr>`;
    })
    .join("");

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(wl.orgName)}</title></head><body style="margin:0;background:#f1f1f6;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#1c1c30">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px">
  <tr><td style="padding:0 4px 18px">
    ${wl.logoUrl ? `<img src="${esc(abs(wl.logoUrl))}" alt="${esc(wl.orgName)}" height="40" style="display:block;height:40px;width:auto;border:0">` : `<p style="margin:0;font-size:18px;font-weight:700;color:#2B2B5D">${esc(wl.orgName)}</p>`}
  </td></tr>
  <tr><td style="background:#fff;border-radius:16px;padding:24px 22px 8px">
    ${greeting ? `<p style="margin:0 0 12px;font-size:16px;font-weight:600">${esc(greeting)}</p>` : ""}
    ${opts.message ? `<p style="margin:0 0 20px;font-size:15px;line-height:1.6;white-space:pre-wrap">${esc(opts.message)}</p>` : ""}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${cards}</table>
    ${opts.attached && m.selAttachNote ? `<p style="margin:0 0 16px;font-size:13px;color:#5b5b70">${esc(m.selAttachNote)}</p>` : ""}
  </td></tr>
  <tr><td style="padding:18px 6px;font-size:13px;line-height:1.6;color:#5b5b70">
    <strong style="color:#2B2B5D">${esc(broker.name)}</strong><br>
    ${esc([broker.title?.trim(), wl.orgName].filter(Boolean).join(" · "))}<br>
    ${digits ? `<a href="${wa}" style="color:${accent};text-decoration:none;font-weight:600">WhatsApp ${esc(formatPhone(digits))}</a>` : ""}
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
}

/** Parceiros: rótulos, cálculo de comissão e saneamento de dados (sem acesso ao banco). */

export const PARTNER_WATERMARK = {
  padrao: "Padrão do site (Configurações)",
  logo: "Só o logotipo",
  linhas: "Sem logotipo (só linhas)",
  nenhuma: "Sem marca d'água",
} as const;
export type PartnerWatermark = keyof typeof PARTNER_WATERMARK;

/** Sobre o que o imposto incide */
export const TAX_BASE = {
  total: "Comissão inteira (antes do repasse)",
  ours: "Só a parte da imobiliária",
} as const;
export type TaxBase = keyof typeof TAX_BASE;
const taxBase = (v: unknown): TaxBase => (v === "ours" ? "ours" : "total");

const pct = (v: unknown) => {
  if (v === null || v === "" || v === undefined) return null;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) && n >= 0 && n <= 100 ? Math.round(n * 100) / 100 : null;
};
const txt = (v: unknown, max: number) => {
  const s = String(v ?? "").trim().slice(0, max);
  return s || null;
};

/** Cadastro de parceiro vindo de formulário/API. */
export function sanitizePartner(input: Record<string, unknown>) {
  const wm = String(input?.watermark ?? "padrao");
  return {
    name: String(input?.name ?? "").trim().slice(0, 120),
    company: txt(input?.company, 120),
    phone: txt(input?.phone, 30),
    email: txt(input?.email, 160)?.toLowerCase() ?? null,
    creci: txt(input?.creci, 40),
    commissionPct: pct(input?.commissionPct),
    partnerSharePct: pct(input?.partnerSharePct),
    taxPct: pct(input?.taxPct),
    taxBase: taxBase(input?.taxBase),
    watermark: (wm in PARTNER_WATERMARK ? wm : "padrao") as PartnerWatermark,
    notes: txt(input?.notes, 2000),
  };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Campos de parceria do imóvel (mantém só o que veio no corpo). */
export function sanitizePropertyPartnerFields(body: Record<string, unknown>) {
  const out: {
    partnerId?: string | null;
    commissionPct?: number | null;
    partnerSharePct?: number | null;
    taxPct?: number | null;
    taxBase?: TaxBase | null;
  } = {};
  if ("partnerId" in body) {
    const id = String(body.partnerId ?? "");
    out.partnerId = UUID.test(id) ? id : null;
  }
  if ("commissionPct" in body) out.commissionPct = pct(body.commissionPct);
  if ("partnerSharePct" in body) out.partnerSharePct = pct(body.partnerSharePct);
  if ("taxPct" in body) out.taxPct = pct(body.taxPct);
  if ("taxBase" in body) out.taxBase = body.taxBase == null || body.taxBase === "" ? null : taxBase(body.taxBase);
  return out;
}

/**
 * Comissão em reais: total, imposto, repasse ao parceiro e o que fica (líquido).
 * Imposto "total": sai da comissão inteira antes da divisão (o repasse é sobre o
 * líquido). Imposto "ours": cada um paga o seu; incide só sobre a parte da imobiliária.
 */
export function commissionValues(
  price: number,
  commissionPct?: number | null,
  partnerSharePct?: number | null,
  taxPct?: number | null,
  base: TaxBase | null = "total",
) {
  const total = commissionPct != null ? (price * commissionPct) / 100 : null;
  if (total == null) return { total, tax: null, partner: null, ours: null, taxBase: base ?? "total" };
  const share = partnerSharePct != null ? partnerSharePct / 100 : null;
  const rate = taxPct != null ? taxPct / 100 : null;
  if ((base ?? "total") === "total") {
    const tax = rate != null ? total * rate : null;
    const net = total - (tax ?? 0);
    const partner = share != null ? net * share : null;
    return { total, tax, partner, ours: net - (partner ?? 0), taxBase: "total" as TaxBase };
  }
  const partner = share != null ? total * share : null;
  const gross = total - (partner ?? 0);
  const tax = rate != null ? gross * rate : null;
  return { total, tax, partner, ours: gross - (tax ?? 0), taxBase: "ours" as TaxBase };
}

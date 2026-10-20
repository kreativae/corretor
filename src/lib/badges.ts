/** Selos (badges) do card do imóvel no site: estilos em Configurações › Selos, escolha no imóvel. */

export type BadgeDef = {
  id: string;
  label: string;
  /** Cor de fundo e do texto (#rrggbb) */
  bg: string;
  fg: string;
};

export type BadgeSettings = {
  /** Desligado: nenhum selo aparece no site (o que foi escolhido nos imóveis fica guardado) */
  enabled: boolean;
  items: BadgeDef[];
  /** Mostrar também na página do imóvel, ao lado do título */
  onDetail: boolean;
  /** Imóvel em destaque sem selo ganha o selo "Destaque" */
  featuredAuto: boolean;
};

export const FEATURED_BADGE: BadgeDef = { id: "destaque", label: "Destaque", bg: "#F47525", fg: "#FFFFFF" };

export const BADGE_DEFAULTS: BadgeSettings = {
  enabled: true,
  onDetail: true,
  featuredAuto: false,
  items: [
    FEATURED_BADGE,
    { id: "exclusivo", label: "Exclusivo", bg: "#2B2B5D", fg: "#FFFFFF" },
    { id: "lancamento", label: "Lançamento", bg: "#7C3AED", fg: "#FFFFFF" },
    { id: "oportunidade", label: "Oportunidade", bg: "#15803D", fg: "#FFFFFF" },
    { id: "novo_preco", label: "Baixou o preço", bg: "#DC2626", fg: "#FFFFFF" },
    { id: "pronto", label: "Pronto para morar", bg: "#0E7490", fg: "#FFFFFF" },
    { id: "ultimas", label: "Últimas unidades", bg: "#B45309", fg: "#FFFFFF" },
  ],
};

const HEX = /^#[0-9a-f]{6}$/i;

export function sanitizeBadges(input: Record<string, unknown>): BadgeSettings {
  const raw = Array.isArray(input.items) ? (input.items as Partial<BadgeDef>[]) : BADGE_DEFAULTS.items;
  const seen = new Set<string>();
  const items: BadgeDef[] = [];
  for (const b of raw.slice(0, 24)) {
    const label = String(b?.label ?? "").trim().slice(0, 32);
    let id = String(b?.id ?? "").trim().toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 32);
    if (!label) continue;
    if (!id) id = `selo-${items.length + 1}`;
    while (seen.has(id)) id = `${id}-2`;
    seen.add(id);
    items.push({
      id,
      label,
      bg: HEX.test(String(b?.bg)) ? String(b!.bg) : "#2B2B5D",
      fg: HEX.test(String(b?.fg)) ? String(b!.fg) : "#FFFFFF",
    });
  }
  return {
    enabled: input.enabled !== false,
    onDetail: input.onDetail !== false,
    featuredAuto: input.featuredAuto === true,
    items,
  };
}

export type BadgeView = { label: string; bg: string; fg: string };

/** Selo que o imóvel mostra no site (ou null) */
export function resolveBadge(
  p: { badge?: string | null; badgeLabel?: string | null; featured?: boolean },
  s: BadgeSettings,
): BadgeView | null {
  if (!s.enabled) return null;
  const def = p.badge ? s.items.find((b) => b.id === p.badge) : null;
  if (def) return { label: p.badgeLabel?.trim() || def.label, bg: def.bg, fg: def.fg };
  if (p.featured && s.featuredAuto) {
    const f = s.items.find((b) => b.id === FEATURED_BADGE.id) ?? FEATURED_BADGE;
    return { label: f.label, bg: f.bg, fg: f.fg };
  }
  return null;
}

/** Campos de destaque/selo vindos do formulário do imóvel (só valores válidos) */
export function cleanPropertyBadge(data: Record<string, unknown>) {
  if ("featured" in data) data.featured = data.featured === true;
  if ("badge" in data) data.badge = String(data.badge ?? "").trim().toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 32) || null;
  if ("badgeLabel" in data) data.badgeLabel = String(data.badgeLabel ?? "").trim().slice(0, 32) || null;
}

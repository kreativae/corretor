/** Cards de indicadores por página do CRM (ligados em Configurações). */
export const STAT_CARD_PAGES = [
  { key: "overview", label: "Visão geral", path: "/crm" },
  { key: "imoveis", label: "Imóveis", path: "/crm/imoveis" },
  { key: "rurais", label: "Propriedades rurais", path: "/crm/propriedades" },
  { key: "terrenos", label: "Terrenos", path: "/crm/terrenos" },
  { key: "pipeline", label: "Pipeline", path: "/crm/pipeline" },
  { key: "contatos", label: "Contatos", path: "/crm/contatos" },
  { key: "agenda", label: "Agenda", path: "/crm/agenda" },
  { key: "fechados", label: "Negócios fechados", path: "/crm/fechados" },
] as const;

export type StatCardKey = (typeof STAT_CARD_PAGES)[number]["key"];
/** aberto = cards visíveis · minimizado = recolhidos, abre com um clique · oculto = não aparecem */
export type StatCardMode = "aberto" | "minimizado" | "oculto";
export type StatCards = Record<StatCardKey, StatCardMode>;

export const STAT_CARD_MODES: { id: StatCardMode; label: string }[] = [
  { id: "aberto", label: "Aberto" },
  { id: "minimizado", label: "Minimizado" },
  { id: "oculto", label: "Oculto" },
];

export const STAT_CARDS_DEFAULTS: StatCards = {
  overview: "minimizado",
  imoveis: "minimizado",
  rurais: "minimizado",
  terrenos: "minimizado",
  pipeline: "minimizado",
  contatos: "minimizado",
  agenda: "minimizado",
  fechados: "minimizado",
};

/** Mantém só páginas conhecidas. Formato antigo: ligado vira minimizado, desligado vira oculto. */
export function sanitizeStatCards(input: Record<string, unknown>): StatCards {
  const out = { ...STAT_CARDS_DEFAULTS };
  for (const k of Object.keys(out) as StatCardKey[]) {
    const v = input?.[k];
    if (v === true) out[k] = "minimizado";
    else if (v === false) out[k] = "oculto";
    else if (v === "aberto" || v === "minimizado" || v === "oculto") out[k] = v;
  }
  return out;
}

/** Página da lista (não os detalhes) que corresponde ao caminho atual. */
export function statCardKeyFor(pathname: string | null): StatCardKey | null {
  const path = (pathname ?? "").replace(/\/$/, "") || "/";
  return STAT_CARD_PAGES.find((p) => p.path === path)?.key ?? null;
}

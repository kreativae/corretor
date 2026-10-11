/** Cards de indicadores por página do CRM (ligados em Configurações). */
export const STAT_CARD_PAGES = [
  { key: "overview", label: "Visão geral", path: "/crm" },
  { key: "imoveis", label: "Imóveis", path: "/crm/imoveis" },
  { key: "rurais", label: "Propriedades rurais", path: "/crm/propriedades" },
  { key: "pipeline", label: "Pipeline", path: "/crm/pipeline" },
  { key: "contatos", label: "Contatos", path: "/crm/contatos" },
  { key: "agenda", label: "Agenda", path: "/crm/agenda" },
] as const;

export type StatCardKey = (typeof STAT_CARD_PAGES)[number]["key"];
export type StatCards = Record<StatCardKey, boolean>;

export const STAT_CARDS_DEFAULTS: StatCards = {
  overview: true,
  imoveis: true,
  rurais: true,
  pipeline: true,
  contatos: true,
  agenda: true,
};

/** Mantém só páginas conhecidas, como booleano. */
export function sanitizeStatCards(input: Record<string, unknown>): StatCards {
  const out = { ...STAT_CARDS_DEFAULTS };
  for (const k of Object.keys(out) as StatCardKey[]) {
    if (typeof input?.[k] === "boolean") out[k] = input[k] as boolean;
  }
  return out;
}

/** Página da lista (não os detalhes) que corresponde ao caminho atual. */
export function statCardKeyFor(pathname: string | null): StatCardKey | null {
  const path = (pathname ?? "").replace(/\/$/, "") || "/";
  return STAT_CARD_PAGES.find((p) => p.path === path)?.key ?? null;
}

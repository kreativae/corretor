/** Filtros da visão geral do CRM — vivem na URL para o servidor recalcular. */

export type OverviewFilters = {
  seg: "todos" | "imoveis" | "rurais";
  periodo: "7" | "30" | "90" | "365" | "all" | "custom";
  de: string;
  ate: string;
  origem: string[];
  tipo: string[];
  bairro: string[];
  cidade: string[];
  finalidade: "" | "venda" | "aluguel";
};

export const DEFAULT_OVERVIEW: OverviewFilters = {
  seg: "todos",
  periodo: "30",
  de: "",
  ate: "",
  origem: [],
  tipo: [],
  bairro: [],
  cidade: [],
  finalidade: "",
};

export const OVERVIEW_PERIODS: { id: OverviewFilters["periodo"]; label: string }[] = [
  { id: "7", label: "7 dias" },
  { id: "30", label: "30 dias" },
  { id: "90", label: "90 dias" },
  { id: "365", label: "12 meses" },
  { id: "all", label: "Tudo" },
  { id: "custom", label: "Período" },
];

type Params = Record<string, string | string[] | undefined>;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const list = (v: string | string[] | undefined) =>
  one(v)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);

export function parseOverview(sp: Params): OverviewFilters {
  const seg = one(sp.seg);
  const periodo = one(sp.periodo);
  const fin = one(sp.finalidade);
  return {
    seg: seg === "imoveis" || seg === "rurais" ? seg : "todos",
    periodo: OVERVIEW_PERIODS.some((p) => p.id === periodo)
      ? (periodo as OverviewFilters["periodo"])
      : "30",
    de: isDate(one(sp.de)) ? one(sp.de) : "",
    ate: isDate(one(sp.ate)) ? one(sp.ate) : "",
    origem: list(sp.origem),
    tipo: list(sp.tipo),
    bairro: list(sp.bairro),
    cidade: list(sp.cidade),
    finalidade: fin === "venda" || fin === "aluguel" ? fin : "",
  };
}

export function overviewQuery(f: OverviewFilters): string {
  const q = new URLSearchParams();
  if (f.seg !== "todos") q.set("seg", f.seg);
  if (f.periodo !== "30") q.set("periodo", f.periodo);
  if (f.periodo === "custom") {
    if (f.de) q.set("de", f.de);
    if (f.ate) q.set("ate", f.ate);
  }
  if (f.origem.length) q.set("origem", f.origem.join(","));
  if (f.tipo.length) q.set("tipo", f.tipo.join(","));
  if (f.bairro.length) q.set("bairro", f.bairro.join(","));
  if (f.cidade.length) q.set("cidade", f.cidade.join(","));
  if (f.finalidade) q.set("finalidade", f.finalidade);
  return q.toString();
}

/** Intervalo [início, fim] do período em ms (null = sem limite) */
export function overviewRange(f: OverviewFilters, now: number): [number | null, number | null] {
  if (f.periodo === "all") return [null, null];
  if (f.periodo === "custom")
    return [
      f.de ? new Date(`${f.de}T00:00:00-03:00`).getTime() : null,
      f.ate ? new Date(`${f.ate}T23:59:59-03:00`).getTime() : null,
    ];
  return [now - Number(f.periodo) * 86_400_000, null];
}

export function overviewPeriodLabel(f: OverviewFilters) {
  if (f.periodo === "all") return "desde o início";
  if (f.periodo === "custom") {
    const fmt = (d: string) => d.split("-").reverse().join("/");
    return `${f.de ? fmt(f.de) : "início"} a ${f.ate ? fmt(f.ate) : "hoje"}`;
  }
  return `últimos ${OVERVIEW_PERIODS.find((p) => p.id === f.periodo)?.label}`;
}

"use client";

import { FilterChip, FilterGroup, type ActiveChip } from "@/components/crm/filter-sheet";
import { Input } from "@/components/ui";
import {
  CONTACT_TYPE_LABELS,
  DEAL_STAGES,
  DEAL_STAGE_LABELS,
  PURPOSE_LABELS,
  SOURCE_LABELS,
  TYPE_LABELS,
} from "@/lib/labels";
import type { DealFull } from "@/lib/queries";
import { isRuralType } from "@/lib/rural";
import { formatCompact } from "@/lib/utils";
import { Building2, Tractor } from "lucide-react";

export type DealFilters = {
  q: string;
  stages: string[];
  propertyTypes: string[];
  noProperty: boolean;
  purpose: "all" | "venda" | "aluguel";
  valueFrom: string;
  valueTo: string;
  neighborhoods: string[];
  cities: string[];
  sources: string[];
  contactTypes: string[];
  period: "all" | "7" | "30" | "90" | "365" | "custom";
  dateFrom: string;
  dateTo: string;
  stale: "all" | "7" | "15" | "30" | "60";
  sort: "recent" | "oldest" | "value_desc" | "value_asc" | "stale";
};

export const EMPTY_DEAL_FILTERS: DealFilters = {
  q: "",
  stages: [],
  propertyTypes: [],
  noProperty: false,
  purpose: "all",
  valueFrom: "",
  valueTo: "",
  neighborhoods: [],
  cities: [],
  sources: [],
  contactTypes: [],
  period: "all",
  dateFrom: "",
  dateTo: "",
  stale: "all",
  sort: "recent",
};

const VALUE_PRESETS = [
  { label: "Até 500 mil", from: "", to: "500000" },
  { label: "500 mil – 1 mi", from: "500000", to: "1000000" },
  { label: "1 – 3 mi", from: "1000000", to: "3000000" },
  { label: "3 – 10 mi", from: "3000000", to: "10000000" },
  { label: "Acima de 10 mi", from: "10000000", to: "" },
];

const PERIOD_LABELS: Record<DealFilters["period"], string> = {
  all: "Qualquer data",
  "7": "7 dias",
  "30": "30 dias",
  "90": "90 dias",
  "365": "12 meses",
  custom: "Período",
};

const STALE_LABELS: Record<DealFilters["stale"], string> = {
  all: "Todas",
  "7": "+7 dias",
  "15": "+15 dias",
  "30": "+30 dias",
  "60": "+60 dias",
};

const DAY = 86_400_000;
const norm = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const time = (d: Date | string) => new Date(d).getTime();

export function applyDealFilters(
  list: DealFull[],
  f: DealFilters,
  /** Data usada no filtro de período e na ordenação (padrão: abertura) */
  dateOf: (d: DealFull) => number = (d) => time(d.deal.createdAt),
): DealFull[] {
  const term = norm(f.q);
  const from = f.valueFrom ? Number(f.valueFrom) : null;
  const to = f.valueTo ? Number(f.valueTo) : null;
  const now = Date.now();

  let since: number | null = null;
  let until: number | null = null;
  if (f.period === "custom") {
    if (f.dateFrom) since = time(`${f.dateFrom}T00:00:00-03:00`);
    if (f.dateTo) until = time(`${f.dateTo}T23:59:59-03:00`);
  } else if (f.period !== "all") {
    since = now - Number(f.period) * DAY;
  }

  const out = list.filter(({ deal, contact, property }) => {
    if (term) {
      const hay = norm(
        [
          contact?.name ?? "",
          contact?.phone ?? "",
          contact?.email ?? "",
          property?.code ?? "",
          property?.title ?? "",
          property?.neighborhood ?? "",
        ].join(" "),
      );
      if (!hay.includes(term)) return false;
    }
    if (f.stages.length && !f.stages.includes(deal.stage)) return false;

    // Tipo de imóvel e "sem imóvel" somam (OU) entre si
    if (f.propertyTypes.length || f.noProperty) {
      const hit =
        (f.noProperty && !property) ||
        (!!property && f.propertyTypes.includes(property.type));
      if (!hit) return false;
    }
    if (f.purpose !== "all" && property?.purpose !== f.purpose) return false;

    if (from != null && deal.value < from) return false;
    if (to != null && deal.value > to) return false;

    if (f.neighborhoods.length && !f.neighborhoods.includes(property?.neighborhood ?? ""))
      return false;
    if (f.cities.length && !f.cities.includes(property?.city ?? "")) return false;

    if (f.sources.length && !f.sources.includes(contact?.source ?? "")) return false;
    if (f.contactTypes.length && !f.contactTypes.includes(contact?.type ?? "")) return false;

    const when = dateOf({ deal, contact, property });
    if (since != null && when < since) return false;
    if (until != null && when > until) return false;

    if (f.stale !== "all" && now - time(deal.updatedAt) < Number(f.stale) * DAY) return false;

    return true;
  });

  switch (f.sort) {
    case "oldest":
      return out.sort((a, b) => dateOf(a) - dateOf(b));
    case "value_desc":
      return out.sort((a, b) => b.deal.value - a.deal.value);
    case "value_asc":
      return out.sort((a, b) => a.deal.value - b.deal.value);
    case "stale":
      return out.sort((a, b) => time(a.deal.updatedAt) - time(b.deal.updatedAt));
    default:
      return out.sort((a, b) => dateOf(b) - dateOf(a));
  }
}

export function activeDealChips(f: DealFilters, closed = false): ActiveChip<DealFilters>[] {
  const chips: ActiveChip<DealFilters>[] = [];
  const without = (arr: string[], v: string) => arr.filter((x) => x !== v);
  for (const s of f.stages)
    chips.push({ key: `st-${s}`, label: DEAL_STAGE_LABELS[s], clear: { stages: without(f.stages, s) } });
  for (const t of f.propertyTypes)
    chips.push({ key: `pt-${t}`, label: TYPE_LABELS[t] ?? t, clear: { propertyTypes: without(f.propertyTypes, t) } });
  if (f.noProperty) chips.push({ key: "np", label: "Sem imóvel definido", clear: { noProperty: false } });
  if (f.purpose !== "all")
    chips.push({ key: "pu", label: PURPOSE_LABELS[f.purpose], clear: { purpose: "all" } });
  if (f.valueFrom || f.valueTo) {
    const label = f.valueFrom && f.valueTo
      ? `${formatCompact(Number(f.valueFrom))} – ${formatCompact(Number(f.valueTo))}`
      : f.valueFrom
        ? `A partir de ${formatCompact(Number(f.valueFrom))}`
        : `Até ${formatCompact(Number(f.valueTo))}`;
    chips.push({ key: "v", label, clear: { valueFrom: "", valueTo: "" } });
  }
  for (const n of f.neighborhoods)
    chips.push({ key: `n-${n}`, label: n, clear: { neighborhoods: without(f.neighborhoods, n) } });
  for (const c of f.cities)
    chips.push({ key: `c-${c}`, label: c, clear: { cities: without(f.cities, c) } });
  for (const s of f.sources)
    chips.push({ key: `s-${s}`, label: `Origem: ${SOURCE_LABELS[s]}`, clear: { sources: without(f.sources, s) } });
  for (const t of f.contactTypes)
    chips.push({ key: `ct-${t}`, label: CONTACT_TYPE_LABELS[t], clear: { contactTypes: without(f.contactTypes, t) } });
  if (f.period !== "all") {
    const fmt = (d: string) => d.split("-").reverse().join("/");
    const label = f.period === "custom"
      ? `${closed ? "Fechada" : "Aberta"} ${f.dateFrom ? fmt(f.dateFrom) : "…"} a ${f.dateTo ? fmt(f.dateTo) : "hoje"}`
      : `${closed ? "Fechada" : "Aberta"} nos últimos ${PERIOD_LABELS[f.period]}`;
    chips.push({ key: "d", label, clear: { period: "all", dateFrom: "", dateTo: "" } });
  }
  if (f.stale !== "all")
    chips.push({ key: "sl", label: `Parada há ${STALE_LABELS[f.stale]}`, clear: { stale: "all" } });
  return chips;
}

export function DealFiltersPanel({
  value: f,
  onChange,
  deals,
  closed = false,
}: {
  value: DealFilters;
  onChange: (patch: Partial<DealFilters>) => void;
  /** Negócios fechados: sem etapa/parada; período = data de fechamento */
  closed?: boolean;
  /** Negociações da aba atual — base para opções e contagens */
  deals: DealFull[];
}) {
  type ListKey = "stages" | "propertyTypes" | "neighborhoods" | "cities" | "sources" | "contactTypes";
  const toggle = (key: ListKey, v: string) =>
    onChange({ [key]: f[key].includes(v) ? f[key].filter((x) => x !== v) : [...f[key], v] });
  const count = (pred: (d: DealFull) => boolean) => deals.filter(pred).length;

  const tally = (pick: (d: DealFull) => string | undefined) => {
    const map = new Map<string, number>();
    for (const d of deals) {
      const v = pick(d)?.trim();
      if (v) map.set(v, (map.get(v) ?? 0) + 1);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  };
  const hoods = tally((d) => d.property?.neighborhood);
  const cities = tally((d) => d.property?.city);
  const presentTypes = new Set(deals.map((d) => d.property?.type).filter(Boolean) as string[]);

  const typeChips = (rural: boolean) =>
    Object.entries(TYPE_LABELS)
      .filter(([k]) => isRuralType(k) === rural && presentTypes.has(k))
      .map(([k, v]) => (
        <FilterChip
          key={k}
          on={f.propertyTypes.includes(k)}
          onClick={() => toggle("propertyTypes", k)}
          count={count((d) => d.property?.type === k)}
        >
          {v}
        </FilterChip>
      ));
  const urbanChips = typeChips(false);
  const ruralChips = typeChips(true);

  return (
    <>
      {closed && (
        <FilterGroup title="Fechada em">
          <PeriodPicker f={f} onChange={onChange} />
        </FilterGroup>
      )}
      {!closed && (
      <FilterGroup title="Etapa (mostra só as colunas escolhidas)">
        <div className="flex flex-wrap gap-2">
          {DEAL_STAGES.map((s) => (
            <FilterChip
              key={s.id}
              on={f.stages.includes(s.id)}
              onClick={() => toggle("stages", s.id)}
              count={count((d) => d.deal.stage === s.id)}
            >
              <span className="size-1.5 rounded-full" style={{ background: s.dot }} />
              {s.label}
            </FilterChip>
          ))}
        </div>
      </FilterGroup>
      )}

      <FilterGroup title={closed ? "Valor do negócio (R$)" : "Valor da negociação (R$)"}>
        <div className="flex flex-wrap gap-2">
          {VALUE_PRESETS.map((p) => {
            const on = f.valueFrom === p.from && f.valueTo === p.to;
            return (
              <FilterChip
                key={p.label}
                on={on}
                onClick={() =>
                  onChange(on ? { valueFrom: "", valueTo: "" } : { valueFrom: p.from, valueTo: p.to })
                }
              >
                {p.label}
              </FilterChip>
            );
          })}
        </div>
        <div className="mt-3 flex items-center gap-2">
          <Input
            type="number"
            value={f.valueFrom}
            onChange={(e) => onChange({ valueFrom: e.target.value })}
            placeholder="De"
            className="min-w-0 flex-1 font-mono tabular"
          />
          <span className="text-xs text-subtle">até</span>
          <Input
            type="number"
            value={f.valueTo}
            onChange={(e) => onChange({ valueTo: e.target.value })}
            placeholder="Sem limite"
            className="min-w-0 flex-1 font-mono tabular"
          />
        </div>
      </FilterGroup>

      <FilterGroup title="Tipo de imóvel">
        <div className="space-y-2">
          {urbanChips.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <Building2 className="size-3.5 text-subtle" />
              {urbanChips}
            </div>
          )}
          {ruralChips.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <Tractor className="size-3.5 text-subtle" />
              {ruralChips}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <FilterChip
              on={f.noProperty}
              onClick={() => onChange({ noProperty: !f.noProperty })}
              count={count((d) => !d.property)}
            >
              Sem imóvel definido
            </FilterChip>
          </div>
        </div>
      </FilterGroup>

      <FilterGroup title="Finalidade">
        <div className="flex flex-wrap gap-2">
          <FilterChip on={f.purpose === "all"} onClick={() => onChange({ purpose: "all" })}>
            Todas
          </FilterChip>
          {(["venda", "aluguel"] as const).map((k) => (
            <FilterChip
              key={k}
              on={f.purpose === k}
              onClick={() => onChange({ purpose: k })}
              count={count((d) => d.property?.purpose === k)}
            >
              {PURPOSE_LABELS[k]}
            </FilterChip>
          ))}
        </div>
      </FilterGroup>

      {hoods.length > 0 && (
        <FilterGroup title="Bairro do imóvel">
          <div className="flex max-h-32 flex-wrap gap-2 overflow-y-auto">
            {hoods.map(([n, qty]) => (
              <FilterChip key={n} on={f.neighborhoods.includes(n)} onClick={() => toggle("neighborhoods", n)} count={qty}>
                {n}
              </FilterChip>
            ))}
          </div>
        </FilterGroup>
      )}

      {cities.length > 1 && (
        <FilterGroup title="Cidade">
          <div className="flex flex-wrap gap-2">
            {cities.map(([n, qty]) => (
              <FilterChip key={n} on={f.cities.includes(n)} onClick={() => toggle("cities", n)} count={qty}>
                {n}
              </FilterChip>
            ))}
          </div>
        </FilterGroup>
      )}

      <FilterGroup title="Origem do lead">
        <div className="flex flex-wrap gap-2">
          {Object.entries(SOURCE_LABELS).map(([k, v]) => (
            <FilterChip
              key={k}
              on={f.sources.includes(k)}
              onClick={() => toggle("sources", k)}
              count={count((d) => d.contact?.source === k)}
            >
              {v}
            </FilterChip>
          ))}
        </div>
      </FilterGroup>

      <FilterGroup title="Tipo de contato">
        <div className="flex flex-wrap gap-2">
          {Object.entries(CONTACT_TYPE_LABELS).map(([k, v]) => (
            <FilterChip
              key={k}
              on={f.contactTypes.includes(k)}
              onClick={() => toggle("contactTypes", k)}
              count={count((d) => d.contact?.type === k)}
            >
              {v}
            </FilterChip>
          ))}
        </div>
      </FilterGroup>

      {!closed && (
        <>
          <FilterGroup title="Sem movimentação há">
            <div className="flex flex-wrap gap-2">
              {(["all", "7", "15", "30", "60"] as DealFilters["stale"][]).map((k) => (
                <FilterChip key={k} on={f.stale === k} onClick={() => onChange({ stale: k })}>
                  {STALE_LABELS[k]}
                </FilterChip>
              ))}
            </div>
          </FilterGroup>

          <FilterGroup title="Aberta em">
            <PeriodPicker f={f} onChange={onChange} />
          </FilterGroup>
        </>
      )}
    </>
  );
}

function PeriodPicker({
  f,
  onChange,
}: {
  f: DealFilters;
  onChange: (patch: Partial<DealFilters>) => void;
}) {
  return (
    <>
      <div className="flex flex-wrap gap-2">
        {(["all", "7", "30", "90", "365", "custom"] as DealFilters["period"][]).map((k) => (
          <FilterChip key={k} on={f.period === k} onClick={() => onChange({ period: k })}>
            {PERIOD_LABELS[k]}
          </FilterChip>
        ))}
      </div>
      {f.period === "custom" && (
        <div className="mt-3 flex items-center gap-2">
          <Input type="date" value={f.dateFrom} onChange={(e) => onChange({ dateFrom: e.target.value })} className="min-w-0 flex-1" />
          <span className="text-xs text-subtle">até</span>
          <Input type="date" value={f.dateTo} onChange={(e) => onChange({ dateTo: e.target.value })} className="min-w-0 flex-1" />
        </div>
      )}
    </>
  );
}

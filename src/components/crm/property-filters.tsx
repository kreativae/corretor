"use client";

import { FilterChip, FilterGroup, type ActiveChip } from "@/components/crm/filter-sheet";
import { Input } from "@/components/ui";
import { FEATURES, PURPOSE_LABELS, STATUS_LABELS, TYPE_LABELS } from "@/lib/labels";
import type { PropertyWithImages } from "@/lib/queries";
import {
  ACESSO_LABELS,
  AGUA_OPCOES,
  APTIDAO_LABELS,
  BENFEITORIAS_OPCOES,
  ENERGIA_LABELS,
  formatAlq,
  isRuralType,
  normalizeRural,
  pricePerAlq,
  SOLO_LABELS,
  TOPOGRAFIA_LABELS,
} from "@/lib/rural";
import { formatCompact, formatNumber } from "@/lib/utils";

type Views = Record<string, { total: number; unique: number }>;

export type PropertyFilters = {
  q: string;
  statuses: string[];
  types: string[];
  purpose: "all" | "venda" | "aluguel";
  priceFrom: string;
  priceTo: string;
  areaFrom: string;
  areaTo: string;
  bedrooms: number;
  suites: number;
  garage: number;
  features: string[];
  aptidoes: string[];
  energia: string[];
  agua: string[];
  kmz: "all" | "with" | "without";
  topografia: string[];
  solo: string[];
  acesso: string[];
  benfeitorias: string[];
  docs: string[];
  ppaFrom: string;
  ppaTo: string;
  plantadaMin: string;
  pastagemMin: string;
  distMax: "" | "10" | "20" | "50" | "100";
  neighborhoods: string[];
  cities: string[];
  published: "all" | "yes" | "no";
  photos: "all" | "with" | "without";
  views: "all" | "with" | "without";
  sort:
    | "recent"
    | "oldest"
    | "price_desc"
    | "price_asc"
    | "area_desc"
    | "views_desc"
    | "title"
    | "ppa_asc"
    | "ppa_desc";
};

export const EMPTY_PROPERTY_FILTERS: PropertyFilters = {
  q: "",
  statuses: [],
  types: [],
  purpose: "all",
  priceFrom: "",
  priceTo: "",
  areaFrom: "",
  areaTo: "",
  bedrooms: 0,
  suites: 0,
  garage: 0,
  features: [],
  aptidoes: [],
  energia: [],
  agua: [],
  kmz: "all",
  topografia: [],
  solo: [],
  acesso: [],
  benfeitorias: [],
  docs: [],
  ppaFrom: "",
  ppaTo: "",
  plantadaMin: "",
  pastagemMin: "",
  distMax: "",
  neighborhoods: [],
  cities: [],
  published: "all",
  photos: "all",
  views: "all",
  sort: "recent",
};

const PRICE_PRESETS = [
  { label: "Até 500 mil", from: "", to: "500000" },
  { label: "500 mil – 1 mi", from: "500000", to: "1000000" },
  { label: "1 – 3 mi", from: "1000000", to: "3000000" },
  { label: "3 – 10 mi", from: "3000000", to: "10000000" },
  { label: "Acima de 10 mi", from: "10000000", to: "" },
];

const DOCS = [
  { id: "matricula", label: "Matrícula" },
  { id: "car", label: "CAR" },
  { id: "ccir", label: "CCIR" },
  { id: "nirf", label: "NIRF / ITR" },
] as const;

/** Preço por alqueire (0 quando sem área) */
function ppaOf(p: PropertyWithImages) {
  return pricePerAlq(p.price, normalizeRural(p.rural).totalAlq) ?? 0;
}

const norm = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const time = (d: Date | string) => new Date(d).getTime();

/** Área usada em filtros e ordenação: m² (urbano) ou alqueires (rural) */
function areaOf(p: PropertyWithImages, rural: boolean) {
  return rural ? (normalizeRural(p.rural).totalAlq ?? 0) : p.area;
}

export function applyPropertyFilters(
  list: PropertyWithImages[],
  f: PropertyFilters,
  views: Views,
  rural: boolean,
): PropertyWithImages[] {
  const term = norm(f.q);
  const num = (s: string) => (s ? Number(s) : null);
  const [pFrom, pTo, aFrom, aTo] = [num(f.priceFrom), num(f.priceTo), num(f.areaFrom), num(f.areaTo)];

  const out = list.filter((p) => {
    const r = normalizeRural(p.rural);
    if (term) {
      const hay = norm(
        [p.code, p.title, p.neighborhood, p.city, p.street, rural ? r.culturas : ""].join(" "),
      );
      if (!hay.includes(term)) return false;
    }
    if (f.statuses.length && !f.statuses.includes(p.status)) return false;
    if (f.types.length && !f.types.includes(p.type)) return false;
    if (f.purpose !== "all" && p.purpose !== f.purpose) return false;
    if (pFrom != null && p.price < pFrom) return false;
    if (pTo != null && p.price > pTo) return false;
    const area = areaOf(p, rural);
    if (aFrom != null && area < aFrom) return false;
    if (aTo != null && area > aTo) return false;

    if (!rural) {
      if (p.bedrooms < f.bedrooms) return false;
      if (p.suites < f.suites) return false;
      if (p.garage < f.garage) return false;
      if (f.features.length && !f.features.every((x) => p.features.includes(x))) return false;
    } else {
      if (f.aptidoes.length && !f.aptidoes.includes(r.aptidao)) return false;
      if (f.energia.length && !f.energia.includes(r.energia)) return false;
      if (f.agua.length && !f.agua.some((x) => r.agua.includes(x))) return false;
      if (f.kmz === "with" && !r.kmzUrl) return false;
      if (f.kmz === "without" && r.kmzUrl) return false;
      if (f.topografia.length && !f.topografia.includes(r.topografia)) return false;
      if (f.solo.length && !f.solo.includes(r.solo)) return false;
      if (f.acesso.length && !f.acesso.includes(r.acesso)) return false;
      if (f.benfeitorias.length && !f.benfeitorias.every((b) => r.benfeitorias.includes(b)))
        return false;
      if (f.docs.length && !f.docs.every((d) => String(r[d as keyof typeof r] ?? "").trim()))
        return false;
      const ppa = ppaOf(p);
      if (f.ppaFrom && ppa < Number(f.ppaFrom)) return false;
      if (f.ppaTo && (!ppa || ppa > Number(f.ppaTo))) return false;
      if (f.plantadaMin && (r.plantadaAlq ?? 0) < Number(f.plantadaMin)) return false;
      if (f.pastagemMin && (r.pastagemAlq ?? 0) < Number(f.pastagemMin)) return false;
      if (f.distMax && (r.distanciaCidadeKm == null || r.distanciaCidadeKm > Number(f.distMax)))
        return false;
    }

    if (f.neighborhoods.length && !f.neighborhoods.includes(p.neighborhood)) return false;
    if (f.cities.length && !f.cities.includes(p.city)) return false;
    if (f.published === "yes" && !p.published) return false;
    if (f.published === "no" && p.published) return false;
    if (f.photos === "with" && !p.images.length) return false;
    if (f.photos === "without" && p.images.length) return false;
    const v = views[p.id]?.total ?? 0;
    if (f.views === "with" && !v) return false;
    if (f.views === "without" && v) return false;
    return true;
  });

  switch (f.sort) {
    case "oldest":
      return out.sort((a, b) => time(a.createdAt) - time(b.createdAt));
    case "price_desc":
      return out.sort((a, b) => b.price - a.price);
    case "price_asc":
      return out.sort((a, b) => a.price - b.price);
    case "area_desc":
      return out.sort((a, b) => areaOf(b, rural) - areaOf(a, rural));
    case "views_desc":
      return out.sort((a, b) => (views[b.id]?.total ?? 0) - (views[a.id]?.total ?? 0));
    case "ppa_asc":
      return out.sort((a, b) => (ppaOf(a) || Infinity) - (ppaOf(b) || Infinity));
    case "ppa_desc":
      return out.sort((a, b) => ppaOf(b) - ppaOf(a));
    case "title":
      return out.sort((a, b) => a.title.localeCompare(b.title, "pt-BR"));
    default:
      return out.sort((a, b) => time(b.createdAt) - time(a.createdAt));
  }
}

export function activePropertyChips(f: PropertyFilters, rural: boolean): ActiveChip<PropertyFilters>[] {
  const chips: ActiveChip<PropertyFilters>[] = [];
  const without = (arr: string[], v: string) => arr.filter((x) => x !== v);
  const range = (from: string, to: string, fmt: (n: number) => string) =>
    from && to
      ? `${fmt(Number(from))} – ${fmt(Number(to))}`
      : from
        ? `A partir de ${fmt(Number(from))}`
        : `Até ${fmt(Number(to))}`;
  const unit = (n: number) => (rural ? `${formatAlq(n)} alq` : `${formatNumber(n)} m²`);

  for (const s of f.statuses)
    chips.push({ key: `s-${s}`, label: STATUS_LABELS[s], clear: { statuses: without(f.statuses, s) } });
  for (const t of f.types)
    chips.push({ key: `t-${t}`, label: TYPE_LABELS[t] ?? t, clear: { types: without(f.types, t) } });
  if (f.purpose !== "all")
    chips.push({ key: "pu", label: PURPOSE_LABELS[f.purpose], clear: { purpose: "all" } });
  if (f.priceFrom || f.priceTo)
    chips.push({ key: "pr", label: range(f.priceFrom, f.priceTo, formatCompact), clear: { priceFrom: "", priceTo: "" } });
  if (f.areaFrom || f.areaTo)
    chips.push({ key: "ar", label: range(f.areaFrom, f.areaTo, unit), clear: { areaFrom: "", areaTo: "" } });
  if (!rural) {
    if (f.bedrooms) chips.push({ key: "bd", label: `${f.bedrooms}+ dormitórios`, clear: { bedrooms: 0 } });
    if (f.suites) chips.push({ key: "su", label: `${f.suites}+ suítes`, clear: { suites: 0 } });
    if (f.garage) chips.push({ key: "ga", label: `${f.garage}+ vagas`, clear: { garage: 0 } });
    for (const x of f.features)
      chips.push({ key: `f-${x}`, label: x, clear: { features: without(f.features, x) } });
  } else {
    for (const a of f.aptidoes)
      chips.push({
        key: `ap-${a}`,
        label: APTIDAO_LABELS[a as keyof typeof APTIDAO_LABELS] ?? a,
        clear: { aptidoes: without(f.aptidoes, a) },
      });
    for (const e of f.energia)
      chips.push({
        key: `en-${e}`,
        label: `Energia: ${ENERGIA_LABELS[e as keyof typeof ENERGIA_LABELS] ?? e}`,
        clear: { energia: without(f.energia, e) },
      });
    for (const a of f.agua)
      chips.push({ key: `ag-${a}`, label: a, clear: { agua: without(f.agua, a) } });
    if (f.kmz !== "all")
      chips.push({ key: "kmz", label: f.kmz === "with" ? "Com KMZ" : "Sem KMZ", clear: { kmz: "all" } });
    for (const t of f.topografia)
      chips.push({ key: `tp-${t}`, label: TOPOGRAFIA_LABELS[t as keyof typeof TOPOGRAFIA_LABELS] ?? t, clear: { topografia: without(f.topografia, t) } });
    for (const t of f.solo)
      chips.push({ key: `so-${t}`, label: `Solo ${SOLO_LABELS[t as keyof typeof SOLO_LABELS] ?? t}`, clear: { solo: without(f.solo, t) } });
    for (const t of f.acesso)
      chips.push({ key: `ac-${t}`, label: ACESSO_LABELS[t as keyof typeof ACESSO_LABELS] ?? t, clear: { acesso: without(f.acesso, t) } });
    for (const b of f.benfeitorias)
      chips.push({ key: `bf-${b}`, label: b, clear: { benfeitorias: without(f.benfeitorias, b) } });
    for (const d of f.docs)
      chips.push({ key: `dc-${d}`, label: `Com ${DOCS.find((x) => x.id === d)?.label ?? d}`, clear: { docs: without(f.docs, d) } });
    if (f.ppaFrom || f.ppaTo)
      chips.push({ key: "ppa", label: `${range(f.ppaFrom, f.ppaTo, formatCompact)}/alq`, clear: { ppaFrom: "", ppaTo: "" } });
    if (f.plantadaMin)
      chips.push({ key: "pl", label: `Lavoura ≥ ${formatAlq(Number(f.plantadaMin))} alq`, clear: { plantadaMin: "" } });
    if (f.pastagemMin)
      chips.push({ key: "pa", label: `Pastagem ≥ ${formatAlq(Number(f.pastagemMin))} alq`, clear: { pastagemMin: "" } });
    if (f.distMax)
      chips.push({ key: "di", label: `Até ${f.distMax} km da cidade`, clear: { distMax: "" } });
  }
  for (const n of f.neighborhoods)
    chips.push({ key: `n-${n}`, label: n, clear: { neighborhoods: without(f.neighborhoods, n) } });
  for (const c of f.cities)
    chips.push({ key: `c-${c}`, label: c, clear: { cities: without(f.cities, c) } });
  if (f.published !== "all")
    chips.push({ key: "pb", label: f.published === "yes" ? "Publicado no site" : "Fora do site", clear: { published: "all" } });
  if (f.photos !== "all")
    chips.push({ key: "ph", label: f.photos === "with" ? "Com fotos" : "Sem fotos", clear: { photos: "all" } });
  if (f.views !== "all")
    chips.push({ key: "vw", label: f.views === "with" ? "Com visualizações" : "Sem visualizações", clear: { views: "all" } });
  return chips;
}

function MinCount({
  value,
  onChange,
}: {
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {[0, 1, 2, 3, 4].map((n) => (
        <FilterChip key={n} on={value === n} onClick={() => onChange(n)}>
          {n === 0 ? "Qualquer" : `${n}+`}
        </FilterChip>
      ))}
    </div>
  );
}

function Range({
  from,
  to,
  onFrom,
  onTo,
  suffix,
}: {
  from: string;
  to: string;
  onFrom: (v: string) => void;
  onTo: (v: string) => void;
  suffix?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <Input type="number" value={from} onChange={(e) => onFrom(e.target.value)} placeholder="De" className="min-w-0 flex-1 font-mono tabular" />
      <span className="text-xs text-subtle">até</span>
      <Input type="number" value={to} onChange={(e) => onTo(e.target.value)} placeholder="Sem limite" className="min-w-0 flex-1 font-mono tabular" />
      {suffix && <span className="text-xs text-subtle">{suffix}</span>}
    </div>
  );
}

function TriState<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { id: T; label: string; count?: number }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <FilterChip key={o.id} on={value === o.id} onClick={() => onChange(o.id)} count={o.count}>
          {o.label}
        </FilterChip>
      ))}
    </div>
  );
}

export function PropertyFiltersPanel({
  value: f,
  onChange,
  items,
  views,
  rural,
}: {
  value: PropertyFilters;
  onChange: (patch: Partial<PropertyFilters>) => void;
  items: PropertyWithImages[];
  views: Views;
  rural: boolean;
}) {
  type ListKey =
    | "statuses"
    | "types"
    | "features"
    | "aptidoes"
    | "energia"
    | "agua"
    | "neighborhoods"
    | "cities"
    | "topografia"
    | "solo"
    | "acesso"
    | "benfeitorias"
    | "docs";
  const toggle = (key: ListKey, v: string) =>
    onChange({ [key]: f[key].includes(v) ? f[key].filter((x) => x !== v) : [...f[key], v] });
  const count = (pred: (p: PropertyWithImages) => boolean) => items.filter(pred).length;

  const tally = (pick: (p: PropertyWithImages) => string) => {
    const map = new Map<string, number>();
    for (const p of items) {
      const v = pick(p)?.trim();
      if (v) map.set(v, (map.get(v) ?? 0) + 1);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  };
  const hoods = tally((p) => p.neighborhood);
  const cities = tally((p) => p.city);

  return (
    <>
      <FilterGroup title="Status">
        <div className="flex flex-wrap gap-2">
          {Object.entries(STATUS_LABELS).map(([k, label]) => (
            <FilterChip key={k} on={f.statuses.includes(k)} onClick={() => toggle("statuses", k)} count={count((p) => p.status === k)}>
              {label}
            </FilterChip>
          ))}
        </div>
      </FilterGroup>

      <FilterGroup title="Tipo">
        <div className="flex flex-wrap gap-2">
          {Object.entries(TYPE_LABELS)
            .filter(([k]) => isRuralType(k) === rural)
            .map(([k, label]) => (
              <FilterChip key={k} on={f.types.includes(k)} onClick={() => toggle("types", k)} count={count((p) => p.type === k)}>
                {label}
              </FilterChip>
            ))}
        </div>
      </FilterGroup>

      <FilterGroup title="Finalidade">
        <TriState
          value={f.purpose}
          onChange={(purpose) => onChange({ purpose })}
          options={[
            { id: "all", label: "Todas" },
            { id: "venda", label: "Venda", count: count((p) => p.purpose === "venda") },
            { id: "aluguel", label: "Aluguel", count: count((p) => p.purpose === "aluguel") },
          ]}
        />
      </FilterGroup>

      <FilterGroup title="Preço (R$)">
        <div className="mb-3 flex flex-wrap gap-2">
          {PRICE_PRESETS.map((p) => {
            const on = f.priceFrom === p.from && f.priceTo === p.to;
            return (
              <FilterChip
                key={p.label}
                on={on}
                onClick={() => onChange(on ? { priceFrom: "", priceTo: "" } : { priceFrom: p.from, priceTo: p.to })}
              >
                {p.label}
              </FilterChip>
            );
          })}
        </div>
        <Range
          from={f.priceFrom}
          to={f.priceTo}
          onFrom={(priceFrom) => onChange({ priceFrom })}
          onTo={(priceTo) => onChange({ priceTo })}
        />
      </FilterGroup>

      <FilterGroup title={rural ? "Área total (alqueires)" : "Área útil (m²)"}>
        <Range
          from={f.areaFrom}
          to={f.areaTo}
          onFrom={(areaFrom) => onChange({ areaFrom })}
          onTo={(areaTo) => onChange({ areaTo })}
          suffix={rural ? "alq" : "m²"}
        />
      </FilterGroup>

      {!rural && (
        <>
          <FilterGroup title="Dormitórios">
            <MinCount value={f.bedrooms} onChange={(bedrooms) => onChange({ bedrooms })} />
          </FilterGroup>
          <FilterGroup title="Suítes">
            <MinCount value={f.suites} onChange={(suites) => onChange({ suites })} />
          </FilterGroup>
          <FilterGroup title="Vagas de garagem">
            <MinCount value={f.garage} onChange={(garage) => onChange({ garage })} />
          </FilterGroup>
          <FilterGroup title="Comodidades (precisa ter todas)">
            <div className="flex flex-wrap gap-2">
              {FEATURES.map((x) => (
                <FilterChip key={x} on={f.features.includes(x)} onClick={() => toggle("features", x)} count={count((p) => p.features.includes(x))}>
                  {x}
                </FilterChip>
              ))}
            </div>
          </FilterGroup>
        </>
      )}

      {rural && (
        <>
          <FilterGroup title="Aptidão">
            <div className="flex flex-wrap gap-2">
              {Object.entries(APTIDAO_LABELS).map(([k, label]) => (
                <FilterChip key={k} on={f.aptidoes.includes(k)} onClick={() => toggle("aptidoes", k)} count={count((p) => normalizeRural(p.rural).aptidao === k)}>
                  {label}
                </FilterChip>
              ))}
            </div>
          </FilterGroup>
          <FilterGroup title="Preço por alqueire (R$)">
            <Range
              from={f.ppaFrom}
              to={f.ppaTo}
              onFrom={(ppaFrom) => onChange({ ppaFrom })}
              onTo={(ppaTo) => onChange({ ppaTo })}
            />
          </FilterGroup>
          <FilterGroup title="Lavoura / pastagem mínima (alqueires)">
            <div className="flex items-center gap-2">
              <Input type="number" value={f.plantadaMin} onChange={(e) => onChange({ plantadaMin: e.target.value })} placeholder="Lavoura ≥" className="min-w-0 flex-1 font-mono tabular" />
              <Input type="number" value={f.pastagemMin} onChange={(e) => onChange({ pastagemMin: e.target.value })} placeholder="Pastagem ≥" className="min-w-0 flex-1 font-mono tabular" />
            </div>
          </FilterGroup>
          <FilterGroup title="Distância da cidade">
            <TriState
              value={f.distMax}
              onChange={(distMax) => onChange({ distMax })}
              options={[
                { id: "", label: "Qualquer" },
                { id: "10", label: "Até 10 km" },
                { id: "20", label: "Até 20 km" },
                { id: "50", label: "Até 50 km" },
                { id: "100", label: "Até 100 km" },
              ]}
            />
          </FilterGroup>
          <FilterGroup title="Topografia">
            <div className="flex flex-wrap gap-2">
              {Object.entries(TOPOGRAFIA_LABELS).map(([k, label]) => (
                <FilterChip key={k} on={f.topografia.includes(k)} onClick={() => toggle("topografia", k)} count={count((p) => normalizeRural(p.rural).topografia === k)}>
                  {label}
                </FilterChip>
              ))}
            </div>
          </FilterGroup>
          <FilterGroup title="Solo">
            <div className="flex flex-wrap gap-2">
              {Object.entries(SOLO_LABELS).map(([k, label]) => (
                <FilterChip key={k} on={f.solo.includes(k)} onClick={() => toggle("solo", k)} count={count((p) => normalizeRural(p.rural).solo === k)}>
                  {label}
                </FilterChip>
              ))}
            </div>
          </FilterGroup>
          <FilterGroup title="Acesso">
            <div className="flex flex-wrap gap-2">
              {Object.entries(ACESSO_LABELS).map(([k, label]) => (
                <FilterChip key={k} on={f.acesso.includes(k)} onClick={() => toggle("acesso", k)} count={count((p) => normalizeRural(p.rural).acesso === k)}>
                  {label}
                </FilterChip>
              ))}
            </div>
          </FilterGroup>
          <FilterGroup title="Água">
            <div className="flex flex-wrap gap-2">
              {AGUA_OPCOES.map((x) => (
                <FilterChip key={x} on={f.agua.includes(x)} onClick={() => toggle("agua", x)} count={count((p) => normalizeRural(p.rural).agua.includes(x))}>
                  {x}
                </FilterChip>
              ))}
            </div>
          </FilterGroup>
          <FilterGroup title="Energia">
            <div className="flex flex-wrap gap-2">
              {Object.entries(ENERGIA_LABELS).map(([k, label]) => (
                <FilterChip key={k} on={f.energia.includes(k)} onClick={() => toggle("energia", k)} count={count((p) => normalizeRural(p.rural).energia === k)}>
                  {label}
                </FilterChip>
              ))}
            </div>
          </FilterGroup>
          <FilterGroup title="Benfeitorias (precisa ter todas)">
            <div className="flex flex-wrap gap-2">
              {BENFEITORIAS_OPCOES.map((x) => (
                <FilterChip key={x} on={f.benfeitorias.includes(x)} onClick={() => toggle("benfeitorias", x)} count={count((p) => normalizeRural(p.rural).benfeitorias.includes(x))}>
                  {x}
                </FilterChip>
              ))}
            </div>
          </FilterGroup>
          <FilterGroup title="Documentação informada">
            <div className="flex flex-wrap gap-2">
              {DOCS.map((d) => (
                <FilterChip key={d.id} on={f.docs.includes(d.id)} onClick={() => toggle("docs", d.id)} count={count((p) => !!String(normalizeRural(p.rural)[d.id] ?? "").trim())}>
                  {d.label}
                </FilterChip>
              ))}
            </div>
          </FilterGroup>
          <FilterGroup title="Mapa KMZ">
            <TriState
              value={f.kmz}
              onChange={(kmz) => onChange({ kmz })}
              options={[
                { id: "all", label: "Todas" },
                { id: "with", label: "Com KMZ", count: count((p) => !!normalizeRural(p.rural).kmzUrl) },
                { id: "without", label: "Sem KMZ", count: count((p) => !normalizeRural(p.rural).kmzUrl) },
              ]}
            />
          </FilterGroup>
        </>
      )}

      {hoods.length > 0 && (
        <FilterGroup title={rural ? "Região" : "Bairro"}>
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

      <FilterGroup title="Publicação no site">
        <TriState
          value={f.published}
          onChange={(published) => onChange({ published })}
          options={[
            { id: "all", label: "Todos" },
            { id: "yes", label: "Publicados", count: count((p) => p.published) },
            { id: "no", label: "Fora do site", count: count((p) => !p.published) },
          ]}
        />
      </FilterGroup>

      <FilterGroup title="Fotos">
        <TriState
          value={f.photos}
          onChange={(photos) => onChange({ photos })}
          options={[
            { id: "all", label: "Todos" },
            { id: "with", label: "Com fotos", count: count((p) => p.images.length > 0) },
            { id: "without", label: "Sem fotos", count: count((p) => p.images.length === 0) },
          ]}
        />
      </FilterGroup>

      <FilterGroup title="Visualizações no site">
        <TriState
          value={f.views}
          onChange={(v) => onChange({ views: v })}
          options={[
            { id: "all", label: "Todos" },
            { id: "with", label: "Com visualizações", count: count((p) => (views[p.id]?.total ?? 0) > 0) },
            { id: "without", label: "Nunca visto", count: count((p) => !views[p.id]?.total) },
          ]}
        />
      </FilterGroup>
    </>
  );
}

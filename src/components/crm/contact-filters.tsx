"use client";

import { Input, Select } from "@/components/ui";
import type { Contact } from "@/db/schema";
import {
  CONTACT_TYPE_LABELS,
  DEAL_STAGES,
  DEAL_STAGE_LABELS,
  SOURCE_LABELS,
  TYPE_LABELS,
} from "@/lib/labels";
import { isRuralType } from "@/lib/rural";
import { cn, formatCompact } from "@/lib/utils";
import { Building2, Tractor } from "lucide-react";
import { FilterChip, FilterGroup, type ActiveChip } from "@/components/crm/filter-sheet";

/** Relacionamento do contato com o funil e a agenda (calculado no servidor). */
export type ContactMeta = {
  stages: string[];
  dealValue: number;
  visitsDone: number;
  visitsUpcoming: number;
  properties: { id: string; code: string; title: string }[];
};

export type ContactFilters = {
  q: string;
  types: string[];
  sources: string[];
  interests: string[];
  budgetFrom: string;
  budgetTo: string;
  noBudget: boolean;
  neighborhoods: string[];
  stages: string[];
  visits: "all" | "upcoming" | "done" | "none";
  property: string;
  period: "all" | "7" | "30" | "90" | "365" | "custom";
  dateFrom: string;
  dateTo: string;
  email: "all" | "with" | "without";
  google: "all" | "yes" | "no";
  sort: "recent" | "oldest" | "name" | "budget_desc" | "budget_asc";
};

export const EMPTY_FILTERS: ContactFilters = {
  q: "",
  types: [],
  sources: [],
  interests: [],
  budgetFrom: "",
  budgetTo: "",
  noBudget: false,
  neighborhoods: [],
  stages: [],
  visits: "all",
  property: "all",
  period: "all",
  dateFrom: "",
  dateTo: "",
  email: "all",
  google: "all",
  sort: "recent",
};

/** Etapa especial para "sem negociação no funil" */
export const NO_DEAL = "sem";

const BUDGET_PRESETS = [
  { label: "Até 500 mil", from: "", to: "500000" },
  { label: "500 mil – 1 mi", from: "500000", to: "1000000" },
  { label: "1 – 3 mi", from: "1000000", to: "3000000" },
  { label: "3 – 10 mi", from: "3000000", to: "10000000" },
  { label: "Acima de 10 mi", from: "10000000", to: "" },
];

const PERIOD_LABELS: Record<ContactFilters["period"], string> = {
  all: "Qualquer data",
  "7": "7 dias",
  "30": "30 dias",
  "90": "90 dias",
  "365": "12 meses",
  custom: "Período",
};

const VISIT_LABELS: Record<ContactFilters["visits"], string> = {
  all: "Todos",
  upcoming: "Com visita marcada",
  done: "Já visitou",
  none: "Nunca visitou",
};

const digits = (s: string) => s.replace(/\D/g, "");
const norm = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/** Maior valor que o contato aceita pagar (para ordenar e exibir) */
export function budgetOf(c: Contact) {
  return c.budgetMax ?? c.budgetMin ?? 0;
}

const EMPTY_META: ContactMeta = {
  stages: [],
  dealValue: 0,
  visitsDone: 0,
  visitsUpcoming: 0,
  properties: [],
};

export function applyContactFilters(
  list: Contact[],
  f: ContactFilters,
  meta: Record<string, ContactMeta>,
): Contact[] {
  const term = norm(f.q);
  const termDigits = digits(f.q);
  const from = f.budgetFrom ? Number(f.budgetFrom) : null;
  const to = f.budgetTo ? Number(f.budgetTo) : null;
  const hoods = f.neighborhoods.map(norm);

  let since: number | null = null;
  let until: number | null = null;
  if (f.period === "custom") {
    if (f.dateFrom) since = new Date(`${f.dateFrom}T00:00:00-03:00`).getTime();
    if (f.dateTo) until = new Date(`${f.dateTo}T23:59:59-03:00`).getTime();
  } else if (f.period !== "all") {
    since = Date.now() - Number(f.period) * 86_400_000;
  }

  const out = list.filter((c) => {
    const m = meta[c.id] ?? EMPTY_META;

    if (term) {
      const hay = norm(
        [c.name, c.email ?? "", c.notes ?? "", ...c.neighborhoods].join(" "),
      );
      const phoneHit = termDigits.length >= 3 && digits(c.phone).includes(termDigits);
      if (!hay.includes(term) && !phoneHit) return false;
    }
    if (f.types.length && !f.types.includes(c.type)) return false;
    if (f.sources.length && !f.sources.includes(c.source)) return false;
    if (f.interests.length && !f.interests.some((t) => c.interestTypes.includes(t)))
      return false;

    // Orçamento: a faixa do contato precisa cruzar a faixa pedida
    if (f.noBudget) {
      if (c.budgetMin || c.budgetMax) return false;
    } else if (from != null || to != null) {
      if (!c.budgetMin && !c.budgetMax) return false;
      // "até X" (sem mínimo) aceita qualquer valor abaixo; sem máximo, sem teto
      const lo = c.budgetMin ?? 0;
      const hi = c.budgetMax ?? Infinity;
      if (from != null && hi < from) return false;
      if (to != null && lo > to) return false;
    }

    if (hoods.length && !c.neighborhoods.some((n) => hoods.includes(norm(n)))) return false;

    if (f.stages.length) {
      const hit =
        (f.stages.includes(NO_DEAL) && m.stages.length === 0) ||
        m.stages.some((s) => f.stages.includes(s));
      if (!hit) return false;
    }

    if (f.visits === "upcoming" && m.visitsUpcoming === 0) return false;
    if (f.visits === "done" && m.visitsDone === 0) return false;
    if (f.visits === "none" && (m.visitsDone > 0 || m.visitsUpcoming > 0)) return false;

    if (f.property !== "all" && !m.properties.some((p) => p.id === f.property)) return false;

    const created = new Date(c.createdAt).getTime();
    if (since != null && created < since) return false;
    if (until != null && created > until) return false;

    if (f.email === "with" && !c.email) return false;
    if (f.email === "without" && c.email) return false;
    if (f.google === "yes" && !c.googleResourceName) return false;
    if (f.google === "no" && c.googleResourceName) return false;

    return true;
  });

  const time = (c: Contact) => new Date(c.createdAt).getTime();
  switch (f.sort) {
    case "oldest":
      return out.sort((a, b) => time(a) - time(b));
    case "name":
      return out.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    case "budget_desc":
      return out.sort((a, b) => budgetOf(b) - budgetOf(a));
    case "budget_asc":
      // Sem orçamento vai para o fim
      return out.sort(
        (a, b) => (budgetOf(a) || Infinity) - (budgetOf(b) || Infinity),
      );
    default:
      return out.sort((a, b) => time(b) - time(a));
  }
}

/** Filtros ativos como chips removíveis (exceto busca e ordenação). */
export function activeFilterChips(
  f: ContactFilters,
  propertyName: (id: string) => string,
): ActiveChip<ContactFilters>[] {
  const chips: ActiveChip<ContactFilters>[] = [];
  const without = (arr: string[], v: string) => arr.filter((x) => x !== v);
  for (const t of f.types)
    chips.push({ key: `t-${t}`, label: CONTACT_TYPE_LABELS[t], clear: { types: without(f.types, t) } });
  for (const s of f.sources)
    chips.push({ key: `s-${s}`, label: `Origem: ${SOURCE_LABELS[s]}`, clear: { sources: without(f.sources, s) } });
  for (const i of f.interests)
    chips.push({ key: `i-${i}`, label: TYPE_LABELS[i] ?? i, clear: { interests: without(f.interests, i) } });
  if (f.noBudget) chips.push({ key: "nb", label: "Sem orçamento", clear: { noBudget: false } });
  else if (f.budgetFrom || f.budgetTo) {
    const label = f.budgetFrom && f.budgetTo
      ? `${formatCompact(Number(f.budgetFrom))} – ${formatCompact(Number(f.budgetTo))}`
      : f.budgetFrom
        ? `A partir de ${formatCompact(Number(f.budgetFrom))}`
        : `Até ${formatCompact(Number(f.budgetTo))}`;
    chips.push({ key: "b", label, clear: { budgetFrom: "", budgetTo: "" } });
  }
  for (const n of f.neighborhoods)
    chips.push({ key: `n-${n}`, label: n, clear: { neighborhoods: without(f.neighborhoods, n) } });
  for (const s of f.stages)
    chips.push({
      key: `st-${s}`,
      label: s === NO_DEAL ? "Fora do funil" : DEAL_STAGE_LABELS[s],
      clear: { stages: without(f.stages, s) },
    });
  if (f.visits !== "all") chips.push({ key: "v", label: VISIT_LABELS[f.visits], clear: { visits: "all" } });
  if (f.property !== "all")
    chips.push({ key: "p", label: propertyName(f.property), clear: { property: "all" } });
  if (f.period !== "all") {
    const label = f.period === "custom"
      ? `Entrada ${f.dateFrom ? f.dateFrom.split("-").reverse().join("/") : "…"} a ${f.dateTo ? f.dateTo.split("-").reverse().join("/") : "hoje"}`
      : `Entrou nos últimos ${PERIOD_LABELS[f.period]}`;
    chips.push({ key: "d", label, clear: { period: "all", dateFrom: "", dateTo: "" } });
  }
  if (f.email !== "all")
    chips.push({ key: "e", label: f.email === "with" ? "Com e-mail" : "Sem e-mail", clear: { email: "all" } });
  if (f.google !== "all")
    chips.push({ key: "g", label: f.google === "yes" ? "No Google" : "Fora do Google", clear: { google: "all" } });
  return chips;
}

/* ─────────────────────────── UI ─────────────────────────── */

export function ContactFiltersPanel({
  value: f,
  onChange,
  contacts,
  meta,
  properties,
}: {
  value: ContactFilters;
  onChange: (patch: Partial<ContactFilters>) => void;
  /** Contatos da aba atual — base para as contagens */
  contacts: Contact[];
  meta: Record<string, ContactMeta>;
  properties: { id: string; code: string; title: string }[];
}) {
  const toggle = (key: "types" | "sources" | "interests" | "neighborhoods" | "stages", v: string) =>
    onChange({ [key]: f[key].includes(v) ? f[key].filter((x) => x !== v) : [...f[key], v] });

  const count = (pred: (c: Contact) => boolean) => contacts.filter(pred).length;

  // Bairros citados pelos contatos, do mais frequente para o menos
  const hoodCount = new Map<string, number>();
  for (const c of contacts)
    for (const n of c.neighborhoods) {
      const k = n.trim();
      if (k) hoodCount.set(k, (hoodCount.get(k) ?? 0) + 1);
    }
  const hoods = [...hoodCount.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

  const interestChips = (rural: boolean) =>
    Object.entries(TYPE_LABELS)
      .filter(([k]) => isRuralType(k) === rural)
      .map(([k, v]) => (
        <FilterChip
          key={k}
          on={f.interests.includes(k)}
          onClick={() => toggle("interests", k)}
          count={count((c) => c.interestTypes.includes(k))}
        >
          {v}
        </FilterChip>
      ));

  return (
    <>
        <FilterGroup title="Tipo de contato">
          <div className="flex flex-wrap gap-2">
            {Object.entries(CONTACT_TYPE_LABELS).map(([k, v]) => (
              <FilterChip key={k} on={f.types.includes(k)} onClick={() => toggle("types", k)} count={count((c) => c.type === k)}>
                {v}
              </FilterChip>
            ))}
          </div>
        </FilterGroup>

        <FilterGroup title="De onde veio">
          <div className="flex flex-wrap gap-2">
            {Object.entries(SOURCE_LABELS).map(([k, v]) => (
              <FilterChip key={k} on={f.sources.includes(k)} onClick={() => toggle("sources", k)} count={count((c) => c.source === k)}>
                {v}
              </FilterChip>
            ))}
          </div>
        </FilterGroup>

        <FilterGroup title="O que quer comprar">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Building2 className="size-3.5 text-subtle" />
              {interestChips(false)}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Tractor className="size-3.5 text-subtle" />
              {interestChips(true)}
            </div>
          </div>
        </FilterGroup>

        <FilterGroup title="Quanto quer gastar (R$)">
          <div className="flex flex-wrap items-center gap-2">
            {BUDGET_PRESETS.map((p) => (
              <FilterChip
                key={p.label}
                on={!f.noBudget && f.budgetFrom === p.from && f.budgetTo === p.to}
                onClick={() =>
                  f.budgetFrom === p.from && f.budgetTo === p.to && !f.noBudget
                    ? onChange({ budgetFrom: "", budgetTo: "" })
                    : onChange({ budgetFrom: p.from, budgetTo: p.to, noBudget: false })
                }
              >
                {p.label}
              </FilterChip>
            ))}
            <FilterChip
              on={f.noBudget}
              onClick={() => onChange({ noBudget: !f.noBudget, budgetFrom: "", budgetTo: "" })}
              count={count((c) => !c.budgetMin && !c.budgetMax)}
            >
              Não informou
            </FilterChip>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <Input
              type="number"
              value={f.budgetFrom}
              onChange={(e) => onChange({ budgetFrom: e.target.value, noBudget: false })}
              placeholder="De"
              className="min-w-0 flex-1 font-mono tabular"
            />
            <span className="text-xs text-subtle">até</span>
            <Input
              type="number"
              value={f.budgetTo}
              onChange={(e) => onChange({ budgetTo: e.target.value, noBudget: false })}
              placeholder="Sem limite"
              className="min-w-0 flex-1 font-mono tabular"
            />
          </div>
        </FilterGroup>

        <FilterGroup title="Etapa no funil">
          <div className="flex flex-wrap gap-2">
            {DEAL_STAGES.map((s) => (
              <FilterChip
                key={s.id}
                on={f.stages.includes(s.id)}
                onClick={() => toggle("stages", s.id)}
                count={count((c) => (meta[c.id]?.stages ?? []).includes(s.id))}
              >
                <span className="size-1.5 rounded-full" style={{ background: s.dot }} />
                {s.label}
              </FilterChip>
            ))}
            <FilterChip
              on={f.stages.includes(NO_DEAL)}
              onClick={() => toggle("stages", NO_DEAL)}
              count={count((c) => !(meta[c.id]?.stages.length))}
            >
              Fora do funil
            </FilterChip>
          </div>
        </FilterGroup>

        <FilterGroup title="Visitas">
          <div className="flex flex-wrap gap-2">
            {(Object.keys(VISIT_LABELS) as ContactFilters["visits"][]).map((k) => (
              <FilterChip key={k} on={f.visits === k} onClick={() => onChange({ visits: k })}>
                {VISIT_LABELS[k]}
              </FilterChip>
            ))}
          </div>
        </FilterGroup>

        {hoods.length > 0 && (
          <FilterGroup title="Bairros de interesse">
            <div className="flex max-h-28 flex-wrap gap-2 overflow-y-auto">
              {hoods.map(([n, qty]) => (
                <FilterChip key={n} on={f.neighborhoods.includes(n)} onClick={() => toggle("neighborhoods", n)} count={qty}>
                  {n}
                </FilterChip>
              ))}
            </div>
          </FilterGroup>
        )}

        <FilterGroup title="Imóvel vinculado (negociação ou visita)">
          <Select value={f.property} onChange={(e) => onChange({ property: e.target.value })}>
            <option value="all">Qualquer imóvel</option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.code} — {p.title}
              </option>
            ))}
          </Select>
        </FilterGroup>

        <FilterGroup title="Entrou na base">
          <div className="flex flex-wrap gap-2">
            {(Object.keys(PERIOD_LABELS) as ContactFilters["period"][]).map((k) => (
              <FilterChip key={k} on={f.period === k} onClick={() => onChange({ period: k })}>
                {PERIOD_LABELS[k]}
              </FilterChip>
            ))}
          </div>
          {f.period === "custom" && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Input type="date" value={f.dateFrom} onChange={(e) => onChange({ dateFrom: e.target.value })} className="w-auto" />
              <span className="text-xs text-subtle">até</span>
              <Input type="date" value={f.dateTo} onChange={(e) => onChange({ dateTo: e.target.value })} className="w-auto" />
            </div>
          )}
        </FilterGroup>

        <FilterGroup title="E-mail">
          <div className="flex flex-wrap gap-2">
            <FilterChip on={f.email === "all"} onClick={() => onChange({ email: "all" })}>Todos</FilterChip>
            <FilterChip on={f.email === "with"} onClick={() => onChange({ email: "with" })} count={count((c) => !!c.email)}>Com e-mail</FilterChip>
            <FilterChip on={f.email === "without"} onClick={() => onChange({ email: "without" })} count={count((c) => !c.email)}>Sem e-mail</FilterChip>
          </div>
        </FilterGroup>

        <FilterGroup title="Google Contacts">
          <div className="flex flex-wrap gap-2">
            <FilterChip on={f.google === "all"} onClick={() => onChange({ google: "all" })}>Todos</FilterChip>
            <FilterChip on={f.google === "yes"} onClick={() => onChange({ google: "yes" })} count={count((c) => !!c.googleResourceName)}>Sincronizados</FilterChip>
            <FilterChip on={f.google === "no"} onClick={() => onChange({ google: "no" })} count={count((c) => !c.googleResourceName)}>Só no CRM</FilterChip>
          </div>
        </FilterGroup>
    </>
  );
}

/** CSV (separador ;) dos contatos filtrados, pronto para Excel/Sheets */
export function contactsToCsv(list: Contact[], meta: Record<string, ContactMeta>) {
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const head = [
    "Nome", "Telefone", "E-mail", "Tipo", "Origem", "Orçamento mín.", "Orçamento máx.",
    "Interesses", "Bairros", "Etapas", "Imóveis", "Entrada", "Observações",
  ];
  const rows = list.map((c) => {
    const m = meta[c.id] ?? EMPTY_META;
    return [
      c.name, c.phone, c.email, CONTACT_TYPE_LABELS[c.type], SOURCE_LABELS[c.source],
      c.budgetMin, c.budgetMax,
      c.interestTypes.map((t) => TYPE_LABELS[t] ?? t).join(", "),
      c.neighborhoods.join(", "),
      m.stages.map((s) => DEAL_STAGE_LABELS[s]).join(", "),
      m.properties.map((p) => p.code).join(", "),
      new Date(c.createdAt).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }),
      c.notes,
    ].map(esc).join(";");
  });
  return "﻿" + [head.map(esc).join(";"), ...rows].join("\r\n");
}

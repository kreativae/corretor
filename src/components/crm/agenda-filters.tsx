"use client";

import type { VisitLite } from "@/components/crm/agenda-client";
import { FilterChip, FilterGroup, type ActiveChip } from "@/components/crm/filter-sheet";
import { Select } from "@/components/ui";
import { SOURCE_LABELS, TYPE_LABELS, VISIT_STATUS_LABELS } from "@/lib/labels";
import { isRuralType } from "@/lib/rural";
import { TIME_ZONE } from "@/lib/utils";
import { Building2, Tractor } from "lucide-react";

export type AgendaFilters = {
  q: string;
  statuses: string[];
  propertyTypes: string[];
  property: string;
  neighborhoods: string[];
  sources: string[];
  shifts: string[];
  google: "all" | "yes" | "no";
};

export const EMPTY_AGENDA_FILTERS: AgendaFilters = {
  q: "",
  statuses: [],
  propertyTypes: [],
  property: "all",
  neighborhoods: [],
  sources: [],
  shifts: [],
  google: "all",
};

const SHIFTS = [
  { id: "manha", label: "Manhã", hint: "até 12h" },
  { id: "tarde", label: "Tarde", hint: "12h–18h" },
  { id: "noite", label: "Noite", hint: "após 18h" },
];

const norm = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/** Turno da visita no horário de Brasília */
function shiftOf(v: VisitLite) {
  const h = Number(
    new Date(v.visit.scheduledAt).toLocaleString("en-US", {
      hour: "numeric",
      hourCycle: "h23",
      timeZone: TIME_ZONE,
    }),
  );
  return h < 12 ? "manha" : h < 18 ? "tarde" : "noite";
}

export function applyAgendaFilters(list: VisitLite[], f: AgendaFilters): VisitLite[] {
  const term = norm(f.q);
  return list.filter((v) => {
    const { visit, contact, property } = v;
    if (term) {
      const hay = norm(
        [
          contact?.name ?? "",
          contact?.phone ?? "",
          property?.code ?? "",
          property?.title ?? "",
          property?.neighborhood ?? "",
        ].join(" "),
      );
      if (!hay.includes(term)) return false;
    }
    if (f.statuses.length && !f.statuses.includes(visit.status)) return false;
    if (f.propertyTypes.length && !f.propertyTypes.includes(property?.type ?? "")) return false;
    if (f.property !== "all" && property?.id !== f.property) return false;
    if (f.neighborhoods.length && !f.neighborhoods.includes(property?.neighborhood ?? ""))
      return false;
    if (f.sources.length && !f.sources.includes(contact?.source ?? "")) return false;
    if (f.shifts.length && !f.shifts.includes(shiftOf(v))) return false;
    if (f.google === "yes" && !visit.googleEventId) return false;
    if (f.google === "no" && visit.googleEventId) return false;
    return true;
  });
}

export function activeAgendaChips(
  f: AgendaFilters,
  propertyName: (id: string) => string,
): ActiveChip<AgendaFilters>[] {
  const chips: ActiveChip<AgendaFilters>[] = [];
  const without = (arr: string[], v: string) => arr.filter((x) => x !== v);
  for (const s of f.statuses)
    chips.push({ key: `s-${s}`, label: VISIT_STATUS_LABELS[s], clear: { statuses: without(f.statuses, s) } });
  for (const t of f.propertyTypes)
    chips.push({ key: `t-${t}`, label: TYPE_LABELS[t] ?? t, clear: { propertyTypes: without(f.propertyTypes, t) } });
  if (f.property !== "all")
    chips.push({ key: "p", label: propertyName(f.property), clear: { property: "all" } });
  for (const n of f.neighborhoods)
    chips.push({ key: `n-${n}`, label: n, clear: { neighborhoods: without(f.neighborhoods, n) } });
  for (const s of f.sources)
    chips.push({ key: `o-${s}`, label: `Origem: ${SOURCE_LABELS[s]}`, clear: { sources: without(f.sources, s) } });
  for (const s of f.shifts)
    chips.push({
      key: `sh-${s}`,
      label: SHIFTS.find((x) => x.id === s)?.label ?? s,
      clear: { shifts: without(f.shifts, s) },
    });
  if (f.google !== "all")
    chips.push({
      key: "g",
      label: f.google === "yes" ? "No Google Calendar" : "Fora do Google Calendar",
      clear: { google: "all" },
    });
  return chips;
}

export function AgendaFiltersPanel({
  value: f,
  onChange,
  visits,
  weekVisits,
}: {
  value: AgendaFilters;
  onChange: (patch: Partial<AgendaFilters>) => void;
  /** Visitas da aba (todas as datas) — base das opções */
  visits: VisitLite[];
  /** Visitas da semana exibida — base das contagens */
  weekVisits: VisitLite[];
}) {
  type ListKey = "statuses" | "propertyTypes" | "neighborhoods" | "sources" | "shifts";
  const toggle = (key: ListKey, v: string) =>
    onChange({ [key]: f[key].includes(v) ? f[key].filter((x) => x !== v) : [...f[key], v] });
  const count = (pred: (v: VisitLite) => boolean) => weekVisits.filter(pred).length;

  const hoodCount = new Map<string, number>();
  const props = new Map<string, { id: string; code: string; title: string }>();
  const types = new Set<string>();
  for (const v of visits) {
    const p = v.property;
    if (!p) continue;
    if (p.neighborhood) hoodCount.set(p.neighborhood, (hoodCount.get(p.neighborhood) ?? 0) + 1);
    props.set(p.id, { id: p.id, code: p.code, title: p.title });
    types.add(p.type);
  }
  const hoods = [...hoodCount.keys()].sort((a, b) => a.localeCompare(b));
  const propList = [...props.values()].sort((a, b) => (a.code ?? "").localeCompare(b.code ?? ""));

  const typeChips = (rural: boolean) =>
    Object.entries(TYPE_LABELS)
      .filter(([k]) => isRuralType(k) === rural && types.has(k))
      .map(([k, label]) => (
        <FilterChip
          key={k}
          on={f.propertyTypes.includes(k)}
          onClick={() => toggle("propertyTypes", k)}
          count={count((v) => v.property?.type === k)}
        >
          {label}
        </FilterChip>
      ));
  const urban = typeChips(false);
  const rural = typeChips(true);

  return (
    <>
      <p className="-mt-2 text-xs text-subtle">
        Os números ao lado de cada opção contam as visitas da semana exibida.
      </p>

      <FilterGroup title="Status da visita">
        <div className="flex flex-wrap gap-2">
          {Object.entries(VISIT_STATUS_LABELS).map(([k, label]) => (
            <FilterChip
              key={k}
              on={f.statuses.includes(k)}
              onClick={() => toggle("statuses", k)}
              count={count((v) => v.visit.status === k)}
            >
              {label}
            </FilterChip>
          ))}
        </div>
      </FilterGroup>

      <FilterGroup title="Turno">
        <div className="flex flex-wrap gap-2">
          {SHIFTS.map((s) => (
            <FilterChip
              key={s.id}
              on={f.shifts.includes(s.id)}
              onClick={() => toggle("shifts", s.id)}
              count={count((v) => shiftOf(v) === s.id)}
            >
              {s.label}
              <span className="text-[10px] opacity-60">{s.hint}</span>
            </FilterChip>
          ))}
        </div>
      </FilterGroup>

      {(urban.length > 0 || rural.length > 0) && (
        <FilterGroup title="Tipo de imóvel">
          <div className="space-y-2">
            {urban.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <Building2 className="size-3.5 text-subtle" />
                {urban}
              </div>
            )}
            {rural.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <Tractor className="size-3.5 text-subtle" />
                {rural}
              </div>
            )}
          </div>
        </FilterGroup>
      )}

      <FilterGroup title="Imóvel">
        <Select value={f.property} onChange={(e) => onChange({ property: e.target.value })}>
          <option value="all">Qualquer imóvel</option>
          {propList.map((p) => (
            <option key={p.id} value={p.id}>
              {p.code} — {p.title}
            </option>
          ))}
        </Select>
      </FilterGroup>

      {hoods.length > 0 && (
        <FilterGroup title="Bairro">
          <div className="flex max-h-32 flex-wrap gap-2 overflow-y-auto">
            {hoods.map((n) => (
              <FilterChip
                key={n}
                on={f.neighborhoods.includes(n)}
                onClick={() => toggle("neighborhoods", n)}
                count={count((v) => v.property?.neighborhood === n)}
              >
                {n}
              </FilterChip>
            ))}
          </div>
        </FilterGroup>
      )}

      <FilterGroup title="Origem do cliente">
        <div className="flex flex-wrap gap-2">
          {Object.entries(SOURCE_LABELS).map(([k, label]) => (
            <FilterChip
              key={k}
              on={f.sources.includes(k)}
              onClick={() => toggle("sources", k)}
              count={count((v) => v.contact?.source === k)}
            >
              {label}
            </FilterChip>
          ))}
        </div>
      </FilterGroup>

      <FilterGroup title="Google Calendar">
        <div className="flex flex-wrap gap-2">
          <FilterChip on={f.google === "all"} onClick={() => onChange({ google: "all" })}>
            Todas
          </FilterChip>
          <FilterChip
            on={f.google === "yes"}
            onClick={() => onChange({ google: "yes" })}
            count={count((v) => !!v.visit.googleEventId)}
          >
            Sincronizadas
          </FilterChip>
          <FilterChip
            on={f.google === "no"}
            onClick={() => onChange({ google: "no" })}
            count={count((v) => !v.visit.googleEventId)}
          >
            Só no CRM
          </FilterChip>
        </div>
      </FilterGroup>
    </>
  );
}

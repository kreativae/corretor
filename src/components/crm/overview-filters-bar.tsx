"use client";

import {
  ActiveChips,
  FilterButton,
  FilterChip,
  FilterGroup,
  FilterSheet,
  type ActiveChip,
} from "@/components/crm/filter-sheet";
import { Input } from "@/components/ui";
import { PURPOSE_LABELS, SOURCE_LABELS, TYPE_LABELS } from "@/lib/labels";
import {
  DEFAULT_OVERVIEW,
  OVERVIEW_PERIODS,
  overviewPeriodLabel,
  overviewQuery,
  type OverviewFilters,
} from "@/lib/overview-filters";
import { isRuralType } from "@/lib/rural";
import { cn } from "@/lib/utils";
import { Building2, Layers, Loader2, Tractor } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";

const STORAGE_KEY = "crm-overview-filters";

export function OverviewFiltersBar({
  value,
  hasParams,
  options,
}: {
  value: OverviewFilters;
  /** A URL já trazia filtros (não restaura os salvos) */
  hasParams: boolean;
  options: { bairros: string[]; cidades: string[]; tipos: string[] };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState(value);
  const [open, setOpen] = useState(false);

  // Mantém o rascunho alinhado ao que o servidor aplicou
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setDraft(value), [value]);

  const apply = useCallback(
    (f: OverviewFilters) => {
      const qs = overviewQuery(f);
      try {
        localStorage.setItem(STORAGE_KEY, qs);
      } catch {}
      startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
    },
    [pathname, router],
  );

  // Restaura os últimos filtros usados quando a URL vem limpa
  useEffect(() => {
    if (hasParams) return;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) router.replace(`${pathname}?${saved}`, { scroll: false });
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = (p: Partial<OverviewFilters>) => apply({ ...value, ...p });
  const patchDraft = (p: Partial<OverviewFilters>) => setDraft((d) => ({ ...d, ...p }));
  const closeSheet = useCallback(() => {
    setOpen(false);
    apply(draft);
  }, [apply, draft]);

  type ListKey = "origem" | "tipo" | "bairro" | "cidade";
  const toggle = (key: ListKey, v: string) =>
    patchDraft({ [key]: draft[key].includes(v) ? draft[key].filter((x) => x !== v) : [...draft[key], v] });

  const chips: ActiveChip<OverviewFilters>[] = [];
  const without = (arr: string[], v: string) => arr.filter((x) => x !== v);
  for (const s of value.origem)
    chips.push({ key: `o-${s}`, label: `Origem: ${SOURCE_LABELS[s] ?? s}`, clear: { origem: without(value.origem, s) } });
  for (const t of value.tipo)
    chips.push({ key: `t-${t}`, label: TYPE_LABELS[t] ?? t, clear: { tipo: without(value.tipo, t) } });
  for (const b of value.bairro)
    chips.push({ key: `b-${b}`, label: b, clear: { bairro: without(value.bairro, b) } });
  for (const c of value.cidade)
    chips.push({ key: `c-${c}`, label: c, clear: { cidade: without(value.cidade, c) } });
  if (value.finalidade)
    chips.push({ key: "f", label: PURPOSE_LABELS[value.finalidade], clear: { finalidade: "" } });

  const typeOptions = options.tipos.filter(
    (t) => value.seg === "todos" || isRuralType(t) === (value.seg === "rurais"),
  );

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-full border border-hairline p-1">
          {(
            [
              { id: "todos", label: "Todos", icon: Layers },
              { id: "imoveis", label: "Imóveis", icon: Building2 },
              { id: "rurais", label: "Rurais", icon: Tractor },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              onClick={() => set({ seg: t.id, tipo: [] })}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-all duration-300",
                value.seg === t.id ? "bg-ink text-canvas" : "text-subtle hover:text-ink",
              )}
            >
              <t.icon className="size-3.5" />
              {t.label}
            </button>
          ))}
        </div>

        <div className="inline-flex flex-wrap rounded-full border border-hairline p-1">
          {OVERVIEW_PERIODS.map((p) => (
            <button
              key={p.id}
              onClick={() => (p.id === "custom" ? setOpen(true) : set({ periodo: p.id }))}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-300",
                value.periodo === p.id ? "bg-ink text-canvas" : "text-subtle hover:text-ink",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>

        <FilterButton count={chips.length} onClick={() => setOpen(true)} />
        {pending && <Loader2 className="size-4 animate-spin text-subtle" aria-label="Atualizando" />}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <ActiveChips
          chips={chips}
          onClear={(p) => set(p)}
          onClearAll={() => set({ origem: [], tipo: [], bairro: [], cidade: [], finalidade: "" })}
        />
      </div>
      <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.16em] text-subtle">
        Indicadores do período: {overviewPeriodLabel(value)}
      </p>

      <FilterSheet
        open={open}
        onClose={closeSheet}
        onReset={() => setDraft({ ...DEFAULT_OVERVIEW, seg: draft.seg })}
        title="Filtrar visão geral"
        activeCount={chips.length + (value.periodo !== "30" ? 1 : 0)}
        resultLabel="Aplicar filtros"
      >
        <FilterGroup title="Período (leads, visitas e fechamentos)">
          <div className="flex flex-wrap gap-2">
            {OVERVIEW_PERIODS.map((p) => (
              <FilterChip key={p.id} on={draft.periodo === p.id} onClick={() => patchDraft({ periodo: p.id })}>
                {p.label}
              </FilterChip>
            ))}
          </div>
          {draft.periodo === "custom" && (
            <div className="mt-3 flex items-center gap-2">
              <Input type="date" value={draft.de} onChange={(e) => patchDraft({ de: e.target.value })} className="min-w-0 flex-1" />
              <span className="text-xs text-subtle">até</span>
              <Input type="date" value={draft.ate} onChange={(e) => patchDraft({ ate: e.target.value })} className="min-w-0 flex-1" />
            </div>
          )}
        </FilterGroup>

        <FilterGroup title="Origem do lead">
          <div className="flex flex-wrap gap-2">
            {Object.entries(SOURCE_LABELS).map(([k, label]) => (
              <FilterChip key={k} on={draft.origem.includes(k)} onClick={() => toggle("origem", k)}>
                {label}
              </FilterChip>
            ))}
          </div>
        </FilterGroup>

        {typeOptions.length > 0 && (
          <FilterGroup title="Tipo de imóvel">
            <div className="flex flex-wrap gap-2">
              {typeOptions.map((t) => (
                <FilterChip key={t} on={draft.tipo.includes(t)} onClick={() => toggle("tipo", t)}>
                  {TYPE_LABELS[t] ?? t}
                </FilterChip>
              ))}
            </div>
          </FilterGroup>
        )}

        <FilterGroup title="Finalidade">
          <div className="flex flex-wrap gap-2">
            <FilterChip on={!draft.finalidade} onClick={() => patchDraft({ finalidade: "" })}>
              Todas
            </FilterChip>
            {(["venda", "aluguel"] as const).map((k) => (
              <FilterChip key={k} on={draft.finalidade === k} onClick={() => patchDraft({ finalidade: k })}>
                {PURPOSE_LABELS[k]}
              </FilterChip>
            ))}
          </div>
        </FilterGroup>

        {options.bairros.length > 0 && (
          <FilterGroup title="Bairro / região">
            <div className="flex max-h-36 flex-wrap gap-2 overflow-y-auto">
              {options.bairros.map((b) => (
                <FilterChip key={b} on={draft.bairro.includes(b)} onClick={() => toggle("bairro", b)}>
                  {b}
                </FilterChip>
              ))}
            </div>
          </FilterGroup>
        )}

        {options.cidades.length > 1 && (
          <FilterGroup title="Cidade">
            <div className="flex flex-wrap gap-2">
              {options.cidades.map((c) => (
                <FilterChip key={c} on={draft.cidade.includes(c)} onClick={() => toggle("cidade", c)}>
                  {c}
                </FilterChip>
              ))}
            </div>
          </FilterGroup>
        )}
      </FilterSheet>
    </div>
  );
}

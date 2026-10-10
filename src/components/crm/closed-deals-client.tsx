"use client";

import {
  activeDealChips,
  applyDealFilters,
  DealFiltersPanel,
  EMPTY_DEAL_FILTERS,
  type DealFilters,
} from "@/components/crm/deal-filters";
import { ActiveChips, FilterButton, FilterSheet } from "@/components/crm/filter-sheet";
import { LeadDrawer } from "@/components/crm/lead-drawer";
import { Badge, Input, Select } from "@/components/ui";
import { PURPOSE_LABELS, SOURCE_LABELS, TYPE_LABELS } from "@/lib/labels";
import type { DealFull } from "@/lib/queries";
import { crmPropertyPath, isRuralType } from "@/lib/rural";
import { cn, formatBRL, formatCompact, formatDate, formatNumber, initials } from "@/lib/utils";
import { Building2, Download, Handshake, Layers, Search, Tractor } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

export type ClosedTab = "todos" | "imoveis" | "rurais";

const FILTERS_KEY = "crm-closed-filters";
const DAY = 86_400_000;
const isRuralDeal = (d: DealFull) => isRuralType(d.property?.type);

export function ClosedDealsClient({
  deals,
  closedAt,
  initialTab = "todos",
}: {
  deals: DealFull[];
  /** Data de fechamento (ISO) por id de negócio */
  closedAt: Record<string, string>;
  initialTab?: ClosedTab;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [tab, setTab] = useState<ClosedTab>(initialTab);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [filters, setFilters] = useState<DealFilters>(EMPTY_DEAL_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const patch = (p: Partial<DealFilters>) => setFilters((f) => ({ ...f, ...p }));
  const resetFilters = () => setFilters((f) => ({ ...EMPTY_DEAL_FILTERS, q: f.q, sort: f.sort }));
  const closeFilters = useCallback(() => setShowFilters(false), []);

  // Lembra os filtros do usuário neste navegador
  useEffect(() => {
    try {
      const saved = localStorage.getItem(FILTERS_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved) setFilters({ ...EMPTY_DEAL_FILTERS, ...JSON.parse(saved), q: "" });
    } catch {}
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(FILTERS_KEY, JSON.stringify(filters));
    } catch {}
  }, [filters]);

  const closedTime = useCallback(
    (d: DealFull) => new Date(closedAt[d.deal.id] ?? d.deal.updatedAt).getTime(),
    [closedAt],
  );
  const cycleDays = (d: DealFull) =>
    Math.max(0, Math.round((closedTime(d) - new Date(d.deal.createdAt).getTime()) / DAY));

  const counts = {
    todos: deals.length,
    imoveis: deals.filter((d) => !isRuralDeal(d)).length,
    rurais: deals.filter(isRuralDeal).length,
  };
  const inTab = useMemo(
    () =>
      tab === "todos" ? deals : deals.filter((d) => isRuralDeal(d) === (tab === "rurais")),
    [deals, tab],
  );
  const filtered = useMemo(
    () => applyDealFilters(inTab, filters, closedTime),
    [inTab, filters, closedTime],
  );
  const chips = activeDealChips(filters, true);

  const total = filtered.reduce((a, d) => a + d.deal.value, 0);
  const ticket = filtered.length ? total / filtered.length : 0;
  const avgCycle = filtered.length
    ? Math.round(filtered.reduce((a, d) => a + cycleDays(d), 0) / filtered.length)
    : 0;

  function switchTab(t: ClosedTab) {
    setTab(t);
    router.replace(t === "todos" ? pathname : `${pathname}?tipo=${t}`, { scroll: false });
  }

  function exportCsv() {
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const head = ["Cliente", "Telefone", "Imóvel", "Código", "Tipo", "Bairro", "Cidade", "Valor", "Aberto em", "Fechado em", "Ciclo (dias)", "Origem"];
    const rows = filtered.map((d) =>
      [
        d.contact?.name, d.contact?.phone, d.property?.title, d.property?.code,
        d.property ? TYPE_LABELS[d.property.type] : "", d.property?.neighborhood, d.property?.city,
        d.deal.value, formatDate(d.deal.createdAt), formatDate(new Date(closedTime(d))),
        cycleDays(d), d.contact ? SOURCE_LABELS[d.contact.source] : "",
      ].map(esc).join(";"),
    );
    const blob = new Blob(["﻿" + [head.map(esc).join(";"), ...rows].join("\r\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `negocios-fechados-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div className="mb-4 inline-flex rounded-full border border-hairline p-1">
        {(
          [
            { id: "todos", label: "Todos", icon: Layers },
            { id: "imoveis", label: "Imóveis", icon: Building2 },
            { id: "rurais", label: "Rurais", icon: Tractor },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            onClick={() => switchTab(t.id)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-all duration-300",
              tab === t.id ? "bg-ink text-canvas" : "text-subtle hover:text-ink",
            )}
          >
            <t.icon className="size-3.5" />
            {t.label}
            <span className="font-mono text-[10.5px] opacity-60">{counts[t.id]}</span>
          </button>
        ))}
      </div>

      {/* Indicadores do recorte filtrado */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: "Negócios", value: formatNumber(filtered.length) },
          { label: "Volume vendido", value: formatCompact(total) },
          { label: "Ticket médio", value: formatCompact(Math.round(ticket)) },
          { label: "Ciclo médio", value: `${avgCycle} ${avgCycle === 1 ? "dia" : "dias"}` },
        ].map((k) => (
          <div key={k.label} className="rounded-2xl border border-hairline bg-card p-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-subtle">{k.label}</p>
            <p className="mt-2 font-mono text-2xl font-medium tabular">{k.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-subtle" />
          <Input
            value={filters.q}
            onChange={(e) => patch({ q: e.target.value })}
            placeholder="Buscar por cliente, código ou imóvel…"
            className="pl-10"
          />
        </div>
        <FilterButton count={chips.length} onClick={() => setShowFilters(true)} />
        <Select
          value={filters.sort === "stale" ? "recent" : filters.sort}
          onChange={(e) => patch({ sort: e.target.value as DealFilters["sort"] })}
          className="w-auto"
          aria-label="Ordenar"
        >
          <option value="recent">Fechados mais recentes</option>
          <option value="oldest">Fechados mais antigos</option>
          <option value="value_desc">Maior valor</option>
          <option value="value_asc">Menor valor</option>
        </Select>
      </div>
      <ActiveChips chips={chips} onClear={patch} onClearAll={resetFilters} />

      <FilterSheet
        open={showFilters}
        onClose={closeFilters}
        onReset={resetFilters}
        title="Filtrar negócios fechados"
        activeCount={chips.length}
        resultLabel={`Ver ${filtered.length} ${filtered.length === 1 ? "negócio" : "negócios"}`}
      >
        <DealFiltersPanel value={filters} onChange={patch} deals={inTab} closed />
      </FilterSheet>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-subtle">
          {filtered.length} de {inTab.length} negócios
        </p>
        <button
          onClick={exportCsv}
          disabled={!filtered.length}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-subtle hover:text-ink disabled:opacity-40"
        >
          <Download className="size-3.5" />
          Exportar CSV ({filtered.length})
        </button>
      </div>

      <div className="mt-3 overflow-x-auto rounded-2xl border border-hairline bg-card">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead>
            <tr className="border-b border-hairline font-mono text-[10px] uppercase tracking-[0.16em] text-subtle">
              <th className="px-5 py-3.5 font-medium">Cliente</th>
              <th className="px-4 py-3.5 font-medium">Imóvel</th>
              <th className="px-4 py-3.5 font-medium">Origem</th>
              <th className="px-4 py-3.5 text-right font-medium">Valor</th>
              <th className="px-4 py-3.5 text-right font-medium">Fechado em</th>
              <th className="px-4 py-3.5 text-right font-medium">Ciclo</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((d) => {
              const { deal, contact, property } = d;
              const cycle = cycleDays(d);
              return (
                <tr key={deal.id} className="group border-b border-hairline/60 transition-colors last:border-0 hover:bg-soft/50">
                  <td className="px-5 py-3">
                    <button
                      onClick={() => contact && setPreviewId(contact.id)}
                      className="flex min-w-0 items-center gap-3 text-left"
                      title="Visão rápida do lead"
                    >
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-soft font-mono text-[10px] font-semibold text-subtle">
                        {contact ? initials(contact.name) : "—"}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate font-medium leading-tight group-hover:underline group-hover:underline-offset-4">
                          {contact?.name ?? "Contato removido"}
                        </span>
                        <span className="mt-0.5 block font-mono text-[10.5px] tabular text-subtle">
                          {contact?.phone ?? ""}
                        </span>
                      </span>
                    </button>
                  </td>
                  <td className="max-w-64 px-4 py-3">
                    {property ? (
                      <Link href={crmPropertyPath(property)} className="block min-w-0 hover:underline hover:underline-offset-4">
                        <span className="flex items-center gap-1.5 truncate text-[13px]">
                          {isRuralType(property.type) && <Tractor className="size-3.5 shrink-0 text-emerald-600" />}
                          <span className="truncate">{property.title}</span>
                        </span>
                        <span className="mt-0.5 block font-mono text-[10px] uppercase tracking-wider text-subtle">
                          {property.code} · {TYPE_LABELS[property.type]} · {PURPOSE_LABELS[property.purpose]}
                        </span>
                      </Link>
                    ) : (
                      <span className="text-subtle">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {contact ? <Badge className="border border-hairline">{SOURCE_LABELS[contact.source]}</Badge> : "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-medium tabular">
                    {deal.value ? formatBRL(deal.value) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs tabular text-subtle">
                    {formatDate(new Date(closedTime(d)))}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs tabular text-subtle">
                    {cycle} {cycle === 1 ? "dia" : "dias"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-14 text-center text-sm text-subtle">
            <Handshake className="size-5" />
            {inTab.length
              ? "Nenhum negócio fechado com esses filtros."
              : "Nenhum negócio fechado ainda — mova uma negociação para “Fechado” no pipeline."}
          </div>
        )}
      </div>

      <LeadDrawer contactId={previewId} onClose={() => setPreviewId(null)} />
    </div>
  );
}

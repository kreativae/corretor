"use client";

import {
  activeDealChips,
  applyDealFilters,
  DealFiltersPanel,
  EMPTY_DEAL_FILTERS,
  type DealFilters,
} from "@/components/crm/deal-filters";
import { ActiveChips, FilterButton, FilterSheet } from "@/components/crm/filter-sheet";
import { MobileCollapse } from "@/components/crm/mobile-collapse";
import { LeadDrawer } from "@/components/crm/lead-drawer";
import { StatCard } from "@/components/crm/stat-card";
import { StatsGrid } from "@/components/crm/stats-grid";
import { Button, Field, Input, Modal, Select } from "@/components/ui";
import { DEAL_STAGES } from "@/lib/labels";
import type { DealFull } from "@/lib/queries";
import { formatAlq, isRuralType, normalizeRural } from "@/lib/rural";
import { cn, formatCompact, initials, timeAgo } from "@/lib/utils";
import {
  ArrowUpRight,
  Building2,
  Columns3,
  Flag,
  GripVertical,
  Handshake,
  Hourglass,
  Eye,
  Layers,
  MessageCircle,
  Plus,
  Search,
  Tractor,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

export type PipelineTab = "imoveis" | "rurais" | "todos";

const isRuralDeal = (d: DealFull) => isRuralType(d.property?.type);

const FILTERS_KEY = "crm-deal-filters";

export function Kanban({
  initialDeals,
  contacts,
  properties,
  initialTab = "imoveis",
  showClosedLink = false,
  focusDealId,
}: {
  initialDeals: DealFull[];
  contacts: { id: string; name: string }[];
  properties: { id: string; code: string; title: string; price: number; type: string }[];
  initialTab?: PipelineTab;
  /** Atalho para /crm/fechados (módulo opcional) */
  showClosedLink?: boolean;
  /** Vindo da busca: destaca e rola até esta negociação */
  focusDealId?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [deals, setDeals] = useState(initialDeals);
  const [tab, setTab] = useState<PipelineTab>(initialTab);
  // Negociações sem imóvel definido ficam junto dos imóveis urbanos
  const visible = useMemo(
    () =>
      tab === "todos"
        ? deals
        : deals.filter((d) => (tab === "rurais" ? isRuralDeal(d) : !isRuralDeal(d))),
    [deals, tab],
  );
  const counts = {
    imoveis: deals.filter((d) => !isRuralDeal(d)).length,
    rurais: deals.filter(isRuralDeal).length,
    todos: deals.length,
  };
  const modalProperties =
    tab === "todos" ? properties : properties.filter((p) => isRuralType(p.type) === (tab === "rurais"));

  function switchTab(t: PipelineTab) {
    setTab(t);
    router.replace(t === "imoveis" ? pathname : `${pathname}?tipo=${t}`, { scroll: false });
  }
  const [dragId, setDragId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [mobileStage, setMobileStage] = useState<string>(
    () => initialDeals.find((d) => d.deal.id === focusDealId)?.deal.stage ?? "novo",
  );
  const [highlight, setHighlight] = useState<string | null>(focusDealId ?? null);
  // Arrastar no toque (celular)
  const [touchDrag, setTouchDrag] = useState<{
    id: string;
    name: string;
    x: number;
    y: number;
    over: string | null;
  } | null>(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ contactId: "", propertyId: "", value: "", stage: "novo" });

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

  const filtered = useMemo(() => applyDealFilters(visible, filters), [visible, filters]);
  const chips = activeDealChips(filters);
  const totalValue = filtered.reduce((a, d) => a + d.deal.value, 0);

  // Indicadores do que está na tela (respeitam aba e filtros)
  const stats = useMemo(() => {
    const open = filtered.filter((d) => d.deal.stage !== "fechado");
    const closed = filtered.filter((d) => d.deal.stage === "fechado");
    const sum = (list: DealFull[]) => list.reduce((a, d) => a + d.deal.value, 0);
    const reta = open.filter((d) => ["proposta", "documentacao"].includes(d.deal.stage));
    const limite = new Date().getTime() - 15 * 86_400_000;
    const paradas = open.filter((d) => new Date(d.deal.updatedAt).getTime() < limite);
    const comValor = open.filter((d) => d.deal.value > 0);
    return {
      abertas: open.length,
      semImovel: open.filter((d) => !d.property).length,
      valorAberto: sum(open),
      ticket: comValor.length ? Math.round(sum(comValor) / comValor.length) : 0,
      reta: reta.length,
      valorReta: sum(reta),
      paradas: paradas.length,
      conversao: filtered.length ? Math.round((closed.length / filtered.length) * 100) : 0,
      fechadas: closed.length,
      valorFechado: sum(closed),
    };
  }, [filtered]);
  const stages = filters.stages.length
    ? DEAL_STAGES.filter((s) => filters.stages.includes(s.id))
    : DEAL_STAGES;

  // Busca → /crm/pipeline?negocio=ID: rola até o cartão, destaca por alguns segundos
  useEffect(() => {
    if (!focusDealId) return;
    const t = window.setTimeout(() => {
      const els = Array.from(document.querySelectorAll<HTMLElement>(`[data-deal-id="${focusDealId}"]`));
      els.find((el) => el.offsetParent !== null)?.scrollIntoView({ block: "center", inline: "center", behavior: "smooth" });
      router.replace(pathname, { scroll: false });
    }, 300);
    const clear = window.setTimeout(() => setHighlight(null), 4000);
    return () => {
      window.clearTimeout(t);
      window.clearTimeout(clear);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusDealId]);

  // Etapa exibida no celular (cai na primeira visível se o filtro a esconder)
  const activeMobileStage = stages.some((st) => st.id === mobileStage)
    ? mobileStage
    : stages[0]?.id;

  const byStage = useMemo(() => {
    const map = new Map<string, DealFull[]>();
    for (const s of DEAL_STAGES) map.set(s.id, []);
    for (const d of filtered) map.get(d.deal.stage)?.push(d);
    return map;
  }, [filtered]);

  async function move(dealId: string, stage: string) {
    const prev = deals;
    const target = deals.find((d) => d.deal.id === dealId);
    if (!target || target.deal.stage === stage) return;
    setDeals((arr) =>
      arr.map((d) =>
        d.deal.id === dealId
          ? { ...d, deal: { ...d.deal, stage: stage as DealFull["deal"]["stage"] } }
          : d,
      ),
    );
    try {
      const res = await fetch(`/api/deals/${dealId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage }),
      });
      if (!res.ok) throw new Error();
      const stageLabel = DEAL_STAGES.find((s) => s.id === stage)?.label;
      toast.success(`Movido para “${stageLabel}”.`);
      router.refresh();
    } catch {
      setDeals(prev);
      toast.error("Não foi possível mover a negociação.");
    }
  }

  async function createDeal() {
    if (!form.contactId) {
      toast.error("Selecione um contato.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/deals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactId: form.contactId,
          propertyId: form.propertyId || null,
          value: form.value ? Number(form.value) : 0,
          stage: form.stage,
        }),
      });
      if (!res.ok) throw new Error();
      const created = await res.json();
      const contact = contacts.find((c) => c.id === form.contactId);
      const property = properties.find((p) => p.id === form.propertyId) ?? null;
      setDeals((arr) => [
        {
          deal: created,
          contact: contact
            ? ({ id: contact.id, name: contact.name } as DealFull["contact"])
            : null,
          property: property
            ? ({ id: property.id, code: property.code, title: property.title, price: property.price, type: property.type } as DealFull["property"])
            : null,
        },
        ...arr,
      ]);
      toast.success("Negociação aberta no pipeline.");
      setOpen(false);
      setForm({ contactId: "", propertyId: "", value: "", stage: "novo" });
      router.refresh();
    } catch {
      toast.error("Erro ao criar negociação.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-full border border-hairline p-1">
          {(
            [
              { id: "imoveis", label: "Imóveis", icon: Building2 },
              { id: "rurais", label: "Rurais", icon: Tractor },
              { id: "todos", label: "Todos", icon: Layers },
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
        <Button variant="primary" onClick={() => setOpen(true)}>
          <Plus className="size-4" />
          Nova<span className="hidden sm:inline"> negociação</span>
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <MobileCollapse count={chips.length + (filters.q ? 1 : 0)}>
          <div className="relative min-w-56 flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-subtle" />
            <Input
              value={filters.q}
              onChange={(e) => patch({ q: e.target.value })}
              placeholder="Buscar por contato, código ou imóvel…"
              className="pl-10"
            />
          </div>
          <FilterButton count={chips.length} onClick={() => setShowFilters(true)} />
          <Select
            value={filters.sort}
            onChange={(e) => patch({ sort: e.target.value as DealFilters["sort"] })}
            className="w-auto"
            aria-label="Ordenar cartões"
          >
            <option value="recent">Mais recentes</option>
            <option value="oldest">Mais antigas</option>
            <option value="value_desc">Maior valor</option>
            <option value="value_asc">Menor valor</option>
            <option value="stale">Paradas há mais tempo</option>
          </Select>
        </MobileCollapse>
      </div>
      <ActiveChips chips={chips} onClear={patch} onClearAll={resetFilters} />

      {/* Indicadores */}
      <StatsGrid className="mt-5" gridClassName="gap-3 lg:grid-cols-5">
        <StatCard
          label="Negociações abertas"
          value={stats.abertas}
          caption={stats.semImovel ? `${stats.semImovel} sem imóvel definido` : "Fora a coluna Fechado"}
          icon={<Columns3 className="size-4" />}
        />
        <StatCard
          label="Valor em aberto"
          value={stats.valorAberto}
          format="brl"
          caption={stats.ticket ? `Ticket médio ${formatCompact(stats.ticket)}` : "Sem valores informados"}
          icon={<Wallet className="size-4" />}
        />
        <StatCard
          label="Reta final"
          value={stats.reta}
          caption={stats.reta ? `Proposta e documentação · ${formatCompact(stats.valorReta)}` : "Nada em proposta ou documentação"}
          icon={<Flag className="size-4" />}
        />
        <StatCard
          label="Paradas +15 dias"
          value={stats.paradas}
          caption={stats.paradas ? "Sem movimentação — vale um contato" : "Tudo em movimento"}
          icon={<Hourglass className="size-4" />}
        />
        <StatCard
          label="Conversão"
          value={stats.conversao}
          format="pct"
          caption={`${stats.fechadas} ${stats.fechadas === 1 ? "fechada" : "fechadas"} · ${formatCompact(stats.valorFechado)}`}
          icon={<Handshake className="size-4" />}
        />
      </StatsGrid>
      <p className="mb-3 mt-4 font-mono text-[11px] uppercase tracking-[0.16em] text-subtle">
        {filtered.length} de {visible.length} negociações · {formatCompact(totalValue)}
      </p>

      <FilterSheet
        open={showFilters}
        onClose={closeFilters}
        onReset={resetFilters}
        title="Filtrar pipeline"
        activeCount={chips.length}
        resultLabel={`Ver ${filtered.length} ${filtered.length === 1 ? "negociação" : "negociações"}`}
      >
        <DealFiltersPanel value={filters} onChange={patch} deals={visible} />
      </FilterSheet>

      {/* Celular: soltar arrastando — etapas como alvos e "fantasma" seguindo o dedo */}
      {touchDrag && (
        <div className="pointer-events-none fixed inset-0 z-[60] md:hidden">
          <div className="pointer-events-auto absolute inset-x-0 bottom-0 rounded-t-3xl border-t border-hairline bg-card/95 p-3 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl backdrop-blur-xl">
            <p className="mb-2 text-center font-mono text-[10px] uppercase tracking-[0.18em] text-subtle">
              Solte na etapa
            </p>
            <div className="grid grid-cols-3 gap-2">
              {DEAL_STAGES.map((st) => (
                <div
                  key={st.id}
                  data-drop-stage={st.id}
                  className={cn(
                    "flex h-14 flex-col items-center justify-center gap-1 rounded-xl border text-center text-[11px] font-medium leading-tight transition-all",
                    touchDrag.over === st.id
                      ? "scale-105 border-transparent bg-ink text-canvas"
                      : "border-hairline bg-canvas",
                  )}
                >
                  <span className="size-2 rounded-full" style={{ background: st.dot }} />
                  {st.label}
                </div>
              ))}
            </div>
          </div>
          <div
            className="absolute z-10 max-w-[60vw] -translate-x-1/2 -translate-y-[130%] truncate rounded-full bg-ink px-3.5 py-2 text-xs font-medium text-canvas shadow-2xl"
            style={{ left: touchDrag.x, top: touchDrag.y }}
          >
            {touchDrag.name}
          </div>
        </div>
      )}

      {/* Celular: uma etapa por vez, cartões largos; mover arrastando pela alça ou pelo seletor */}
      <div className="md:hidden">
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-3 [scrollbar-width:none]">
          {stages.map((st) => {
            const n = byStage.get(st.id)?.length ?? 0;
            const on = activeMobileStage === st.id;
            return (
              <button
                key={st.id}
                type="button"
                onClick={() => setMobileStage(st.id)}
                className={cn(
                  "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                  on ? "border-transparent bg-ink text-canvas" : "border-hairline text-subtle",
                )}
              >
                <span className="size-1.5 rounded-full" style={{ background: st.dot }} />
                {st.label}
                <span className="font-mono text-[10px] opacity-60">{n}</span>
              </button>
            );
          })}
        </div>
        {(() => {
          const current = stages.find((st) => st.id === activeMobileStage);
          const items = current ? byStage.get(current.id) ?? [] : [];
          const sum = items.reduce((a, d) => a + d.deal.value, 0);
          return (
            <div className="space-y-3">
              <p className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-subtle">
                {items.length} {items.length === 1 ? "negociação" : "negociações"} · {formatCompact(sum)}
              </p>
              {items.length === 0 && (
                <p className="rounded-2xl border border-hairline bg-card py-12 text-center text-sm text-subtle">
                  Nenhuma negociação em “{current?.label}”.
                </p>
              )}
              {items.map(({ deal, contact, property }) => {
                const digits = contact?.phone?.replace(/\D/g, "") ?? "";
                const wa = digits.length >= 10 ? (digits.startsWith("55") ? digits : `55${digits}`) : null;
                return (
                  <div
                    key={deal.id}
                    data-deal-id={deal.id}
                    className={cn(
                      "flex gap-1.5 rounded-2xl border border-hairline bg-card py-3.5 pl-1.5 pr-3.5 transition-all",
                      touchDrag?.id === deal.id && "opacity-40",
                      highlight === deal.id && "ring-2 ring-[rgb(var(--accent))] ring-offset-2 ring-offset-canvas",
                    )}
                  >
                    {/* Alça de arrastar (toque): solte numa etapa do painel que aparece embaixo */}
                    <span
                      role="button"
                      aria-label="Arrastar para outra etapa"
                      title="Segure e arraste para outra etapa"
                      className="flex w-6 shrink-0 cursor-grab touch-none select-none items-center justify-center rounded-lg text-subtle/70 active:bg-soft"
                      onPointerDown={(e) => {
                        e.currentTarget.setPointerCapture(e.pointerId);
                        navigator.vibrate?.(12);
                        setTouchDrag({ id: deal.id, name: contact?.name ?? "Negociação", x: e.clientX, y: e.clientY, over: null });
                      }}
                      onPointerMove={(e) => {
                        if (!touchDrag) return;
                        const el = document
                          .elementFromPoint(e.clientX, e.clientY)
                          ?.closest<HTMLElement>("[data-drop-stage]");
                        setTouchDrag({ ...touchDrag, x: e.clientX, y: e.clientY, over: el?.dataset.dropStage ?? null });
                      }}
                      onPointerUp={() => {
                        if (touchDrag?.over) {
                          void move(touchDrag.id, touchDrag.over);
                          setMobileStage(touchDrag.over);
                        }
                        setTouchDrag(null);
                      }}
                      onPointerCancel={() => setTouchDrag(null)}
                    >
                      <GripVertical className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={() => contact && setPreviewId(contact.id)}
                        className="flex w-full items-center gap-3 text-left"
                      >
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-soft font-mono text-[10.5px] font-semibold text-subtle">
                          {contact ? initials(contact.name) : "—"}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[15px] font-medium leading-tight">
                            {contact?.name ?? "Contato removido"}
                          </span>
                          <span className="mt-0.5 block truncate text-xs text-subtle">
                            {property ? (
                              <>
                                <span className="font-mono text-[10.5px] uppercase tracking-wider">{property.code}</span> ·{" "}
                                {property.title}
                              </>
                            ) : (
                              "Imóvel a definir"
                            )}
                          </span>
                        </span>
                        <span className="shrink-0 text-right font-mono text-sm font-medium tabular">
                          {deal.value ? formatCompact(deal.value) : "—"}
                        </span>
                      </button>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-subtle">
                        {property && isRuralType(property.type) && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 font-medium text-emerald-600">
                            <Tractor className="size-3" />
                            {normalizeRural(property.rural).totalAlq
                              ? `${formatAlq(normalizeRural(property.rural).totalAlq ?? 0)} alq`
                              : "Rural"}
                          </span>
                        )}
                        <span>Atualizada {timeAgo(deal.updatedAt)}</span>
                      </div>
                      <div className="mt-3 flex items-center gap-2 border-t border-hairline pt-3">
                        <Select
                          value={deal.stage}
                          onChange={(e) => move(deal.id, e.target.value)}
                          aria-label="Mover para"
                          className="h-9 min-w-0 flex-1 text-xs"
                        >
                          {DEAL_STAGES.map((st) => (
                            <option key={st.id} value={st.id}>
                              {st.id === deal.stage ? `Em: ${st.label}` : `Mover para ${st.label}`}
                            </option>
                          ))}
                        </Select>
                        {wa && (
                          <a href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer" aria-label="WhatsApp">
                            <Button variant="ghost" size="icon">
                              <MessageCircle className="size-4 text-emerald-600" />
                            </Button>
                          </a>
                        )}
                        {contact && (
                          <Button variant="ghost" size="icon" aria-label="Visão rápida" onClick={() => setPreviewId(contact.id)}>
                            <Eye className="size-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()}
      </div>

      {/* Quadro (tablet e computador) */}
      <div className="hidden gap-3 overflow-x-auto pb-4 md:flex">
        {stages.map((stage) => {
          const items = byStage.get(stage.id) ?? [];
          const sum = items.reduce((a, d) => a + d.deal.value, 0);
          return (
            <div
              key={stage.id}
              onDragOver={(e) => {
                e.preventDefault();
                setOverStage(stage.id);
              }}
              onDragLeave={() => setOverStage((s) => (s === stage.id ? null : s))}
              onDrop={(e) => {
                e.preventDefault();
                if (dragId) move(dragId, stage.id);
                setDragId(null);
                setOverStage(null);
              }}
              className={cn(
                "flex w-72 shrink-0 flex-col rounded-2xl border p-3 transition-colors duration-200",
                overStage === stage.id
                  ? "border-[rgb(var(--accent))/0.5] bg-soft"
                  : "border-hairline bg-card",
              )}
            >
              <div className="flex items-center gap-2 px-1.5 pb-3 pt-1">
                <span className="size-2 rounded-full" style={{ background: stage.dot }} />
                <p className="text-[13px] font-semibold">{stage.label}</p>
                <span className="rounded-full bg-soft px-2 py-0.5 font-mono text-[10px] tabular text-subtle">
                  {items.length}
                </span>
                <span className="ml-auto font-mono text-[10.5px] tabular text-subtle">
                  {formatCompact(sum)}
                </span>
                {stage.id === "fechado" && showClosedLink && (
                  <Link
                    href="/crm/fechados"
                    title="Ver todos os negócios fechados"
                    className="rounded-full p-1 text-subtle transition-colors hover:bg-soft hover:text-ink"
                  >
                    <ArrowUpRight className="size-3.5" />
                  </Link>
                )}
              </div>

              <div className="flex min-h-24 flex-1 flex-col gap-2">
                {items.map(({ deal, contact, property }) => (
                  <div
                    key={deal.id}
                    data-deal-id={deal.id}
                    draggable
                    onDragStart={() => setDragId(deal.id)}
                    onDragEnd={() => {
                      setDragId(null);
                      setOverStage(null);
                    }}
                    onClick={() => {
                      if (!dragId && contact) setPreviewId(contact.id);
                    }}
                    title="Arraste para mover · clique para visão rápida do lead"
                    className={cn(
                      "cursor-grab rounded-xl border border-hairline bg-canvas p-3.5 transition-all duration-200 hover:border-hairline-strong hover:shadow-md active:cursor-grabbing",
                      dragId === deal.id && "rotate-2 opacity-40",
                      highlight === deal.id && "ring-2 ring-[rgb(var(--accent))] ring-offset-2 ring-offset-canvas",
                    )}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-soft font-mono text-[10px] font-semibold text-subtle">
                        {contact ? initials(contact.name) : "—"}
                      </span>
                      <p className="truncate text-[13px] font-medium leading-tight">
                        {contact?.name ?? "Contato removido"}
                      </p>
                    </div>
                    {property && isRuralType(property.type) && (
                      <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-600">
                        <Tractor className="size-3" />
                        {normalizeRural(property.rural).totalAlq
                          ? `${formatAlq(normalizeRural(property.rural).totalAlq ?? 0)} alq`
                          : "Rural"}
                      </span>
                    )}
                    {property && (
                      <p className="mt-2 truncate text-[11.5px] text-subtle">
                        <span className="font-mono text-[10px] uppercase tracking-wider">
                          {property.code}
                        </span>{" "}
                        · {property.title}
                      </p>
                    )}
                    <div className="mt-2.5 flex items-center justify-between border-t border-hairline pt-2.5">
                      <span className="font-mono text-xs font-medium tabular">
                        {deal.value ? formatCompact(deal.value) : "—"}
                      </span>
                      {stage.id === "fechado" && (
                        <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-500">
                          <Handshake className="size-3" />
                          fechado
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <LeadDrawer contactId={previewId} onClose={() => setPreviewId(null)} />

      {/* Nova negociação */}
      <Modal open={open} onClose={() => setOpen(false)} title="Nova negociação">
        <div className="space-y-4">
          <Field label="Contato">
            <Select value={form.contactId} onChange={(e) => setForm({ ...form, contactId: e.target.value })}>
              <option value="">Selecionar…</option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          </Field>
          <Field label={tab === "rurais" ? "Propriedade de interesse" : "Imóvel de interesse"}>
            <Select
              value={form.propertyId}
              onChange={(e) => {
                const id = e.target.value;
                const p = properties.find((x) => x.id === id);
                setForm({ ...form, propertyId: id, value: p ? String(p.price) : form.value });
              }}
            >
              <option value="">A definir…</option>
              {modalProperties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} — {p.title} · {formatCompact(p.price)}
                </option>
              ))}
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Valor (R$)">
              <Input
                type="number"
                min={0}
                value={form.value}
                onChange={(e) => setForm({ ...form, value: e.target.value })}
                className="font-mono tabular"
              />
            </Field>
            <Field label="Estágio inicial">
              <Select value={form.stage} onChange={(e) => setForm({ ...form, stage: e.target.value })}>
                {DEAL_STAGES.map((s) => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </Select>
            </Field>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button variant="accent" loading={saving} onClick={createDeal}>
            Abrir negociação
          </Button>
        </div>
      </Modal>
    </div>
  );
}

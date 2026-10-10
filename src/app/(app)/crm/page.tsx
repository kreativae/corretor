import { OverviewFiltersBar } from "@/components/crm/overview-filters-bar";
import { StatCard } from "@/components/crm/stat-card";
import { Timeline } from "@/components/crm/timeline";
import { Badge } from "@/components/ui";
import { DEAL_STAGES, TYPE_LABELS, VISIT_STATUS_STYLES, VISIT_STATUS_LABELS } from "@/lib/labels";
import { formatAlq, isRuralType, normalizeRural } from "@/lib/rural";
import {
  overviewPeriodLabel,
  overviewRange,
  parseOverview,
} from "@/lib/overview-filters";
import {
  listActivities,
  listContacts,
  listDealClosedDates,
  listDeals,
  listProperties,
  listPropertyViewTotals,
  listVisits,
} from "@/lib/queries";
import type { Contact, Property } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { getFeatures } from "@/lib/features";
import {
  cn,
  formatBRL,
  formatCompact,
  formatTime,
  TIME_ZONE,
  timeAgo,
  weekdayShort,
  zonedParts,
} from "@/lib/utils";
import {
  ArrowUpRight,
  Building2,
  CalendarDays,
  CheckCheck,
  Columns3,
  Eye,
  Handshake,
  Hourglass,
  Percent,
  UserX,
  Wallet,
  Tractor,
  UserPlus,
} from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function CrmDashboard({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const f = parseOverview(sp);
  const [allProperties, allContacts, allVisits, allDeals, activities, user, closedDates, features] =
    await Promise.all([
      listProperties(),
      listContacts(),
      listVisits(),
      listDeals(),
      listActivities(10),
      getCurrentUser(),
      listDealClosedDates(),
      getFeatures(),
    ]);

  const now = new Date();

  // ── Filtros (segmento, tipo, local, finalidade, origem) ──
  const hasPropFilter = !!(f.tipo.length || f.bairro.length || f.cidade.length || f.finalidade);
  const propOk = (p: Property | null) => {
    if (!p) return !hasPropFilter && f.seg !== "rurais";
    if (f.seg !== "todos" && isRuralType(p.type) !== (f.seg === "rurais")) return false;
    if (f.tipo.length && !f.tipo.includes(p.type)) return false;
    if (f.bairro.length && !f.bairro.includes(p.neighborhood)) return false;
    if (f.cidade.length && !f.cidade.includes(p.city)) return false;
    if (f.finalidade && p.purpose !== f.finalidade) return false;
    return true;
  };
  const sourceOk = (c: Contact | null) => !f.origem.length || (!!c && f.origem.includes(c.source));
  // Leads: pelo interesse declarado (sem interesse conta como imóveis)
  const contactOk = (c: Contact) => {
    if (!sourceOk(c)) return false;
    const rural = c.interestTypes.some(isRuralType);
    if (f.seg === "rurais" && !rural) return false;
    if (f.seg === "imoveis" && rural && !c.interestTypes.some((t) => !isRuralType(t))) return false;
    if (f.tipo.length && !c.interestTypes.some((t) => f.tipo.includes(t))) return false;
    if (f.bairro.length && !c.neighborhoods.some((n) => f.bairro.includes(n))) return false;
    return true;
  };
  const properties = allProperties.filter(propOk);
  const contacts = allContacts.filter(contactOk);
  const deals = allDeals.filter((d) => propOk(d.property) && sourceOk(d.contact));
  const visits = allVisits.filter((v) => propOk(v.property) && sourceOk(v.contact));

  const [rangeFrom, rangeTo] = overviewRange(f, now.getTime());
  const viewTotals = await listPropertyViewTotals({ from: rangeFrom, to: rangeTo });
  const inRange = (d: Date | string) => {
    const t = new Date(d).getTime();
    return (rangeFrom == null || t >= rangeFrom) && (rangeTo == null || t <= rangeTo);
  };
  const periodLabel = overviewPeriodLabel(f);
  const closedInPeriod = deals.filter(
    (d) => d.deal.stage === "fechado" && inRange(closedDates[d.deal.id] ?? d.deal.updatedAt),
  );
  const closedValue = closedInPeriod.reduce((a, d) => a + d.deal.value, 0);
  const visitsInPeriod = visits.filter(
    (v) => v.visit.status !== "cancelada" && inRange(v.visit.scheduledAt),
  ).length;

  // ── Indicadores de desempenho do período ──
  const periodVisits = visits.filter((v) => inRange(v.visit.scheduledAt));
  const realizadas = periodVisits.filter((v) => v.visit.status === "realizada").length;
  const canceladas = periodVisits.filter((v) => v.visit.status === "cancelada").length;
  const comparecimento =
    realizadas + canceladas ? Math.round((realizadas / (realizadas + canceladas)) * 100) : null;
  const withDeal = new Set(allDeals.map((d) => d.deal.contactId));
  const foraDoFunil = contacts.filter((c) => !withDeal.has(c.id));
  const foraDoFunilNovos = foraDoFunil.filter((c) => inRange(c.createdAt)).length;
  const staleLimit = now.getTime() - 15 * 864e5;
  const paradas = deals.filter(
    (d) => d.deal.stage !== "fechado" && new Date(d.deal.updatedAt).getTime() < staleLimit,
  );
  const visibleIds = new Set(properties.map((p) => p.id));
  const viewsPeriod = Object.entries(viewTotals)
    .filter(([id]) => visibleIds.has(id))
    .reduce((a, [, v]) => ({ total: a.total + v.total, unique: a.unique + v.unique }), {
      total: 0,
      unique: 0,
    });
  const topViewed = Object.entries(viewTotals)
    .filter(([id]) => visibleIds.has(id))
    .sort((a, b) => b[1].total - a[1].total)[0];
  const topViewedCode = topViewed
    ? properties.find((p) => p.id === topViewed[0])?.code
    : undefined;
  const budgets = contacts
    .map((c) => c.budgetMax ?? c.budgetMin ?? 0)
    .filter((b) => b > 0);
  const avgBudget = budgets.length
    ? Math.round(budgets.reduce((a, b) => a + b, 0) / budgets.length)
    : 0;
  const conversion = deals.length
    ? Math.round((deals.filter((d) => d.deal.stage === "fechado").length / deals.length) * 100)
    : 0;

  const tally = (vals: string[]) =>
    [...new Set(vals.filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  const filterOptions = {
    bairros: tally(allProperties.map((p) => p.neighborhood)),
    cidades: tally(allProperties.map((p) => p.city)),
    tipos: tally(allProperties.map((p) => p.type)),
  };
  const hour = zonedParts(now).hour;
  const firstName = user?.name.trim().split(/\s+/)[0];
  const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";

  // Portfólio separado: urbanos x rurais
  const urbanos = properties.filter((p) => !isRuralType(p.type));
  const rurais = properties.filter((p) => isRuralType(p.type));
  const active = urbanos.filter((p) => p.status === "disponivel").length;
  const activeRurais = rurais.filter((p) => p.status === "disponivel");
  const activeRuralAlq = activeRurais.reduce((a, p) => a + (normalizeRural(p.rural).totalAlq ?? 0), 0);
  const newLeads = contacts.filter((c) => inRange(c.createdAt)).length;

  // semana atual (segunda-feira)
  // Meia-noite de Brasília = 03:00 UTC (sem horário de verão desde 2019)
  const today = zonedParts(now);
  const dow = (today.weekday + 6) % 7;
  const monday = new Date(Date.UTC(today.year, today.month, today.day - dow, 3));
  const weekVisits = visits.filter((v) => {
    const d = new Date(v.visit.scheduledAt);
    return d >= monday && d < new Date(monday.getTime() + 7 * 864e5);
  });

  const openDeals = deals.filter((d) => d.deal.stage !== "fechado");
  const pipelineValue = openDeals.reduce((acc, d) => acc + d.deal.value, 0);
  const ruralDeals = openDeals.filter((d) => isRuralType(d.property?.type));
  const ruralPipeline = ruralDeals.reduce((acc, d) => acc + d.deal.value, 0);

  const portfolio = [urbanos, rurais].map((list) => {
    const disponiveis = list.filter((p) => p.status === "disponivel");
    const byType = Object.entries(
      list.reduce<Record<string, number>>((acc, p) => {
        acc[p.type] = (acc[p.type] ?? 0) + 1;
        return acc;
      }, {}),
    ).sort((a, b) => b[1] - a[1]);
    const vgv = disponiveis.reduce((a, p) => a + p.price, 0);
    const alq = disponiveis.reduce((a, p) => a + (normalizeRural(p.rural).totalAlq ?? 0), 0);
    return {
      total: list.length,
      disponiveis: disponiveis.length,
      publicados: list.filter((p) => p.published).length,
      byType,
      vgv,
      alq,
      precoMedioAlq: alq > 0 ? Math.round(vgv / alq) : null,
    };
  });

  const upcoming = visits
    .filter(
      (v) =>
        new Date(v.visit.scheduledAt) >= now &&
        ["agendada", "confirmada"].includes(v.visit.status),
    )
    .sort(
      (a, b) =>
        new Date(a.visit.scheduledAt).getTime() -
        new Date(b.visit.scheduledAt).getTime(),
    )
    .slice(0, 6);

  // barras da semana (seg–dom)
  const perDay = Array.from({ length: 7 }, (_, i) => {
    const start = monday.getTime() + i * 864e5;
    return {
      label: ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"][i],
      count: weekVisits.filter((v) => {
        const t = new Date(v.visit.scheduledAt).getTime();
        return t >= start && t < start + 864e5;
      }).length,
      today: i === dow,
    };
  });
  const maxDay = Math.max(...perDay.map((d) => d.count), 1);

  const stageData = DEAL_STAGES.map((s) => {
    const inStage = deals.filter((d) => d.deal.stage === s.id);
    return {
      ...s,
      count: inStage.length,
      value: inStage.reduce((a, d) => a + d.deal.value, 0),
    };
  });
  const maxStage = Math.max(...stageData.map((s) => s.value), 1);

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-subtle">
            {now.toLocaleDateString("pt-BR", {
              timeZone: TIME_ZONE,
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </p>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight md:text-4xl">
            {greeting}
            {firstName ? `, ${firstName}` : ""}.
          </h1>
        </div>
        <p className="max-w-xs text-right text-xs leading-relaxed text-subtle">
          {active} imóveis ativos ·{" "}
          {rurais.length > 0 && `${activeRurais.length} rurais ativas · `}
          {newLeads} novos leads ({periodLabel}) ·{" "}
          {weekVisits.length} visitas nesta semana
        </p>
      </div>

      <OverviewFiltersBar
        value={f}
        hasParams={Object.keys(sp).length > 0}
        options={filterOptions}
      />

      {/* KPIs */}
      <div
        className={cn(
          "grid gap-4 sm:grid-cols-2 lg:grid-cols-3",
          features.closedDeals ? "xl:grid-cols-6" : "xl:grid-cols-5",
        )}
      >
        <StatCard
          label="Imóveis ativos"
          value={active}
          caption={`${urbanos.length} imóveis no portfólio`}
          icon={<Building2 className="size-4" />}
        />
        <StatCard
          label="Rurais ativas"
          value={activeRurais.length}
          caption={
            rurais.length
              ? `${formatAlq(activeRuralAlq)} alq disponíveis · ${rurais.length} no total`
              : "Nenhuma propriedade rural"
          }
          icon={<Tractor className="size-4" />}
        />
        <StatCard
          label="Novos leads"
          value={newLeads}
          caption={`${periodLabel[0].toUpperCase()}${periodLabel.slice(1)} · ${visitsInPeriod} visitas no período`}
          icon={<UserPlus className="size-4" />}
        />
        <StatCard
          label="Visitas na semana"
          value={weekVisits.length}
          caption={`${upcoming.length} confirmadas à frente`}
          icon={<CalendarDays className="size-4" />}
        />
        <StatCard
          label="Pipeline aberto"
          value={pipelineValue}
          format="brl"
          caption={
            ruralDeals.length
              ? `${openDeals.length} negociações · ${formatCompact(ruralPipeline)} em rurais`
              : `${openDeals.length} negociações em curso`
          }
          icon={<Columns3 className="size-4" />}
        />
        <StatCard
          label="Visitas realizadas"
          value={realizadas}
          caption={
            comparecimento != null
              ? `${comparecimento}% de comparecimento · ${periodLabel}`
              : `Nenhuma visita encerrada · ${periodLabel}`
          }
          icon={<CheckCheck className="size-4" />}
        />
        <StatCard
          label="Leads fora do funil"
          value={foraDoFunil.length}
          caption={
            foraDoFunilNovos
              ? `${foraDoFunilNovos} novos no período sem negociação`
              : "Contatos sem negociação aberta"
          }
          icon={<UserX className="size-4" />}
        />
        <StatCard
          label="Paradas +15 dias"
          value={paradas.length}
          caption={
            paradas.length
              ? `${formatCompact(paradas.reduce((a, d) => a + d.deal.value, 0))} sem movimentação`
              : "Pipeline em movimento"
          }
          icon={<Hourglass className="size-4" />}
        />
        <StatCard
          label="Visualizações no site"
          value={viewsPeriod.total}
          caption={
            viewsPeriod.total
              ? `${topViewedCode ? `Mais visto: ${topViewedCode} · ` : ""}${periodLabel}`
              : `Nenhuma visualização · ${periodLabel}`
          }
          icon={<Eye className="size-4" />}
        />
        <StatCard
          label="Orçamento médio"
          value={avgBudget}
          format="brl"
          caption={
            budgets.length
              ? `${budgets.length} de ${contacts.length} leads informaram`
              : "Nenhum lead informou orçamento"
          }
          icon={<Wallet className="size-4" />}
        />
        {features.closedDeals && (
        <StatCard
          label="Conversão"
          value={conversion}
          format="pct"
          caption="Negociações fechadas sobre o total"
          icon={<Percent className="size-4" />}
        />
        )}
        {features.closedDeals && (
        <StatCard
          label="Negócios fechados"
          value={closedValue}
          format="brl"
          caption={`${closedInPeriod.length} ${closedInPeriod.length === 1 ? "negócio" : "negócios"} · ${periodLabel}`}
          icon={<Handshake className="size-4" />}
        />
        )}
      </div>

      {/* Portfólio: imóveis x rurais */}
      <div className="grid gap-4 md:grid-cols-2">
        {(
          [
            { title: "Imóveis", href: "/crm/imoveis", icon: Building2, data: portfolio[0], rural: false },
            { title: "Propriedades rurais", href: "/crm/propriedades", icon: Tractor, data: portfolio[1], rural: true },
          ] as const
        )
          .filter((c) => f.seg === "todos" || c.rural === (f.seg === "rurais"))
          .map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className="card-elev group rounded-2xl border border-hairline bg-card p-6 transition-colors hover:border-hairline-strong"
          >
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-display text-base font-semibold tracking-tight">
                <c.icon className="size-4 text-subtle" />
                {c.title}
              </h2>
              <ArrowUpRight className="size-4 text-subtle transition-colors group-hover:text-ink" />
            </div>
            <div className="mt-5 grid grid-cols-3 gap-3">
              <div>
                <p className="font-mono text-2xl font-medium tabular">{c.data.disponiveis}</p>
                <p className="text-[11px] text-subtle">disponíveis de {c.data.total}</p>
              </div>
              <div>
                <p className="font-mono text-2xl font-medium tabular">
                  {c.rural ? formatAlq(c.data.alq) : c.data.publicados}
                </p>
                <p className="text-[11px] text-subtle">
                  {c.rural ? "alqueires disponíveis" : "publicados no site"}
                </p>
              </div>
              <div>
                <p className="font-mono text-2xl font-medium tabular">{formatCompact(c.data.vgv)}</p>
                <p className="text-[11px] text-subtle">VGV disponível</p>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-1.5 border-t border-hairline pt-4">
              {c.data.byType.length ? (
                c.data.byType.map(([t, n]) => (
                  <span key={t} className="rounded-full bg-soft px-2.5 py-1 text-[11px]">
                    {TYPE_LABELS[t]} <span className="font-mono text-subtle">{n}</span>
                  </span>
                ))
              ) : (
                <span className="text-xs text-subtle">
                  {c.rural ? "Cadastre a primeira fazenda, sítio ou chácara." : "Nenhum imóvel cadastrado."}
                </span>
              )}
              {c.rural && c.data.precoMedioAlq && (
                <span className="ml-auto font-mono text-[11px] text-subtle">
                  média {formatCompact(c.data.precoMedioAlq)}/alq
                </span>
              )}
            </div>
          </Link>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        {/* Pipeline por estágio */}
        <div className="card-elev rounded-2xl border border-hairline bg-card p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-semibold tracking-tight">
              Pipeline
            </h2>
            <Link
              href="/crm/pipeline"
              className="inline-flex items-center gap-1 text-xs font-medium text-subtle transition-colors hover:text-ink"
            >
              Abrir quadro
              <ArrowUpRight className="size-3.5" />
            </Link>
          </div>
          <div className="mt-6 space-y-4">
            {stageData.map((s) => (
              <div key={s.id} className="grid grid-cols-[120px_1fr_auto] items-center gap-3">
                <span className="flex items-center gap-2 text-xs text-subtle">
                  <span
                    className="size-2 rounded-full"
                    style={{ background: s.dot }}
                  />
                  {s.label}
                </span>
                <div className="h-1.5 overflow-hidden rounded-full bg-soft">
                  <div
                    className="h-full rounded-full transition-all duration-700 ease-expo"
                    style={{
                      width: `${Math.max((s.value / maxStage) * 100, s.count ? 6 : 0)}%`,
                      background: s.dot,
                    }}
                  />
                </div>
                <span className="text-right font-mono text-[11px] tabular text-subtle">
                  {s.count} · {formatCompact(s.value)}
                </span>
              </div>
            ))}
          </div>

          {/* Semana */}
          <div className="mt-8 border-t border-hairline pt-6">
            <h3 className="text-xs font-medium text-subtle">
              Visitas agendadas — semana atual
            </h3>
            <div className="mt-5 flex h-28 items-end gap-2.5">
              {perDay.map((d) => (
                <div key={d.label} className="flex flex-1 flex-col items-center gap-2">
                  <span className="font-mono text-[10px] tabular text-subtle">
                    {d.count || ""}
                  </span>
                  <div
                    className={cn(
                      "w-full rounded-t-md transition-all duration-700 ease-expo",
                      d.today ? "bg-accent" : "bg-hairline-strong",
                    )}
                    style={{ height: `${(d.count / maxDay) * 100}%`, minHeight: d.count ? 6 : 2 }}
                  />
                  <span
                    className={cn(
                      "font-mono text-[10px] uppercase",
                      d.today ? "font-semibold text-accent" : "text-subtle",
                    )}
                  >
                    {d.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Próximas visitas */}
        <div className="card-elev rounded-2xl border border-hairline bg-card p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-semibold tracking-tight">
              Próximas visitas
            </h2>
            <Link
              href="/crm/agenda"
              className="inline-flex items-center gap-1 text-xs font-medium text-subtle transition-colors hover:text-ink"
            >
              Agenda
              <ArrowUpRight className="size-3.5" />
            </Link>
          </div>
          <div className="mt-5 space-y-1.5">
            {upcoming.length === 0 && (
              <p className="py-8 text-center text-sm text-subtle">
                Nenhuma visita à frente. Que tal agendar uma?
              </p>
            )}
            {upcoming.map(({ visit: v, property, contact }) => (
              <div
                key={v.id}
                className="flex items-center gap-3 rounded-xl px-2.5 py-2.5 transition-colors hover:bg-soft/70"
              >
                <div className="w-14 shrink-0">
                  <p className="font-mono text-sm font-medium tabular">
                    {formatTime(v.scheduledAt)}
                  </p>
                  <p className="font-mono text-[10px] uppercase text-subtle">
                    {weekdayShort(v.scheduledAt)}
                  </p>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium">
                    {contact?.name ?? "—"}
                  </p>
                  <p className="truncate text-[11.5px] text-subtle">
                    {property?.title ?? "Imóvel removido"}
                  </p>
                </div>
                <Badge className={cn("border px-2 py-0.5 text-[10px]", VISIT_STATUS_STYLES[v.status])}>
                  {VISIT_STATUS_LABELS[v.status]}
                </Badge>
              </div>
            ))}
          </div>

          <div className="mt-5 border-t border-hairline pt-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-base font-semibold tracking-tight">
                Atividade recente
              </h2>
              <span className="font-mono text-[10px] uppercase tracking-wider text-subtle">
                {formatBRL(pipelineValue)} em jogo
              </span>
            </div>
            <Timeline items={activities.slice(0, 7)} />
            <p className="mt-4 text-right font-mono text-[10px] uppercase tracking-wider text-subtle">
              última: {activities[0] ? timeAgo(activities[0].createdAt) : "—"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

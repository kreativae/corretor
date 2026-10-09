import { StatCard } from "@/components/crm/stat-card";
import { Timeline } from "@/components/crm/timeline";
import { Badge } from "@/components/ui";
import { DEAL_STAGES, VISIT_STATUS_STYLES, VISIT_STATUS_LABELS } from "@/lib/labels";
import {
  listActivities,
  listContacts,
  listDeals,
  listProperties,
  listVisits,
} from "@/lib/queries";
import { getCurrentUser } from "@/lib/auth";
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
  Columns3,
  UserPlus,
} from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function CrmDashboard() {
  const [properties, contacts, visits, deals, activities, user] = await Promise.all([
    listProperties(),
    listContacts(),
    listVisits(),
    listDeals(),
    listActivities(10),
    getCurrentUser(),
  ]);

  const now = new Date();
  const hour = zonedParts(now).hour;
  const firstName = user?.name.trim().split(/\s+/)[0];
  const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";

  const active = properties.filter((p) => p.status === "disponivel").length;
  const monthAgo = new Date(now.getTime() - 30 * 864e5);
  const newLeads = contacts.filter(
    (c) => new Date(c.createdAt) >= monthAgo,
  ).length;

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
          {active} imóveis ativos · {newLeads} novos leads em 30 dias ·{" "}
          {weekVisits.length} visitas nesta semana
        </p>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Imóveis ativos"
          value={active}
          caption={`${properties.length} no portfólio total`}
          icon={<Building2 className="size-4" />}
        />
        <StatCard
          label="Novos leads"
          value={newLeads}
          caption="Últimos 30 dias"
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
          caption={`${openDeals.length} negociações em curso`}
          icon={<Columns3 className="size-4" />}
        />
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

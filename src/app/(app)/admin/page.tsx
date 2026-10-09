import { StatCard } from "@/components/crm/stat-card";
import { Timeline } from "@/components/crm/timeline";
import { db } from "@/db";
import { integrations } from "@/db/schema";
import {
  getPortfolioViews,
  getTopViewedProperties,
  listActivities,
  listDeals,
  listPortals,
  listProperties,
  listUsers,
} from "@/lib/queries";
import {
  ArrowUpRight,
  Globe,
  Palette,
  Plug,
  RefreshCw,
  ShieldCheck,
  TrendingUp,
  Users,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Administração" };

export default async function AdminPage() {
  const [users, properties, portals, deals, activities, ints, views, topViewed] =
    await Promise.all([
      listUsers(),
      listProperties(),
      listPortals(),
      listDeals(),
      listActivities(12),
      db.select().from(integrations),
      getPortfolioViews(),
      getTopViewedProperties(5),
    ]);
  const propById = new Map(properties.map((p) => [p.id, p]));
  const maxViews = topViewed[0]?.total ?? 1;

  const published = properties.filter((p) => p.published).length;
  const connectedPortals = portals.filter((p) => p.enabled).length;
  const connectedInts = ints.filter((i) => i.connected).length;
  const closed = deals.filter((d) => d.deal.stage === "fechado").length;
  const conversion = deals.length ? Math.round((closed / deals.length) * 100) : 0;

  const shortcuts = [
    {
      href: "/admin/equipe",
      icon: Users,
      title: "Equipe & acessos",
      body: `${users.length} usuários · papéis, senhas e ativação`,
    },
    {
      href: "/admin/site",
      icon: Palette,
      title: "Conteúdo do site",
      body: "Textos, chamadas, SEO e mídias da vitrine",
    },
    {
      href: "/admin/configuracoes",
      icon: Plug,
      title: "Configurações",
      body: `${connectedInts} de ${ints.length} integrações conectadas`,
    },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-subtle">
            Governança
          </p>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">
            Administração
          </h1>
        </div>
        <p className="max-w-xs text-right text-xs leading-relaxed text-subtle">
          Visão consolidada da operação, acessos e integrações da plataforma.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Usuários ativos"
          value={users.filter((u) => u.active).length}
          caption={`${users.length} cadastrados no total`}
          icon={<ShieldCheck className="size-4" />}
        />
        <StatCard
          label="Imóveis publicados"
          value={published}
          caption={`${properties.length} na base total`}
          icon={<Globe className="size-4" />}
        />
        <StatCard
          label="Integrações ativas"
          value={connectedInts + connectedPortals}
          caption={`${connectedPortals} portais · ${connectedInts} serviços`}
          icon={<RefreshCw className="size-4" />}
        />
        <StatCard
          label="Taxa de fechamento"
          value={conversion}
          format="pct"
          caption={`${closed} de ${deals.length} negociações`}
          icon={<TrendingUp className="size-4" />}
        />
      </div>

      {/* Atalhos */}
      <section>
        <h2 className="mb-4 font-display text-base font-semibold tracking-tight">
          Central de governança
        </h2>
        <div className="grid gap-4 md:grid-cols-3">
          {shortcuts.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              className="card-elev group rounded-2xl border border-hairline bg-card p-5 transition-all duration-300 hover:border-hairline-strong"
            >
              <div className="flex items-start justify-between">
                <span className="flex size-10 items-center justify-center rounded-xl bg-soft text-subtle transition-colors group-hover:bg-accent/12 group-hover:text-accent">
                  <s.icon className="size-5" />
                </span>
                <ArrowUpRight className="size-4 text-subtle transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-ink" />
              </div>
              <p className="mt-4 font-display text-base font-semibold tracking-tight">
                {s.title}
              </p>
              <p className="mt-1.5 text-xs leading-relaxed text-subtle">{s.body}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* Desempenho do portfólio */}
      <section>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-base font-semibold tracking-tight">
              Desempenho do portfólio
            </h2>
            <p className="mt-1 text-xs text-subtle">
              Visualizações da vitrine pública — últimos 30 dias
            </p>
          </div>
          <p className="font-mono text-xs tabular text-subtle">
            {views.total30d.toLocaleString("pt-BR")} views ·{" "}
            {views.unique30d.toLocaleString("pt-BR")} visitantes únicos
          </p>
        </div>
        <div className="card-elev rounded-2xl border border-hairline bg-card p-2">
          {topViewed.length === 0 && (
            <p className="py-12 text-center text-sm text-subtle">
              Nenhuma visualização registrada ainda.
            </p>
          )}
          {topViewed.map((t, i) => {
            const prop = propById.get(t.propertyId);
            return (
              <div
                key={t.propertyId}
                className="flex items-center gap-4 rounded-xl px-3.5 py-3 transition-colors hover:bg-soft/50"
              >
                <span className="w-6 shrink-0 font-mono text-xs text-subtle">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="relative block size-11 shrink-0 overflow-hidden rounded-lg bg-soft">
                  {prop?.cover ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={prop.cover}
                      alt=""
                      loading="lazy"
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  ) : null}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium leading-tight">
                    {prop?.title ?? "Imóvel removido"}
                  </p>
                  <p className="truncate font-mono text-[10.5px] uppercase tracking-wider text-subtle">
                    {prop?.code ?? "—"} · {prop?.neighborhood ?? "—"}
                  </p>
                  <span className="mt-1.5 block h-1 w-full overflow-hidden rounded-full bg-soft">
                    <span
                      className="block h-full rounded-full bg-accent"
                      style={{ width: `${(t.total / maxViews) * 100}%` }}
                    />
                  </span>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-mono text-sm font-medium tabular">
                    {t.total.toLocaleString("pt-BR")}
                  </p>
                  <p className="font-mono text-[10px] uppercase tracking-wider text-subtle">
                    {t.unique} únicos
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Atividade */}
      <section className="card-elev rounded-2xl border border-hairline bg-card p-6">
        <h2 className="mb-6 font-display text-base font-semibold tracking-tight">
          Auditoria recente
        </h2>
        <Timeline items={activities} />
      </section>
    </div>
  );
}

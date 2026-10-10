import { crmPropertyPath } from "@/lib/rural";
import { ContactActions } from "@/components/crm/contact-actions";
import { Timeline } from "@/components/crm/timeline";
import { MobileSection } from "@/components/crm/mobile-section";
import { Badge, Button } from "@/components/ui";
import {
  CONTACT_TYPE_LABELS,
  DEAL_STAGE_LABELS,
  DEAL_STAGES,
  SOURCE_LABELS,
  TYPE_LABELS,
  VISIT_STATUS_LABELS,
  VISIT_STATUS_STYLES,
} from "@/lib/labels";
import {
  getContact,
  getMatchesFor,
  listActivitiesFor,
  listDeals,
  listProperties,
  listVisits,
} from "@/lib/queries";
import { cn, formatBRL, formatCompact, formatDateTime, initials, timeAgo } from "@/lib/utils";
import {
  ArrowLeft,
  Building2,
  Mail,
  MessageCircle,
  Phone,
  Sparkles,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Contato" };

export default async function ContatoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [c, allVisits, allDeals, allProps] = await Promise.all([
    getContact(id),
    listVisits(),
    listDeals(),
    listProperties(),
  ]);
  if (!c) notFound();

  const [matches, activities] = await Promise.all([
    getMatchesFor(c),
    listActivitiesFor("contato", c.id, 15),
  ]);

  const myVisits = allVisits.filter((v) => v.contact?.id === c.id);
  const phoneDigits = c.phone.replace(/\D/g, "");
  const wa =
    phoneDigits.length >= 10 ? (phoneDigits.startsWith("55") ? phoneDigits : `55${phoneDigits}`) : null;
  const myDeals = allDeals.filter((d) => d.contact?.id === c.id);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <Link
            href="/crm/contatos"
            className="mt-1 flex size-10 shrink-0 items-center justify-center rounded-full border border-hairline text-subtle transition-colors hover:bg-soft hover:text-ink"
            aria-label="Voltar"
          >
            <ArrowLeft className="size-4.5" />
          </Link>
          <div className="flex min-w-0 items-center gap-3 md:gap-4">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-ink font-mono text-sm font-semibold text-canvas md:size-14 md:text-base">
              {initials(c.name)}
            </span>
            <div className="min-w-0">
              <h1 className="font-display text-xl font-semibold tracking-tight md:text-3xl">
                {c.name}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge>{CONTACT_TYPE_LABELS[c.type]}</Badge>
                <Badge>origem: {SOURCE_LABELS[c.source]}</Badge>
                <span className="font-mono text-[11px] uppercase tracking-wider text-subtle">
                  na base {timeAgo(c.createdAt)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Contato rápido */}
        <div className="grid w-full grid-cols-3 gap-2 sm:flex sm:w-auto">
          {wa && (
            <a href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer">
              <Button variant="accent" size="sm" className="w-full">
                <MessageCircle className="size-3.5" />
                WhatsApp
              </Button>
            </a>
          )}
          {phoneDigits && (
            <a href={`tel:${phoneDigits}`}>
              <Button variant="outline" size="sm" className="w-full">
                <Phone className="size-3.5" />
                Ligar
              </Button>
            </a>
          )}
          {c.email && (
            <a href={`mailto:${c.email}`}>
              <Button variant="outline" size="sm" className="w-full">
                <Mail className="size-3.5" />
                E-mail
              </Button>
            </a>
          )}
        </div>
      </div>

      {/* No celular as colunas viram uma lista só, reordenada (ações antes do Smart Match) */}
      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <div className="contents lg:block lg:space-y-5">
          {/* Perfil de busca */}
          <div className="order-1 rounded-2xl border border-hairline bg-card p-4 md:p-6 lg:order-none">
            <h2 className="font-display text-base font-semibold tracking-tight">
              Perfil de busca
            </h2>
            <div className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
              <div className="rounded-xl bg-soft p-4">
                <p className="text-[11px] uppercase tracking-wider text-subtle">Orçamento</p>
                <p className="mt-1.5 font-mono font-medium tabular">
                  {c.budgetMin || c.budgetMax
                    ? `${c.budgetMin ? formatCompact(c.budgetMin) : "—"} → ${c.budgetMax ? formatCompact(c.budgetMax) : "—"}`
                    : "Não informado"}
                </p>
              </div>
              <div className="rounded-xl bg-soft p-4">
                <p className="text-[11px] uppercase tracking-wider text-subtle">Contato</p>
                <p className="mt-1.5 flex flex-col gap-1">
                  <span className="flex items-center gap-1.5 text-[13px]">
                    <Phone className="size-3.5 text-subtle" />
                    {c.phone}
                  </span>
                  {c.email && (
                    <span className="flex items-center gap-1.5 truncate text-[13px]">
                      <Mail className="size-3.5 shrink-0 text-subtle" />
                      {c.email}
                    </span>
                  )}
                </p>
              </div>
            </div>
            {(c.interestTypes.length > 0 || c.neighborhoods.length > 0) && (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {c.interestTypes.map((t) => (
                  <Badge key={t} className="border-transparent bg-accent/10 text-accent">
                    {TYPE_LABELS[t]}
                  </Badge>
                ))}
                {c.neighborhoods.map((n) => (
                  <Badge key={n}>{n}</Badge>
                ))}
              </div>
            )}
            {c.notes && (
              <p className="mt-4 border-t border-hairline pt-4 text-sm leading-relaxed text-subtle">
                {c.notes}
              </p>
            )}
          </div>

          {/* Smart match */}
          <div className="order-5 rounded-2xl border border-hairline bg-card p-4 md:p-6 lg:order-none">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-display text-base font-semibold tracking-tight">
                <Sparkles className="size-4 text-accent" />
                Smart Match
              </h2>
              <span className="font-mono text-[10px] uppercase tracking-wider text-subtle">
                {matches.length} imóveis compatíveis
              </span>
            </div>
            <p className="mt-1 text-xs text-subtle">
              Cruzamento automático de orçamento, tipologia e bairros de interesse.
            </p>
            <div className="mt-5 space-y-2.5">
              {matches.length === 0 && (
                <p className="rounded-xl border border-dashed border-hairline-strong py-8 text-center text-sm text-subtle">
                  Nenhum imóvel compatível no momento — novos cadastros serão
                  cruzados automaticamente.
                </p>
              )}
              {matches.map(({ property, score }) => (
                <Link
                  key={property.id}
                  href={crmPropertyPath(property)}
                  className="group flex items-center gap-4 rounded-xl border border-hairline p-3 transition-all duration-300 hover:border-hairline-strong hover:bg-soft/50"
                >
                  <span className="relative block size-14 shrink-0 overflow-hidden rounded-lg bg-soft">
                    {property.cover ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={property.cover}
                        alt=""
                        loading="lazy"
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                    ) : (
                      <Building2 className="absolute inset-0 m-auto size-4 text-subtle" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium group-hover:underline group-hover:underline-offset-4">
                      {property.title}
                    </span>
                    <span className="mt-0.5 block font-mono text-[10.5px] uppercase tracking-wider text-subtle">
                      {property.code} · {property.neighborhood} ·{" "}
                      <span className="tabular">{formatBRL(property.price)}</span>
                    </span>
                    <span className="mt-2 block h-1 w-full overflow-hidden rounded-full bg-soft">
                      <span
                        className="block h-full rounded-full bg-accent transition-all duration-700 ease-expo"
                        style={{ width: `${score}%` }}
                      />
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="font-mono text-lg font-medium tabular text-accent">
                      {score}
                    </span>
                    <span className="block text-[9px] uppercase tracking-widest text-subtle">
                      match
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Coluna lateral */}
        <div className="contents lg:block lg:space-y-5">
          <div className="order-2 lg:order-none">
          <ContactActions
            contactId={c.id}
            contactName={c.name}
            properties={allProps
              .filter((p) => ["disponivel", "reservado"].includes(p.status))
              .map((p) => ({ id: p.id, code: p.code, title: p.title, price: p.price }))}
            linkedToGoogle={!!c.googleResourceName}
            dealsCount={myDeals.length}
            visitsCount={myVisits.length}
          />
          </div>

          {/* Negociações */}
          <div className="order-3 rounded-2xl border border-hairline bg-card p-4 md:p-5 lg:order-none">
            <h3 className="font-display text-sm font-semibold tracking-tight">
              Negociações
              <span className="ml-2 font-mono text-[11px] font-normal text-subtle">
                {myDeals.length}
              </span>
            </h3>
            {myDeals.length === 0 ? (
              <p className="py-6 text-center text-xs text-subtle">
                Nenhuma negociação aberta.
              </p>
            ) : (
              <div className="mt-3 space-y-2">
                {myDeals.map(({ deal, property }) => (
                  <div
                    key={deal.id}
                    className="flex items-center justify-between gap-3 rounded-xl bg-soft px-3.5 py-3 text-sm"
                  >
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5 font-medium">
                        <span
                          className="size-1.5 shrink-0 rounded-full"
                          style={{ background: DEAL_STAGES.find((st) => st.id === deal.stage)?.dot }}
                        />
                        {DEAL_STAGE_LABELS[deal.stage] ?? deal.stage}
                      </span>
                      <span className="mt-0.5 block truncate text-[11px] text-subtle">
                        {property ? `${property.code} · ${property.title}` : "Imóvel a definir"}
                      </span>
                    </span>
                    <span className="shrink-0 font-mono text-xs tabular text-subtle">
                      {deal.value ? formatBRL(deal.value) : "—"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Visitas */}
          <div className="order-4 rounded-2xl border border-hairline bg-card p-4 md:p-5 lg:order-none">
            <h3 className="font-display text-sm font-semibold tracking-tight">
              Visitas
              <span className="ml-2 font-mono text-[11px] font-normal text-subtle">
                {myVisits.length}
              </span>
            </h3>
            {myVisits.length === 0 ? (
              <p className="py-6 text-center text-xs text-subtle">
                Nenhuma visita registrada.
              </p>
            ) : (
              <div className="mt-3 space-y-1.5">
                {myVisits.map(({ visit: v, property }) => (
                  <div key={v.id} className="flex items-center gap-3 rounded-xl px-2 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium">
                        {property?.title ?? "—"}
                      </p>
                      <p className="font-mono text-[10px] uppercase tracking-wider text-subtle">
                        {formatDateTime(v.scheduledAt)}
                      </p>
                    </div>
                    <Badge className={cn("border px-2 py-0.5 text-[10px]", VISIT_STATUS_STYLES[v.status])}>
                      {VISIT_STATUS_LABELS[v.status]}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Linha do tempo — sanfona no celular */}
          <MobileSection
            className="order-6 rounded-2xl border border-hairline bg-card p-4 md:p-5 lg:order-none"
            title="Linha do tempo"
            meta={activities[0] ? timeAgo(activities[0].createdAt) : undefined}
          >
            <Timeline items={activities} />
          </MobileSection>
        </div>
      </div>
    </div>
  );
}
